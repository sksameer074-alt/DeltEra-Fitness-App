import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_trainer
from ..models import User
from ..schemas import ClientCreate, ClientUpdate, ResetPasswordIn, UserOut
from ..security import hash_password

router = APIRouter(prefix="/clients", tags=["clients"])


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_client(
    payload: ClientCreate,
    _trainer: User = Depends(require_trainer),
    db: Session = Depends(get_db),
):
    exists = db.scalar(select(User).where(User.phone_number == payload.phone_number))
    if exists:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Phone number already registered",
        )

    data = payload.model_dump(exclude={"password"})
    client = User(**data, role="client", password=hash_password(payload.password))
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


@router.patch("/{client_id}", response_model=UserOut)
def update_client(
    client_id: uuid.UUID,
    payload: ClientUpdate,
    _trainer: User = Depends(require_trainer),
    db: Session = Depends(get_db),
):
    client = db.get(User, client_id)
    if client is None or client.role != "client":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(client, field, value)

    db.commit()
    db.refresh(client)
    return client


@router.post("/{client_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_client_password(
    client_id: uuid.UUID,
    payload: ResetPasswordIn,
    _trainer: User = Depends(require_trainer),  # only a trainer may reset someone else
    db: Session = Depends(get_db),
):
    client = db.get(User, client_id)
    if client is None or client.role != "client":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    client.password = hash_password(payload.new_password)
    db.commit()
