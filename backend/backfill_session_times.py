"""One-time backfill of sessions.starts_at from the weekly schedules template.

Historically a session row stored only a bare `date`; the time-of-day lived on
the client's `schedules` template (day_of_week + time, authored in IST). This
fills in `starts_at` (UTC timestamptz) for every session that still has NULL.

    cd backend

    # 1. DRY RUN (default) — prints every change it *would* make, writes nothing
    DATABASE_URL="postgresql://postgres:...@db.xxxx.supabase.co:5432/postgres" \
      .venv/bin/python backfill_session_times.py

    # 2. After reviewing the dry run, actually write:
    DATABASE_URL="postgresql://postgres:...@db.xxxx.supabase.co:5432/postgres" \
      .venv/bin/python backfill_session_times.py --commit

Rules:
  * For each session with starts_at IS NULL: find the client's schedule entry
    whose day_of_week matches the session date's weekday (0=Mon..6=Sun).
    starts_at = (session.date @ schedule.time, interpreted as IST) -> UTC.
  * No schedule entry for that client+weekday  -> NOT guessed. Listed at the
    end as "no matching schedule" with the session id.
  * More than one schedule entry for that client+weekday (ambiguous time)
    -> NOT guessed. Listed as "ambiguous" with the candidate times.
  * Only unambiguous, single-match rows are written.

Idempotent: re-running only looks at rows that are still NULL.
"""
import os
import sys

os.environ.setdefault("DATABASE_URL", "sqlite:///./deltera_local.sqlite")

from collections import defaultdict  # noqa: E402
from datetime import datetime, timezone  # noqa: E402

from sqlalchemy import select  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.models import Schedule, TrainingSession  # noqa: E402
from app.timeutil import IST  # noqa: E402

WEEKDAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def _ist_to_utc(d, hhmm: str) -> datetime:
    h, m = (int(x) for x in hhmm.split(":"))
    return datetime(d.year, d.month, d.day, h, m, tzinfo=IST).astimezone(timezone.utc)


def main(commit: bool) -> None:
    db = SessionLocal()
    try:
        # client_id -> { day_of_week -> [time, ...] }
        sched: dict = defaultdict(lambda: defaultdict(list))
        for s in db.scalars(select(Schedule)):
            sched[s.client_id][s.day_of_week].append(s.time)

        rows = list(
            db.scalars(
                select(TrainingSession)
                .where(TrainingSession.starts_at.is_(None))
                .order_by(TrainingSession.date)
            )
        )
        print(f"{len(rows)} session row(s) with starts_at IS NULL\n")

        to_write = []          # (session, utc_dt, hhmm)
        no_schedule = []       # session
        ambiguous = []         # (session, [times])

        for sess in rows:
            dow = sess.date.weekday()  # 0=Mon..6=Sun, matches Schedule.day_of_week
            times = sched.get(sess.client_id, {}).get(dow, [])
            if not times:
                no_schedule.append(sess)
            elif len(set(times)) > 1:
                ambiguous.append((sess, sorted(set(times))))
            else:
                hhmm = times[0]
                to_write.append((sess, _ist_to_utc(sess.date, hhmm), hhmm))

        print("=== WILL SET ===")
        for sess, utc_dt, hhmm in to_write:
            print(
                f"  session {sess.id}  client {sess.client_id}  "
                f"{sess.date} ({WEEKDAY[sess.date.weekday()]})  "
                f"{hhmm} IST  ->  starts_at = {utc_dt.isoformat()}"
            )
        if not to_write:
            print("  (none)")

        if ambiguous:
            print("\n=== AMBIGUOUS — multiple schedule times for that weekday, NOT changed ===")
            for sess, times in ambiguous:
                print(
                    f"  session {sess.id}  client {sess.client_id}  "
                    f"{sess.date} ({WEEKDAY[sess.date.weekday()]})  candidates: {', '.join(times)}"
                )

        if no_schedule:
            print("\n=== NO MATCHING SCHEDULE — likely manual one-offs, NOT changed ===")
            for sess in no_schedule:
                print(
                    f"  session {sess.id}  client {sess.client_id}  "
                    f"{sess.date} ({WEEKDAY[sess.date.weekday()]})  status={sess.status}"
                )

        print(
            f"\nsummary: {len(to_write)} to set, {len(ambiguous)} ambiguous, "
            f"{len(no_schedule)} no-schedule"
        )

        if not commit:
            print("\nDRY RUN — nothing written. Re-run with --commit to apply the 'WILL SET' rows.")
            return

        for sess, utc_dt, _ in to_write:
            sess.starts_at = utc_dt
        db.commit()
        print(f"\nCOMMITTED — {len(to_write)} row(s) updated.")
    finally:
        db.close()


if __name__ == "__main__":
    main(commit="--commit" in sys.argv[1:])
