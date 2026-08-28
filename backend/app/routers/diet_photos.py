import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import load_accessible_client, require_self_client, require_trainer
from ..models import DietPhoto, User
from ..schemas import DietPhotoOut, DietPhotoReviewIn, DietPhotoUpsert

router = APIRouter(prefix="/clients/{client_id}/diet-photos", tags=["diet-photos"])


@router.get("", response_model=list[DietPhotoOut])
def list_diet_photos(
    target: User = Depends(load_accessible_client),  # trainer any / client self
    db: Session = Depends(get_db),
):
    return list(
        db.scalars(
            select(DietPhoto)
            .where(DietPhoto.client_id == target.id)
            .order_by(DietPhoto.date.desc())
        )
    )


@router.put("", response_model=DietPhotoOut)
def upsert_diet_photos(
    payload: DietPhotoUpsert,  # max 10 photos enforced in the schema
    client: User = Depends(require_self_client),  # client-only, self-only
    db: Session = Depends(get_db),
):
    on = payload.date or date.today()
    row = db.scalar(
        select(DietPhoto).where(
            DietPhoto.client_id == client.id, DietPhoto.date == on
        )
    )
    photos = [p.model_dump() for p in payload.photos]
    if row is None:
        row = DietPhoto(client_id=client.id, date=on, photos=photos)
        db.add(row)
    else:
        row.photos = photos
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{entry_id}/review", response_model=DietPhotoOut)
def set_trainer_review(
    entry_id: uuid.UUID,
    payload: DietPhotoReviewIn,
    target: User = Depends(load_accessible_client),
    _trainer: User = Depends(require_trainer),  # trainer-only
    db: Session = Depends(get_db),
):
    """Trainer's daily review: a comment and/or a 1-5 diet-discipline rating."""
    row = db.get(DietPhoto, entry_id)
    if row is None or row.client_id != target.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")

    data = payload.model_dump(exclude_unset=True)
    if "trainer_comment" in data:
        row.trainer_comment = data["trainer_comment"]
        row.trainer_comment_at = datetime.now(timezone.utc)
    if "trainer_diet_rating" in data:
        row.trainer_diet_rating = data["trainer_diet_rating"]

    db.commit()
    db.refresh(row)
    return row
