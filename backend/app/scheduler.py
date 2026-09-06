"""Background jobs that run inside the API process (APScheduler)."""
import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from .services import (
    flip_due_sessions_to_review,
    generate_sessions_from_schedules,
    purge_old_diet_photos,
)

log = logging.getLogger("deltera.scheduler")

scheduler = BackgroundScheduler(timezone="UTC")


def _daily_diet_purge() -> None:
    purge_old_diet_photos(older_than_hours=24.0)


def _daily_session_generation() -> None:
    generate_sessions_from_schedules()


def _session_review_flip() -> None:
    flip_due_sessions_to_review()


def start_scheduler() -> None:
    if scheduler.running:
        return

    # every day at 03:00 UTC — clear diet photos older than 24h
    scheduler.add_job(
        _daily_diet_purge,
        CronTrigger(hour=3, minute=0),
        id="diet_photo_purge",
        replace_existing=True,
    )
    # every day at 02:30 UTC — generate sessions from the weekly templates
    scheduler.add_job(
        _daily_session_generation,
        CronTrigger(hour=2, minute=30),
        id="session_generation",
        replace_existing=True,
    )
    # every 20 minutes — flip past-due 'upcoming' sessions to 'needs_review'
    scheduler.add_job(
        _session_review_flip,
        CronTrigger(minute="*/20"),
        id="session_review_flip",
        replace_existing=True,
    )

    scheduler.start()
    log.info(
        "scheduler started — diet purge 03:00 UTC, session generation 02:30 UTC, "
        "review-flip every 20 min"
    )

    # Run generation + review-flip once at boot so a fresh deploy isn't empty
    # until the next cron tick.
    try:
        generate_sessions_from_schedules()
        flip_due_sessions_to_review()
    except Exception:  # pragma: no cover - never block startup on a job
        log.exception("startup session job failed")


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        log.info("scheduler stopped")
