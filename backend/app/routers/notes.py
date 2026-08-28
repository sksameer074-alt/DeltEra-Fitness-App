import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_trainer
from ..models import Note, User
from ..schemas import NoteIn, NoteOut

# Trainer-only. There is deliberately no path a client can use to read notes:
# every endpoint depends on require_trainer, so a client always gets 403.
router = APIRouter(prefix="/clients/{client_id}/notes", tags=["notes"])


def _client_or_404(client_id: uuid.UUID, db: Session) -> User:
    user = db.get(User, client_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return user


@router.get("", response_model=list[NoteOut])
def list_notes(
    client_id: uuid.UUID,
    _trainer: User = Depends(require_trainer),
    db: Session = Depends(get_db),
):
    _client_or_404(client_id, db)
    return list(
        db.scalars(
            select(Note).where(Note.client_id == client_id).order_by(Note.created_at.desc())
        )
    )


@router.post("", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
def add_note(
    client_id: uuid.UUID,
    payload: NoteIn,
    _trainer: User = Depends(require_trainer),
    db: Session = Depends(get_db),
):
    _client_or_404(client_id, db)
    row = Note(client_id=client_id, note_text=payload.note_text)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(
    client_id: uuid.UUID,
    note_id: uuid.UUID,
    _trainer: User = Depends(require_trainer),
    db: Session = Depends(get_db),
):
    row = db.get(Note, note_id)
    if row is None or row.client_id != client_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    db.delete(row)
    db.commit()
