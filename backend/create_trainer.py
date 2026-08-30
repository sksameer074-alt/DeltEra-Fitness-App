"""Create (or update) the single trainer account — OUTSIDE the public signup flow.

Public signup always creates role="client" (the API hardcodes it and ignores any
`role` in the request body). Use this script once to create your trainer login.

Local (SQLite dev DB):

    cd backend
    DATABASE_URL="sqlite:///./deltera_local.sqlite" \
      .venv/bin/python create_trainer.py --name "Salman" --phone 9000000001 --password "trainer1"

Hosted (Supabase) — point DATABASE_URL at the Supabase connection string:

    cd backend
    DATABASE_URL="postgresql://postgres:PASSWORD@db.xxxx.supabase.co:5432/postgres" \
      .venv/bin/python create_trainer.py --name "Your Name" --phone 9000000001 --password "a-strong-password"

Re-running with a phone number that already exists updates that account's name +
password and makes sure its role is "trainer". It never touches any other user,
so the existing trainer keeps working exactly as before.

Prefer the Supabase SQL editor / can't reach the DB from your machine? Add --sql
to print a ready-to-paste INSERT with a correctly-hashed password instead of
connecting to anything:

    .venv/bin/python create_trainer.py --name "Your Name" --phone 9000000001 --password "…" --sql
"""
import argparse
import os
import re
import sys

# Let --sql run without a real database configured. A real DATABASE_URL in the
# environment always wins over this fallback.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from app.security import hash_password


def main() -> None:
    parser = argparse.ArgumentParser(description="Create or update the trainer account.")
    parser.add_argument("--name", required=True)
    parser.add_argument("--phone", required=True, help="exactly 10 digits")
    parser.add_argument("--password", required=True, help="at least 6 characters")
    parser.add_argument(
        "--sql",
        action="store_true",
        help="print an INSERT statement (with the bcrypt hash) instead of touching the DB",
    )
    args = parser.parse_args()

    if not re.fullmatch(r"\d{10}", args.phone):
        sys.exit("phone must be exactly 10 digits (numbers only)")
    if len(args.password) < 6:
        sys.exit("password must be at least 6 characters")

    hashed = hash_password(args.password)

    if args.sql:
        name = args.name.replace("'", "''")
        print(
            "-- Run in the Supabase SQL editor. Re-run-safe: updates on phone conflict.\n"
            "insert into users (name, phone_number, password, role)\n"
            f"values ('{name}', '{args.phone}', '{hashed}', 'trainer')\n"
            "on conflict (phone_number) do update\n"
            "  set name = excluded.name, password = excluded.password, role = 'trainer';"
        )
        return

    # Import here so --sql works even without a reachable DATABASE_URL.
    from app.database import SessionLocal
    from app.models import User

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.phone_number == args.phone).one_or_none()
        if user is None:
            user = User(
                name=args.name,
                phone_number=args.phone,
                role="trainer",
                password=hashed,
            )
            db.add(user)
            action = "created"
        else:
            user.name = args.name
            user.role = "trainer"
            user.password = hashed
            action = "updated"
        db.commit()
        print(f"Trainer {action}: {args.name} ({args.phone})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
