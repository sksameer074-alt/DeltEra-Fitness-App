import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_trainer
from ..models import Transformation, User
from ..schemas import TransformationIn, TransformationOut, TransformationUpdate

# Management is trainer-only. The public read lives in routers/public.py.
router = APIRouter(prefix="/transformations", tags=["transformations"])

# The public gallery must never look empty, so at least this many entries are
# kept at all times. There is no upper limit.
MIN_TRANSFORMATIONS = 2


@router.get("", response_model=list[TransformationOut])
def list_transformations(
    _trainer: User = Depends(require_trainer),
    db: Session = Depends(get_db),
):
    return list(
        db.scalars(select(Transformation).order_by(Transformation.created_at.desc()))
    )


@router.post("", response_model=TransformationOut, status_code=201)
def add_transformation(
    payload: TransformationIn,
    _trainer: User = Depends(require_trainer),
    db: Session = Depends(get_db),
):
    row = Transformation(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{item_id}", response_model=TransformationOut)
def edit_transformation(
    item_id: uuid.UUID,
    payload: TransformationUpdate,
    _trainer: User = Depends(require_trainer),
    db: Session = Depends(get_db),
):
    row = db.get(Transformation, item_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transformation(
    item_id: uuid.UUID,
    _trainer: User = Depends(require_trainer),
    db: Session = Depends(get_db),
):
    row = db.get(Transformation, item_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    total = db.scalar(select(func.count()).select_from(Transformation)) or 0
    if total <= MIN_TRANSFORMATIONS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"At least {MIN_TRANSFORMATIONS} transformations are required — "
                "add another before removing one."
            ),
        )

    db.delete(row)
    db.commit()
