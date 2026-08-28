from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_trainer
from ..models import Announcement, User
from ..schemas import AnnouncementIn, AnnouncementOut

router = APIRouter(prefix="/announcements", tags=["announcements"])


@router.get("/latest", response_model=AnnouncementOut | None)
def latest_announcement(
    _user: User = Depends(get_current_user),  # any signed-in user
    db: Session = Depends(get_db),
):
    return db.scalar(select(Announcement).order_by(Announcement.created_at.desc()).limit(1))


@router.get("", response_model=list[AnnouncementOut])
def list_announcements(
    _trainer: User = Depends(require_trainer),
    db: Session = Depends(get_db),
):
    return list(db.scalars(select(Announcement).order_by(Announcement.created_at.desc())))


@router.post("", response_model=AnnouncementOut, status_code=201)
def post_announcement(
    payload: AnnouncementIn,
    _trainer: User = Depends(require_trainer),
    db: Session = Depends(get_db),
):
    row = Announcement(
        message=payload.message, created_at=datetime.now(timezone.utc)
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
