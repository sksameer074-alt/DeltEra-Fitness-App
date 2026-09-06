import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import load_accessible_client, require_trainer
from ..models import TrainingSession, User
from ..schemas import SessionCreate, SessionOut, SessionUpdate, WeekSummary
from ..services import adjust_package_usage, session_completed_delta
from ..timeutil import IST

router = APIRouter(prefix="/clients/{client_id}/sessions", tags=["sessions"])

_OPEN = ("upcoming", "needs_review")  # not yet decided


def _client_sessions(db: Session, client_id: uuid.UUID):
    return list(
        db.scalars(
            select(TrainingSession)
            .where(TrainingSession.client_id == client_id)
            .order_by(TrainingSession.date, TrainingSession.starts_at, TrainingSession.id)
        )
    )


def _get_owned(db: Session, session_id: uuid.UUID, client_id: uuid.UUID) -> TrainingSession:
    row = db.get(TrainingSession, session_id)
    if row is None or row.client_id != client_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return row


def _ist_instant(d: date, hhmm: str) -> datetime:
    """IST calendar date + "HH:MM" IST -> UTC instant."""
    h, m = (int(x) for x in hhmm.split(":"))
    return datetime(d.year, d.month, d.day, h, m, tzinfo=IST).astimezone(timezone.utc)


@router.get("", response_model=list[SessionOut])
def list_sessions(
    target: User = Depends(load_accessible_client),  # trainer any / client self
    db: Session = Depends(get_db),
):
    return _client_sessions(db, target.id)


@router.get("/summary", response_model=WeekSummary)
def week_summary(
    target: User = Depends(load_accessible_client),
    db: Session = Depends(get_db),
):
    today = date.today()
    week_start = today - timedelta(days=today.weekday())  # Monday
    week_end = week_start + timedelta(days=6)  # Sunday

    all_sessions = _client_sessions(db, target.id)
    this_week = [s for s in all_sessions if week_start <= s.date <= week_end]

    completed = sum(1 for s in this_week if s.status == "completed")
    needs_review = sum(1 for s in this_week if s.status == "needs_review")
    missed = sum(1 for s in this_week if s.status == "missed")
    upcoming = sum(1 for s in this_week if s.status == "upcoming")
    remaining = sum(1 for s in this_week if s.status in _OPEN and s.date >= today)

    next_session = next(
        (s for s in all_sessions if s.status == "upcoming" and s.date >= today), None
    )

    return WeekSummary(
        week_start=week_start,
        week_end=week_end,
        completed=completed,
        needs_review=needs_review,
        missed=missed,
        upcoming=upcoming,
        remaining=remaining,
        total=len(this_week),
        sessions=this_week,
        next_session=next_session,
    )


@router.post("", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def create_session(
    payload: SessionCreate,
    target: User = Depends(load_accessible_client),
    _trainer: User = Depends(require_trainer),
    db: Session = Depends(get_db),
):
    data = payload.model_dump()
    hhmm = data.pop("time", None)
    starts_at = _ist_instant(data["date"], hhmm) if hhmm else None

    row = TrainingSession(
        client_id=target.id, starts_at=starts_at, auto_generated=False, **data
    )
    db.add(row)
    # a session created straight into "completed" also counts against the package
    adjust_package_usage(db, target.id, session_completed_delta(None, row.status))
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{session_id}", response_model=SessionOut)
def update_session(
    session_id: uuid.UUID,
    payload: SessionUpdate,
    target: User = Depends(load_accessible_client),
    _trainer: User = Depends(require_trainer),
    db: Session = Depends(get_db),
):
    row = _get_owned(db, session_id, target.id)
    old_status = row.status

    fields = payload.model_dump(exclude_unset=True)
    hhmm = fields.pop("time", None)
    for field, value in fields.items():
        setattr(row, field, value)

    # If date or time changed, recompute the concrete UTC instant.
    if hhmm is not None or "date" in fields:
        eff_time = hhmm
        if eff_time is None and row.starts_at is not None:
            eff_time = row.starts_at.astimezone(IST).strftime("%H:%M")
        if eff_time:
            row.starts_at = _ist_instant(row.date, eff_time)

    # Package bookkeeping: completed -> +1 used, un-completed -> -1 used.
    adjust_package_usage(
        db, target.id, session_completed_delta(old_status, row.status)
    )

    db.commit()
    db.refresh(row)
    return row


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    session_id: uuid.UUID,
    target: User = Depends(load_accessible_client),
    _trainer: User = Depends(require_trainer),
    db: Session = Depends(get_db),
):
    row = _get_owned(db, session_id, target.id)
    adjust_package_usage(db, target.id, session_completed_delta(row.status, None))
    db.delete(row)
    db.commit()
