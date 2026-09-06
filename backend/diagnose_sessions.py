"""READ-ONLY diagnostic for the sessions table on production. Changes nothing.

    cd backend
    DATABASE_URL="postgresql://postgres:...@db.xxxx.supabase.co:5432/postgres" \
      .venv/bin/python diagnose_sessions.py

Prints:
  1. every distinct `status` value and its row count
  2. which of the new columns already exist (starts_at, auto_generated, notes)
  3. the current CHECK constraint definition(s) on the table
  4. whether users.timezone / users.landing_content exist
"""
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./deltera_local.sqlite")

from sqlalchemy import text  # noqa: E402

from app.database import engine  # noqa: E402

Q_STATUS = "select status, count(*) as n from sessions group by status order by n desc"
Q_COLUMNS = (
    "select column_name from information_schema.columns "
    "where table_schema = 'public' and table_name = :t order by column_name"
)
Q_CONSTRAINTS = (
    "select conname, pg_get_constraintdef(oid) as cdef from pg_constraint "
    "where conrelid = 'public.sessions'::regclass and contype = 'c'"
)


def main() -> None:
    with engine.connect() as conn:
        print("=== sessions.status value counts ===")
        for row in conn.execute(text(Q_STATUS)):
            print(f"  {row.status!r:20} {row.n}")

        if engine.dialect.name != "postgresql":
            print("\n(not postgres — skipping schema introspection)")
            return

        print("\n=== sessions columns present ===")
        cols = [r[0] for r in conn.execute(text(Q_COLUMNS), {"t": "sessions"})]
        print("  ", cols)
        for c in ("starts_at", "auto_generated", "notes"):
            print(f"  {c:16} {'PRESENT' if c in cols else 'missing'}")

        print("\n=== CHECK constraints on sessions ===")
        for row in conn.execute(text(Q_CONSTRAINTS)):
            print(f"  {row.conname}: {row.cdef}")

        print("\n=== users columns of interest ===")
        ucols = [r[0] for r in conn.execute(text(Q_COLUMNS), {"t": "users"})]
        for c in ("timezone", "landing_content", "bio", "credentials",
                  "total_clients_stat", "total_transformations_stat", "total_sessions_stat"):
            print(f"  {c:28} {'PRESENT' if c in ucols else 'missing'}")


if __name__ == "__main__":
    main()
