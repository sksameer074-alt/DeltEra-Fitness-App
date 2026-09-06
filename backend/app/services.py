"""Shared business logic that spans routers."""
import logging
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import SessionLocal
from .models import DietPhoto, Package, Schedule, TrainingSession, User
from .timeutil import end_of_ist_day, ist_date_of, occurrences_from_slot, to_utc

purge_log = logging.getLogger("deltera.diet_purge")
gen_log = logging.getLogger("deltera.session_gen")
review_log = logging.getLogger("deltera.session_review")

SESSION_GENERATION_DAYS = 14


def current_package(db: Session, client_id: uuid.UUID) -> Package | None:
    """The client's most recently created package (their active one)."""
    return db.scalar(
        select(Package)
        .where(Package.client_id == client_id)
        .order_by(Package.created_at.desc(), Package.id.desc())
        .limit(1)
    )


def adjust_package_usage(db: Session, client_id: uuid.UUID, delta: int) -> None:
    """Bump sessions_used on the current package. Caller commits.

    Used as a side effect of a session's status changing to / from "done".
    No-op when the client has no package.
    """
    if delta == 0:
        return
    pkg = current_package(db, client_id)
    if pkg is None:
        return
    pkg.sessions_used = max(0, pkg.sessions_used + delta)


def session_completed_delta(old_status: str | None, new_status: str | None) -> int:
    """+1 when a session becomes 'completed', -1 when it stops being, else 0.

    This is what drives package `sessions_used` — a completed session consumes
    one from the client's package.
    """
    was = old_status == "completed"
    now = new_status == "completed"
    if now and not was:
        return 1
    if was and not now:
        return -1
    return 0


def generate_sessions_from_schedules(
    db: Session | None = None,
    *,
    days_ahead: int = SESSION_GENERATION_DAYS,
    now: datetime | None = None,
) -> int:
    """For every client with a weekly `schedules` template, create `sessions`
    rows (status 'upcoming') for the next `days_ahead` days.

    Dedup so repeated runs don't create duplicates:
      - skip a slot whose exact UTC instant already has a session (this also
        means a *cancelled* occurrence — kept as status 'missed' with its
        starts_at — is never regenerated);
      - skip any day that already has a manually-created (non auto_generated)
        session, so a trainer's one-off overrides the template for that day.

    Deleting an auto-generated future session lets it regenerate on the next
    run (that is the intended "reset this day" action — use 'missed' to
    permanently skip one occurrence).
    """
    own_session = db is None
    db = db or SessionLocal()
    try:
        now = now or datetime.now(timezone.utc)
        by_client: dict[uuid.UUID, list[Schedule]] = defaultdict(list)
        for sch in db.scalars(select(Schedule)):
            by_client[sch.client_id].append(sch)

        created = 0
        for client_id, entries in by_client.items():
            existing = list(
                db.scalars(
                    select(TrainingSession).where(TrainingSession.client_id == client_id)
                )
            )
            taken_instants = {
                to_utc(s.starts_at) for s in existing if s.starts_at is not None
            }
            manual_dates = {s.date for s in existing if not s.auto_generated}

            for sch in entries:
                for inst in occurrences_from_slot(
                    sch.day_of_week, sch.time, now=now, days_ahead=days_ahead
                ):
                    ist_date = ist_date_of(inst)
                    if to_utc(inst) in taken_instants or ist_date in manual_dates:
                        continue
                    db.add(
                        TrainingSession(
                            client_id=client_id,
                            date=ist_date,
                            starts_at=inst,
                            status="upcoming",
                            auto_generated=True,
                        )
                    )
                    taken_instants.add(inst)
                    created += 1

        if created:
            db.commit()
        gen_log.info("session generation: created %d session(s)", created)
        return created
    finally:
        if own_session:
            db.close()


def flip_due_sessions_to_review(
    db: Session | None = None, *, now: datetime | None = None
) -> int:
    """Flip every 'upcoming' session whose scheduled time has passed to
    'needs_review'. Never auto-sets completed/missed — the trainer decides.
    """
    own_session = db is None
    db = db or SessionLocal()
    try:
        now = now or datetime.now(timezone.utc)
        rows = list(
            db.scalars(
                select(TrainingSession).where(TrainingSession.status == "upcoming")
            )
        )
        flipped = 0
        for s in rows:
            due = to_utc(s.starts_at) or (end_of_ist_day(s.date) if s.date else None)
            if due is not None and due <= now:
                s.status = "needs_review"
                flipped += 1
        if flipped:
            db.commit()
        review_log.info("session review-flip: %d session(s) -> needs_review", flipped)
        return flipped
    finally:
        if own_session:
            db.close()


def attach_package_brief(db: Session, user: User) -> User:
    """Set user.package (a transient attr) for serialization into UserOut."""
    pkg = current_package(db, user.id)
    if pkg is not None:
        trainer_name = None
        if pkg.trainer_id is not None:
            t = db.get(User, pkg.trainer_id)
            trainer_name = t.name if t else None
        pkg.trainer_name = trainer_name
    user.package = pkg
    return user


def purge_old_diet_photos(older_than_hours: float = 24.0, db: Session | None = None) -> int:
    """Clear photos (and their per-photo notes) from diet_photos entries whose photos
    were last updated more than `older_than_hours` ago.

    Preserves trainer_comment, trainer_comment_at and trainer_diet_rating forever.
    Returns the number of records cleared. Safe to call repeatedly.
    """
    own_session = db is None
    db = db or SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=older_than_hours)
        rows = list(
            db.scalars(
                select(DietPhoto).where(
                    DietPhoto.photos_updated_at.is_not(None),
                    DietPhoto.photos_updated_at < cutoff,
                )
            )
        )
        cleared = 0
        for row in rows:
            if row.photos:  # only count/act on entries that still hold photos
                row.photos = []
                row.photos_updated_at = None
                cleared += 1
        if cleared:
            db.commit()
        purge_log.info(
            "diet-photo purge ran (cutoff=%s h): cleared %d record(s), scanned %d",
            older_than_hours,
            cleared,
            len(rows),
        )
        return cleared
    finally:
        if own_session:
            db.close()
