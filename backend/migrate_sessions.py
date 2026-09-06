"""One-time backfill for features B1/B2/B3 (session generation, status
lifecycle, UTC session instants).

    cd backend
    DATABASE_URL="postgresql://postgres:...@db.xxxx.supabase.co:5432/postgres" \
      .venv/bin/python migrate_sessions.py

Fully idempotent. Safe to run against a fresh database OR one left in any
partially-migrated state by an earlier run. Every step is guarded:

  Phase 1 — columns (each its own auto-committed statement, ADD COLUMN IF NOT
            EXISTS, so one failing never rolls back the others):
      sessions.starts_at         timestamptz
      sessions.auto_generated    boolean not null default false
      sessions.notes             text
      users.timezone             text
  (The current Session model adds exactly these three columns over the
  original schema — id/client_id/date/status/workout_details/client_rating/
  client_comment/trainer_rating were always there.)

  Phase 2 — data normalization:
      status 'done' -> 'completed'   (the only unambiguous legacy rename)

  Phase 3 — guard: if any row still has a status outside
      ('upcoming','needs_review','completed','missed'), STOP and print the
      offending values. Nothing further is changed. Decide what each should
      become, add it to STATUS_RENAMES (or fix the rows), and re-run.

  Phase 4 — the status CHECK constraint, LAST, only if needed:
      - not present            -> add it
      - present and correct    -> leave it
      - present but stale      -> drop + re-add

  Phase 5 — sessions.starts_at (where NULL): recover the time from the
      client's weekly `schedules` entry for that weekday (IST), else 12:00
      IST; store the UTC instant. `date` is left unchanged.

The local SQLite smoke-test DB does not need this — Base.metadata.create_all
builds the current schema directly (only phases 2 and 5 apply there).
"""
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./deltera_local.sqlite")

from datetime import datetime, timezone  # noqa: E402

from sqlalchemy import bindparam, select, text  # noqa: E402

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.models import Schedule, TrainingSession  # noqa: E402
from app.timeutil import IST  # noqa: E402

VALID_STATUSES = ("upcoming", "needs_review", "completed", "missed")

# Legacy value -> new value. ONLY unambiguous renames belong here.
STATUS_RENAMES = {"done": "completed"}

ADD_COLUMNS = [
    "alter table sessions add column if not exists starts_at timestamptz",
    "alter table sessions add column if not exists auto_generated boolean not null default false",
    "alter table sessions add column if not exists notes text",
    "alter table users add column if not exists timezone text",
]

CONSTRAINT_NAME = "sessions_status_check"
ADD_CONSTRAINT = (
    f"alter table sessions add constraint {CONSTRAINT_NAME} "
    "check (status in ('upcoming','needs_review','completed','missed'))"
)


class AmbiguousStatus(RuntimeError):
    pass


def _constraint_is_current(definition: str | None) -> bool:
    """True if the existing CHECK covers exactly the new value set."""
    if not definition:
        return False
    return all(f"'{v}'" in definition for v in VALID_STATUSES) and "'done'" not in definition


def _migrate_postgres() -> None:
    # --- Phase 1: columns, each auto-committed on its own ---
    with engine.connect() as conn:
        for stmt in ADD_COLUMNS:
            conn.execute(text(stmt))
            conn.commit()
            print("  column ok:", stmt)

    # --- Phase 2: unambiguous legacy status renames ---
    with engine.begin() as conn:
        for old, new in STATUS_RENAMES.items():
            res = conn.execute(
                text("update sessions set status = :new where status = :old"),
                {"new": new, "old": old},
            )
            if res.rowcount:
                print(f"  status {old!r} -> {new!r}: {res.rowcount} rows")

    # --- Phase 3: guard ---
    with engine.connect() as conn:
        bad = conn.execute(
            text(
                "select status, count(*) as n from sessions "
                "where status not in :ok group by status order by n desc"
            ).bindparams(bindparam("ok", value=list(VALID_STATUSES), expanding=True))
        ).all()
    if bad:
        lines = ", ".join(f"{r.status!r} ({r.n} rows)" for r in bad)
        raise AmbiguousStatus(
            f"sessions has status values outside {VALID_STATUSES}: {lines}. "
            "The CHECK constraint was NOT touched. Decide what each should "
            "become, add it to STATUS_RENAMES (or fix the rows by hand), re-run."
        )

    # --- Phase 4: the CHECK constraint, last ---
    with engine.begin() as conn:
        current = conn.execute(
            text(
                "select pg_get_constraintdef(oid) from pg_constraint "
                "where conrelid = 'public.sessions'::regclass and conname = :n"
            ),
            {"n": CONSTRAINT_NAME},
        ).scalar()

        if current is None:
            conn.execute(text(ADD_CONSTRAINT))
            print(f"  constraint {CONSTRAINT_NAME}: added")
        elif _constraint_is_current(current):
            print(f"  constraint {CONSTRAINT_NAME}: already current, left as is")
        else:
            conn.execute(text(f"alter table sessions drop constraint {CONSTRAINT_NAME}"))
            conn.execute(text(ADD_CONSTRAINT))
            print(f"  constraint {CONSTRAINT_NAME}: replaced (was: {current})")

    print("postgres phases 1-4 complete")


def _backfill() -> None:
    """Phases 2 & 5 via the ORM (also the only path that runs on SQLite)."""
    db = SessionLocal()
    try:
        renamed = 0
        for s in db.scalars(select(TrainingSession).where(TrainingSession.status == "done")):
            s.status = "completed"
            renamed += 1

        # starts_at: only fill rows with a single unambiguous schedule match.
        # Rows with no schedule (manual one-offs) or an ambiguous weekday are
        # left NULL — run backfill_session_times.py to review and decide those.
        sched_by_client: dict = {}
        for sch in db.scalars(select(Schedule)):
            sched_by_client.setdefault(sch.client_id, {}).setdefault(sch.day_of_week, set()).add(sch.time)

        filled = skipped = 0
        for s in db.scalars(select(TrainingSession).where(TrainingSession.starts_at.is_(None))):
            times = sched_by_client.get(s.client_id, {}).get(s.date.weekday(), set())
            if len(times) != 1:
                skipped += 1
                continue
            h, m = (int(x) for x in next(iter(times)).split(":"))
            s.starts_at = datetime(
                s.date.year, s.date.month, s.date.day, h, m, tzinfo=IST
            ).astimezone(timezone.utc)
            filled += 1

        db.commit()
        print(
            f"backfill complete: {renamed} status done->completed, "
            f"{filled} starts_at set, {skipped} left NULL (no/ambiguous schedule "
            f"— see backfill_session_times.py)"
        )
    finally:
        db.close()


def main() -> None:
    Base.metadata.create_all(bind=engine)  # fresh DB: creates missing tables only

    if engine.dialect.name == "postgresql":
        try:
            _migrate_postgres()
        except AmbiguousStatus as e:
            print("\nABORTED — " + str(e))
            raise SystemExit(1)

    _backfill()


if __name__ == "__main__":
    main()
