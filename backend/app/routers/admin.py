from fastapi import APIRouter, Depends, Query

from ..deps import require_trainer
from ..models import User
from ..schemas import PurgeResult
from ..services import purge_old_diet_photos

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
