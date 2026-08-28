import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import load_accessible_client, require_trainer
from ..models import Supplement, User
from ..schemas import SupplementIn, SupplementOut, SupplementUpdate

router = APIRouter(prefix="/clients/{client_id}/supplements", tags=["supplements"])


@router.get("", response_model=list[SupplementOut])
def list_supplements(
    target: User = Depends(load_accessible_client),  # trainer any / client self
    db: Session = Depends(get_db),
):
    return list(
        db.scalars(
            select(Supplement)
            .where(Supplement.client_id == target.id)
            .order_by(Supplement.name)
        )
    )


@router.post("", response_model=SupplementOut, status_code=status.HTTP_201_CREATED)
def add_supplement(
    payload: SupplementIn,
    target: User = Depends(load_accessible_client),
    _trainer: User = Depends(require_trainer),
    db: Session = Depends(get_db),
):
    row = Supplement(client_id=target.id, **payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{supp_id}", response_model=SupplementOut)
def edit_supplement(
    supp_id: uuid.UUID,
    payload: SupplementUpdate,
    target: User = Depends(load_accessible_client),
    _trainer: User = Depends(require_trainer),
    db: Session = Depends(get_db),
):
    row = db.get(Supplement, supp_id)
    if row is None or row.client_id != target.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplement not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{supp_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_supplement(
    supp_id: uuid.UUID,
    target: User = Depends(load_accessible_client),
    _trainer: User = Depends(require_trainer),
    db: Session = Depends(get_db),
):
    row = db.get(Supplement, supp_id)
    if row is None or row.client_id != target.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplement not found")
    db.delete(row)
    db.commit()
