"""Shared business logic that spans routers."""
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Package, User


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
