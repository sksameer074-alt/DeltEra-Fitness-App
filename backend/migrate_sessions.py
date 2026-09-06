"""One-time backfill for features B1/B2/B3 (session generation, status
lifecycle, UTC session instants).

    cd backend
    DATABASE_URL="postgresql://postgres:...@db.xxxx.supabase.co:5432/postgres" \
      .venv/bin/python migrate_sessions.py

What it does (idempotent — safe to re-run):
  1. Adds the new columns if missing: sessions.starts_at, sessions.auto_generated,
     sessions.notes, users.timezone (Postgres only — SQLite dev DBs are recreated
     from models, not migrated).
  2. Widens the sessions.status check to the new values.
  3. sessions.status 'done'  ->  'completed'.
  4. sessions.starts_at (where NULL): recovers the time from the client's weekly
     `schedules` entry for that weekday (IST); falls back to 12:00 IST. Stores the
     UTC instant. `date` is left unchanged.

The local SQLite smoke-test DB does not need this — `Base.metadata.create_all`
builds the current schema directly.
"""
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./deltera_local.sqlite")

from datetime import datetime, timezone  # noqa: E402

from sqlalchemy import select, text  # noqa: E402

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.models import Schedule, TrainingSession  # noqa: E402
from app.timeutil import IST  # noqa: E402

PG_ALTERS = [
    "alter table sessions add column if not exists starts_at timestamptz",
    "alter table sessions add column if not exists auto_generated boolean not null default false",
    "alter table sessions add column if not exists notes text",
    "alter table users add column if not exists timezone text",
    "alter table sessions drop constraint if exists sessions_status_check",
    "alter table sessions add constraint sessions_status_check "
    "check (status in ('upcoming','needs_review','completed','missed'))",
]


def main() -> None:
    Base.metadata.create_all(bind=engine)  # fresh DB: nothing else to do

    if engine.dialect.name == "postgresql":
        with engine.begin() as conn:
            for stmt in PG_ALTERS:
                conn.execute(text(stmt))
        print("postgres: columns + status constraint updated")

    db = SessionLocal()
    try:
        renamed = 0
        for s in db.scalars(select(TrainingSession).where(TrainingSession.status == "done")):
            s.status = "completed"
            renamed += 1

        sched_by_client: dict = {}
        for sch in db.scalars(select(Schedule)):
            sched_by_client.setdefault(sch.client_id, {})[sch.day_of_week] = sch.time

        filled = 0
        for s in db.scalars(
            select(TrainingSession).where(TrainingSession.starts_at.is_(None))
        ):
            hhmm = sched_by_client.get(s.client_id, {}).get(s.date.weekday(), "12:00")
            h, m = (int(x) for x in hhmm.split(":"))
            s.starts_at = datetime(
                s.date.year, s.date.month, s.date.day, h, m, tzinfo=IST
            ).astimezone(timezone.utc)
            filled += 1

        db.commit()
        print(f"migrated: {renamed} status done->completed, {filled} starts_at backfilled")
    finally:
        db.close()


if __name__ == "__main__":
    main()
