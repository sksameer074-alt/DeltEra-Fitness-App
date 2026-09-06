from fastapi import APIRouter, Depends, Query

from ..deps import require_trainer
from ..models import User
from ..schemas import PurgeResult
from ..services import (
    flip_due_sessions_to_review,
    generate_sessions_from_schedules,
    purge_old_diet_photos,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/purge-diet-photos", response_model=PurgeResult)
def run_diet_photo_purge(
    older_than_hours: float = Query(
        default=24.0,
        ge=0,
        description="Clear photos last updated more than this many hours ago. "
        "Pass 0 to clear everything now (for testing).",
    ),
    _trainer: User = Depends(require_trainer),
):
    """Manually run the 24h diet-photo purge job once (same logic as the daily job)."""
    cleared = purge_old_diet_photos(older_than_hours=older_than_hours)
    return PurgeResult(cleared=cleared, older_than_hours=older_than_hours)


@router.post("/generate-sessions")
def run_session_generation(
    days_ahead: int = Query(default=14, ge=1, le=60),
    _trainer: User = Depends(require_trainer),
):
    """Manually run the daily session-generation job once (same logic)."""
    created = generate_sessions_from_schedules(days_ahead=days_ahead)
    return {"created": created, "days_ahead": days_ahead}


@router.post("/flip-due-sessions")
def run_session_review_flip(_trainer: User = Depends(require_trainer)):
    """Manually run the review-flip job once (upcoming -> needs_review when past due)."""
    flipped = flip_due_sessions_to_review()
    return {"flipped": flipped}
