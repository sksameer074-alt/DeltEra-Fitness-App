from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import load_accessible_client, require_trainer
from ..models import Schedule, User
from ..schemas import ScheduleOut, ScheduleReplace

router = APIRouter(prefix="/clients/{client_id}/schedule", tags=["schedules"])


@router.get("", response_model=list[ScheduleOut])
def get_schedule(
    target: User = Depends(load_accessible_client),  # trainer -> any, client -> self
    db: Session = Depends(get_db),
):
    stmt = (
        select(Schedule)
        .where(Schedule.client_id == target.id)
        .order_by(Schedule.day_of_week, Schedule.time)
    )
    return list(db.scalars(stmt))


@router.put("", response_model=list[ScheduleOut])
def replace_schedule(
    payload: ScheduleReplace,
    target: User = Depends(load_accessible_client),
    _trainer: User = Depends(require_trainer),  # only a trainer may edit
    db: Session = Depends(get_db),
):
    db.execute(delete(Schedule).where(Schedule.client_id == target.id))
    for entry in payload.entries:
        db.add(
            Schedule(
                client_id=target.id,
                day_of_week=entry.day_of_week,
                time=entry.time,
            )
        )
    db.commit()

    stmt = (
        select(Schedule)
        .where(Schedule.client_id == target.id)
        .order_by(Schedule.day_of_week, Schedule.time)
    )
    return list(db.scalars(stmt))
