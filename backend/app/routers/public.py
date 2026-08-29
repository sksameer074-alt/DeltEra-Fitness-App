from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Transformation, User
from ..schemas import LandingOut, PublicTrainer, TransformationOut

# No authentication — this is the public marketing page.
router = APIRouter(prefix="/public", tags=["public"])


@router.get("/landing", response_model=LandingOut)
def landing(db: Session = Depends(get_db)):
    trainer = db.scalar(
        select(User).where(User.role == "trainer").order_by(User.created_at).limit(1)
    )
    transformations = list(
        db.scalars(select(Transformation).order_by(Transformation.created_at.desc()))
    )

    # The headline stats are the trainer's manually-typed numbers — never counted
    # from the transformations, users, or sessions tables.
    return LandingOut(
        trainer=(
            PublicTrainer(
                name=trainer.name,
                profile_photo_url=trainer.profile_photo_url,
                bio=trainer.bio,
                credentials=trainer.credentials,
            )
            if trainer
            else None
        ),
        transformations=[TransformationOut.model_validate(t) for t in transformations],
        stats={
            "clients": (trainer.total_clients_stat or 0) if trainer else 0,
            "transformations": (trainer.total_transformations_stat or 0) if trainer else 0,
            "sessions": (trainer.total_sessions_stat or 0) if trainer else 0,
        },
    )
