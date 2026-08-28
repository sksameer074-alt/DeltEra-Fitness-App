from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import load_accessible_client, require_trainer
from ..models import Package, User
from ..schemas import PackageCreate, PackageOut
from ..services import current_package

router = APIRouter(prefix="/clients/{client_id}/packages", tags=["packages"])


def _with_trainer_name(db: Session, pkg: Package) -> Package:
    name = None
    if pkg.trainer_id is not None:
        t = db.get(User, pkg.trainer_id)
        name = t.name if t else None
    pkg.trainer_name = name
    return pkg


@router.get("", response_model=list[PackageOut])
def list_packages(
    target: User = Depends(load_accessible_client),  # trainer any / client self
    db: Session = Depends(get_db),
):
    rows = list(
        db.scalars(
            select(Package)
            .where(Package.client_id == target.id)
            .order_by(Package.created_at.desc(), Package.id.desc())
        )
    )
    return [_with_trainer_name(db, p) for p in rows]


@router.get("/current", response_model=PackageOut | None)
def get_current_package(
    target: User = Depends(load_accessible_client),
    db: Session = Depends(get_db),
):
    pkg = current_package(db, target.id)
    return _with_trainer_name(db, pkg) if pkg else None


@router.post("", response_model=PackageOut, status_code=201)
def create_or_renew_package(
    payload: PackageCreate,
    target: User = Depends(load_accessible_client),
    trainer: User = Depends(require_trainer),  # trainer enters the number purchased
    db: Session = Depends(get_db),
):
    pkg = Package(
        client_id=target.id,
        trainer_id=trainer.id,
        total_sessions=payload.total_sessions,
        sessions_used=0,
        start_date=payload.start_date or date.today(),
        # explicit microsecond timestamp so "newest package" ordering is deterministic
        created_at=datetime.now(timezone.utc),
    )
    db.add(pkg)
    db.commit()
    db.refresh(pkg)
    return _with_trainer_name(db, pkg)
