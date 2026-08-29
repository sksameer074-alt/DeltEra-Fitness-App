"""Shared business logic that spans routers."""
import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import SessionLocal
from .models import DietPhoto, Package, User

purge_log = logging.getLogger("deltera.diet_purge")


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


def session_done_delta(old_status: str | None, new_status: str | None) -> int:
    """+1 when a session becomes done, -1 when it stops being done, else 0."""
    was_done = old_status == "done"
    is_done = new_status == "done"
    if is_done and not was_done:
        return 1
    if was_done and not is_done:
        return -1
    return 0


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
