"""Background jobs that run inside the API process (APScheduler)."""
import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from .services import purge_old_diet_photos

log = logging.getLogger("deltera.scheduler")

scheduler = BackgroundScheduler(timezone="UTC")


def _daily_diet_purge() -> None:
    purge_old_diet_photos(older_than_hours=24.0)


def start_scheduler() -> None:
    if scheduler.running:
        return
    # every day at 03:00 UTC
    scheduler.add_job(
        _daily_diet_purge,
        CronTrigger(hour=3, minute=0),
        id="diet_photo_purge",
        replace_existing=True,
    )
    scheduler.start()
    log.info("scheduler started — diet-photo purge scheduled daily at 03:00 UTC")


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        log.info("scheduler stopped")
