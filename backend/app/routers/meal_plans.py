from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import load_accessible_client, require_trainer
from ..models import MealPlan, User
from ..schemas import MealPlanOut, MealPlanUpdate, word_count

router = APIRouter(prefix="/clients/{client_id}/meal-plan", tags=["meal-plan"])


def _serialize(client_id, row: MealPlan | None) -> MealPlanOut:
    text = row.plan_text if row else ""
    return MealPlanOut(
        client_id=client_id,
        plan_text=text,
        updated_at=row.updated_at if row else None,
        word_count=word_count(text),
    )


@router.get("", response_model=MealPlanOut)
def get_meal_plan(
    target: User = Depends(load_accessible_client),  # trainer any / client self
    db: Session = Depends(get_db),
):
    row = db.scalar(select(MealPlan).where(MealPlan.client_id == target.id))
    return _serialize(target.id, row)


@router.put("", response_model=MealPlanOut)
def write_meal_plan(
    payload: MealPlanUpdate,  # word limit enforced in the schema validator
    target: User = Depends(load_accessible_client),
    _trainer: User = Depends(require_trainer),  # only a trainer may write
    db: Session = Depends(get_db),
):
    row = db.scalar(select(MealPlan).where(MealPlan.client_id == target.id))
    if row is None:
        row = MealPlan(client_id=target.id, plan_text=payload.plan_text)
        db.add(row)
    else:
        row.plan_text = payload.plan_text
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return _serialize(target.id, row)
