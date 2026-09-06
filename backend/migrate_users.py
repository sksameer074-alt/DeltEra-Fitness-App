"""One-time backfill for the `users` table columns added during the
landing-page / trainer-content / timezone work (commits 4813a41, e6e05a5,
e172bdb).

`Base.metadata.create_all()` only creates missing *tables*, never missing
*columns* on an existing table — so these were never applied to the live
Supabase database, and the API now 500s with:

    column users.landing_content does not exist

    cd backend
    DATABASE_URL="postgresql://postgres:...@db.xxxx.supabase.co:5432/postgres" \
      .venv/bin/python migrate_users.py

Idempotent — safe to re-run. Every statement is `ADD COLUMN IF NOT EXISTS`
with a nullable / defaulted type, so existing rows are untouched.

NOTE: this covers the `users` table only. The `sessions` table changes
(starts_at, auto_generated, notes, widened status check, 'done'->'completed')
are handled by migrate_sessions.py — run that one too if you haven't.
"""
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./deltera_local.sqlite")

from sqlalchemy import text  # noqa: E402

from app.database import Base, engine  # noqa: E402

# (column name, DDL type clause). Order matches models.User.
EXPECTED_COLUMNS = [
    ("bio", "text"),
    ("credentials", "text"),
    ("total_clients_stat", "integer"),
    ("total_transformations_stat", "integer"),
    ("total_sessions_stat", "integer"),
    ("landing_content", "jsonb not null default '{}'::jsonb"),
    ("timezone", "text"),
]


def main() -> None:
    Base.metadata.create_all(bind=engine)  # fresh DB: nothing else to do

    if engine.dialect.name != "postgresql":
        print("not postgres — SQLite dev DBs are rebuilt from models, nothing to do")
        return

    with engine.begin() as conn:
        live = {
            r[0]
            for r in conn.execute(
                text(
                    "select column_name from information_schema.columns "
                    "where table_name = 'users' and table_schema = 'public'"
                )
            )
        }
        missing = [c for c, _ in EXPECTED_COLUMNS if c not in live]
        print("users columns already present:", sorted(live))
        print("users columns MISSING from production:", missing or "(none)")

        for col, ddl in EXPECTED_COLUMNS:
            stmt = f"alter table users add column if not exists {col} {ddl}"
            print("  ->", stmt)
            conn.execute(text(stmt))

    print("done — users table matches the model")


if __name__ == "__main__":
    main()
