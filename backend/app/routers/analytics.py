from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_trainer
from ..models import Payment, TrainingSession, User
from ..schemas import AnalyticsOut, ClientAttendance, MonthlyRevenue
from ..services import current_package

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("", response_model=AnalyticsOut)
def analytics(
    _trainer: User = Depends(require_trainer),
    db: Session = Depends(get_db),
):
    clients = list(db.scalars(select(User).where(User.role == "client")))

    # attendance rate per client (done vs missed)
    counts: dict = defaultdict(lambda: {"done": 0, "missed": 0})
    for s in db.scalars(select(TrainingSession)):
        if s.status == "done":
            counts[s.client_id]["done"] += 1
        elif s.status == "missed":
            counts[s.client_id]["missed"] += 1

    attendance = []
    for c in clients:
        d = counts[c.id]["done"]
        m = counts[c.id]["missed"]
        rate = round(d / (d + m), 3) if (d + m) else None
        attendance.append(
            ClientAttendance(client_id=c.id, name=c.name, done=d, missed=m, attendance_rate=rate)
        )

    # monthly revenue = sum of payments grouped by YYYY-MM
    by_month: dict = defaultdict(float)
    for p in db.scalars(select(Payment)):
        by_month[p.date.strftime("%Y-%m")] += p.amount
    monthly_revenue = [
        MonthlyRevenue(month=k, total=round(v, 2)) for k, v in sorted(by_month.items())
    ]

    # clients on their last session or with 0 left
    low = 0
    for c in clients:
        pkg = current_package(db, c.id)
        if pkg is not None and pkg.sessions_remaining <= 1:
            low += 1

    return AnalyticsOut(
        active_clients=len(clients),
        clients_last_session_or_zero=low,
        attendance=sorted(attendance, key=lambda a: a.name),
        monthly_revenue=monthly_revenue,
    )
