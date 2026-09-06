"""Timezone helpers.

The trainer authors the weekly template in IST (fixed UTC+5:30, no DST).
Concrete sessions are stored as UTC instants. Client-side display converts
those UTC instants to the client's own IANA timezone, which IS DST-aware —
that conversion happens on the frontend with Luxon, but the same rules apply
here (zoneinfo) for the session-generation job and for tests.
"""
from datetime import date as dt_date
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, available_timezones

UTC = timezone.utc
IST = ZoneInfo("Asia/Kolkata")
TRAINER_TZ = IST  # the single trainer is in IST


def is_valid_timezone(name: str) -> bool:
    return name in available_timezones()


def to_utc(dt: datetime | None) -> datetime | None:
    """Normalise a datetime to tz-aware UTC.

    SQLite (dev / tests) drops tz info from `DateTime(timezone=True)` columns and
    hands back naive datetimes; we always *write* UTC, so a naive value is
    treated as UTC. Postgres returns aware values untouched.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def ist_hhmm() -> "list[str]":  # pragma: no cover - convenience only
    return [f"{h:02d}:{m:02d}" for h in range(24) for m in (0, 30)]


def _parse_hhmm(hhmm: str) -> tuple[int, int]:
    h, m = hhmm.split(":")
    return int(h), int(m)


def ist_slot_to_utc_instant(day_of_week: int, hhmm: str, on: dt_date) -> datetime:
    """The IST weekly slot (day_of_week 0=Mon..6=Sun, "HH:MM") resolved to a
    concrete UTC instant, for the week containing `on`."""
    h, m = _parse_hhmm(hhmm)
    monday = on - timedelta(days=on.weekday())
    d = monday + timedelta(days=day_of_week)
    local = datetime(d.year, d.month, d.day, h, m, tzinfo=IST)
    return local.astimezone(UTC)


def occurrences_from_slot(
    day_of_week: int, hhmm: str, *, now: datetime, days_ahead: int
) -> "list[datetime]":
    """UTC instants for the given IST weekly slot over [now, now + days_ahead]."""
    out: list[datetime] = []
    start = now.astimezone(IST).date()
    for i in range(days_ahead + 1):
        d = start + timedelta(days=i)
        if d.weekday() != day_of_week:
            continue
        h, m = _parse_hhmm(hhmm)
        inst = datetime(d.year, d.month, d.day, h, m, tzinfo=IST).astimezone(UTC)
        if inst >= now:
            out.append(inst)
    return out


def ist_date_of(instant: datetime) -> dt_date:
    return instant.astimezone(IST).date()


def end_of_ist_day(d: dt_date) -> datetime:
    """23:59 IST on `d`, as a UTC instant — the 'past due' cutoff for a
    legacy date-only session that has no `starts_at`."""
    return datetime.combine(d, time(23, 59), tzinfo=IST).astimezone(UTC)
