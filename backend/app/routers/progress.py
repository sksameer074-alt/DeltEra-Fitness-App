from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import load_accessible_client, require_self_client
from ..models import ProgressLog, User, WeeklyMeasurement
from ..schemas import (
    ProgressLogIn,
    ProgressLogOut,
    WeeklyMeasurementIn,
    WeeklyMeasurementOut,
)

router = APIRouter(prefix="/clients/{client_id}", tags=["progress"])


# ---- daily weight check-in ----


@router.get("/progress-logs", response_model=list[ProgressLogOut])
def list_progress_logs(
    days: int = 7,
    target: User = Depends(load_accessible_client),  # trainer any / client self
    db: Session = Depends(get_db),
):
    since = date.today() - timedelta(days=max(days, 1) - 1)
    return list(
        db.scalars(
            select(ProgressLog)
            .where(ProgressLog.client_id == target.id, ProgressLog.date >= since)
            .order_by(ProgressLog.date.desc())
        )
    )


@router.post("/progress-logs", response_model=ProgressLogOut)
def log_weight(
    payload: ProgressLogIn,
    client: User = Depends(require_self_client),  # client-only, self-only
    db: Session = Depends(get_db),
):
    on = payload.date or date.today()
    row = db.scalar(
        select(ProgressLog).where(
            ProgressLog.client_id == client.id, ProgressLog.date == on
        )
    )
    if row is None:
        row = ProgressLog(client_id=client.id, weight=payload.weight, date=on)
        db.add(row)
    else:
        row.weight = payload.weight  # once a day -> overwrite today's entry
    db.commit()
    db.refresh(row)
    return row


# ---- weekly measurements ----


def _monday(d: date) -> date:
    return d - timedelta(days=d.weekday())


@router.get("/weekly-measurements", response_model=list[WeeklyMeasurementOut])
def list_measurements(
    target: User = Depends(load_accessible_client),
    db: Session = Depends(get_db),
):
    return list(
        db.scalars(
            select(WeeklyMeasurement)
            .where(WeeklyMeasurement.client_id == target.id)
            .order_by(WeeklyMeasurement.date.desc())
        )
    )


@router.post("/weekly-measurements", response_model=WeeklyMeasurementOut)
def log_measurements(
    payload: WeeklyMeasurementIn,
    client: User = Depends(require_self_client),
    db: Session = Depends(get_db),
):
    on = payload.date or date.today()
    week = _monday(on)

    # one entry per calendar week -> update if this week already has one
    existing = list(
        db.scalars(
            select(WeeklyMeasurement).where(WeeklyMeasurement.client_id == client.id)
        )
    )
    row = next((m for m in existing if _monday(m.date) == week), None)

    fields = payload.model_dump(exclude={"date"}, exclude_unset=True)
    if row is None:
        row = WeeklyMeasurement(client_id=client.id, date=on, **fields)
        db.add(row)
    else:
        row.date = on
        for k, v in fields.items():
            setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row
