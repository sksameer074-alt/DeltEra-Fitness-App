import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_trainer
from ..models import Payment, User
from ..schemas import PaymentIn, PaymentOut

# Trainer-only. No path here is reachable by a client (all require_trainer).
router = APIRouter(prefix="/clients/{client_id}/payments", tags=["payments"])


def _client_or_404(client_id: uuid.UUID, db: Session) -> User:
    user = db.get(User, client_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return user


@router.get("", response_model=list[PaymentOut])
def list_payments(
    client_id: uuid.UUID,
    _trainer: User = Depends(require_trainer),
    db: Session = Depends(get_db),
):
    _client_or_404(client_id, db)
    return list(
        db.scalars(
            select(Payment).where(Payment.client_id == client_id).order_by(Payment.date.desc())
        )
    )


@router.post("", response_model=PaymentOut, status_code=201)
def add_payment(
    client_id: uuid.UUID,
    payload: PaymentIn,
    _trainer: User = Depends(require_trainer),
    db: Session = Depends(get_db),
):
    _client_or_404(client_id, db)
    row = Payment(
        client_id=client_id,
        amount=payload.amount,
        method=payload.method,
        date=payload.date or date.today(),
        notes=payload.notes,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payment(
    client_id: uuid.UUID,
    payment_id: uuid.UUID,
    _trainer: User = Depends(require_trainer),
    db: Session = Depends(get_db),
):
    row = db.get(Payment, payment_id)
    if row is None or row.client_id != client_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    db.delete(row)
    db.commit()
