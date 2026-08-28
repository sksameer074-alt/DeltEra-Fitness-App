import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import load_accessible_client, require_trainer
from ..models import TrainingSession, User
from ..schemas import SessionCreate, SessionOut, SessionUpdate, WeekSummary
from ..services import adjust_package_usage, session_done_delta

router = APIRouter(prefix="/clients/{client_id}/sessions", tags=["sessions"])


def _client_sessions(db: Session, client_id: uuid.UUID):
    return list(
        db.scalars(
            select(TrainingSession)
            .where(TrainingSession.client_id == client_id)
            .order_by(TrainingSession.date, TrainingSession.id)
        )
    )


def _get_owned(db: Session, session_id: uuid.UUID, client_id: uuid.UUID) -> TrainingSession:
    row = db.get(TrainingSession, session_id)
    if row is None or row.client_id != client_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return row


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

    done = sum(1 for s in this_week if s.status == "done")
    missed = sum(1 for s in this_week if s.status == "missed")
    upcoming = sum(1 for s in this_week if s.status == "upcoming")
    remaining = sum(1 for s in this_week if s.status == "upcoming" and s.date >= today)

    next_session = next(
        (s for s in all_sessions if s.status == "upcoming" and s.date >= today), None
    )

    return WeekSummary(
        week_start=week_start,
        week_end=week_end,
        done=done,
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
    row = TrainingSession(client_id=target.id, **payload.model_dump())
    db.add(row)
    # a session created straight into "done" also counts against the package
    adjust_package_usage(db, target.id, session_done_delta(None, row.status))
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

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)

    # Automatic package bookkeeping: done -> +1 used, undo done -> -1 used.
    adjust_package_usage(db, target.id, session_done_delta(old_status, row.status))

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
    adjust_package_usage(db, target.id, session_done_delta(row.status, None))
    db.delete(row)
    db.commit()
