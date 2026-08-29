import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, engine
from .models import (  # noqa: F401  (register models before create_all)
    Announcement,
    DietPhoto,
    MealPlan,
    Note,
    Package,
    Payment,
    ProgressLog,
    Report,
    Schedule,
    Supplement,
    TrainingSession,
    Transformation,
    User,
    WeeklyMeasurement,
)
from .routers import (
    admin,
    analytics,
    announcements,
    auth,
    clients,
    diet_photos,
    meal_plans,
    notes,
    packages,
    payments,
    progress,
    public,
    reports,
    schedules,
    sessions,
    supplements,
    transformations,
    users,
)
from .scheduler import start_scheduler, stop_scheduler

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    start_scheduler()
    try:
        yield
    finally:
        stop_scheduler()


app = FastAPI(title="Delt_era Fitness API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}


for r in (
    auth.router,
    users.router,
    clients.router,
    schedules.router,
    sessions.router,
    meal_plans.router,
    supplements.router,
    notes.router,
    progress.router,
    diet_photos.router,
    reports.router,
    packages.router,
    payments.router,
    analytics.router,
    announcements.router,
    transformations.router,
    public.router,
    admin.router,
):
    app.include_router(r)
