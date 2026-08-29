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
"""
import argparse
import re
import sys

from app.database import SessionLocal
from app.models import User
from app.security import hash_password


def main() -> None:
    parser = argparse.ArgumentParser(description="Create or update the trainer account.")
    parser.add_argument("--name", required=True)
    parser.add_argument("--phone", required=True, help="exactly 10 digits")
    parser.add_argument("--password", required=True, help="at least 6 characters")
    args = parser.parse_args()

    if not re.fullmatch(r"\d{10}", args.phone):
        sys.exit("phone must be exactly 10 digits (numbers only)")
    if len(args.password) < 6:
        sys.exit("password must be at least 6 characters")

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.phone_number == args.phone).one_or_none()
        if user is None:
            user = User(
                name=args.name,
                phone_number=args.phone,
                role="trainer",
                password=hash_password(args.password),
            )
            db.add(user)
            action = "created"
        else:
            user.name = args.name
            user.role = "trainer"
            user.password = hash_password(args.password)
            action = "updated"
        db.commit()
        print(f"Trainer {action}: {args.name} ({args.phone})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
