from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, load_accessible_client, require_trainer
from ..models import User
from ..schemas import ChangePasswordIn, MeUpdate, UserOut
from ..security import hash_password, verify_password
from ..services import attach_package_brief

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def read_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return attach_package_brief(db, current_user)


@router.patch("/me", response_model=UserOut)
def update_me(
    payload: MeUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Self-service: a user can set their own profile photo and feeling note."""
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return attach_package_brief(db, current_user)


@router.post("/me/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_my_password(
    payload: ChangePasswordIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect"
        )
    current_user.password = hash_password(payload.new_password)
    db.commit()


@router.get("", response_model=list[UserOut])
def list_clients(
    search: str | None = Query(default=None, description="match name or phone number"),
    _trainer: User = Depends(require_trainer),
    db: Session = Depends(get_db),
):
    """Trainer-only: searchable list of every client (with package alert info)."""
    stmt = select(User).where(User.role == "client")
    if search:
        like = f"%{search.strip()}%"
        stmt = stmt.where(or_(User.name.ilike(like), User.phone_number.ilike(like)))
    clients = list(db.scalars(stmt.order_by(User.name)))
    return [attach_package_brief(db, c) for c in clients]


@router.get("/{client_id}", response_model=UserOut)
def read_user(
    target: User = Depends(load_accessible_client),
    db: Session = Depends(get_db),
):
    return attach_package_brief(db, target)
