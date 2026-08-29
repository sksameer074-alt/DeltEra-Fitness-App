"""Offline smoke test: runs the API against a temporary SQLite DB.

    cd backend && .venv/bin/python smoke_test.py

Covers auth, role-based access control, client CRUD, trainer-entered metrics,
sessions + weekly summary, meal plans, supplements, and trainer-only notes.
"""
import os
import tempfile
from datetime import date, timedelta

os.environ.setdefault("JWT_SECRET", "test-secret-that-is-long-enough-000000")
_db_fd, _db_path = tempfile.mkstemp(suffix=".sqlite")
os.environ["DATABASE_URL"] = f"sqlite:///{_db_path}"

from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402

Base.metadata.create_all(bind=engine)
client = TestClient(app)

_passed = 0


def check(label, cond):
    global _passed
    print(("PASS  " if cond else "FAIL  ") + label)
    assert cond, label
    _passed += 1


def signup(name, phone, pw, role="client"):
    # `role` is intentionally still sent to prove the endpoint ignores it.
    r = client.post(
        "/auth/signup",
        json={"name": name, "phone_number": phone, "password": pw, "role": role},
    )
    assert r.status_code == 201, r.text
    return r.json()


def make_trainer(name, phone, pw):
    """Trainers are created out of band (see backend/create_trainer.py), never
    through public signup. Mirror that here with a direct insert + login."""
    from app.database import SessionLocal
    from app.models import User as _User
    from app.security import hash_password as _hash

    db = SessionLocal()
    db.add(_User(name=name, phone_number=phone, password=_hash(pw), role="trainer"))
    db.commit()
    db.close()
    r = client.post("/auth/login", json={"phone_number": phone, "password": pw})
    assert r.status_code == 200, r.text
    return r.json()


alice = signup("Alice", "1000000001", "secret1", "client")
bob = signup("Bob", "1000000002", "secret2", "client")
tina = make_trainer("Tina", "9000000001", "trainer1")
A_ID, B_ID = alice["user"]["id"], bob["user"]["id"]
ah = {"Authorization": f"Bearer {alice['access_token']}"}
bh = {"Authorization": f"Bearer {bob['access_token']}"}
th = {"Authorization": f"Bearer {tina['access_token']}"}

today = date.today()
monday = today - timedelta(days=today.weekday())

# ---- 0. phone + password validation ----
check("signup rejects a non-10-digit phone (422)",
      client.post("/auth/signup", json={"name": "X", "phone_number": "12345", "password": "secret1"}).status_code == 422)
check("signup rejects a phone with letters (422)",
      client.post("/auth/signup", json={"name": "X", "phone_number": "12345abcde", "password": "secret1"}).status_code == 422)
check("signup rejects a password under 6 chars (422)",
      client.post("/auth/signup", json={"name": "X", "phone_number": "1000000009", "password": "abc"}).status_code == 422)
check("trainer create-client rejects a bad phone (422)",
      client.post("/clients", headers=th, json={"name": "X", "phone_number": "99", "password": "secret1"}).status_code == 422)

# ---- public signup can NEVER create a trainer ----
check("public signup ignores role=client and creates a client", alice["user"]["role"] == "client")
_locked = signup("Mallory", "1000000050", "secret50", "trainer")
check("public signup ignores role=trainer and still creates a client",
      _locked["user"]["role"] == "client")
_raw = client.post(
    "/auth/signup",
    json={"name": "Eve", "phone_number": "1000000051", "password": "secret51", "role": "trainer"},
)
check("a hand-crafted signup body with role=trainer still yields a client",
      _raw.status_code == 201 and _raw.json()["user"]["role"] == "client")
check("the out-of-band trainer account logs in and is a trainer",
      client.post("/auth/login",
                  json={"phone_number": "9000000001", "password": "trainer1"}).json()["user"]["role"] == "trainer")

# ---- auth / access matrix (unchanged rules) ----
check("signup never returns the password", "password" not in alice["user"])
check("wrong password -> 401",
      client.post("/auth/login", json={"phone_number": "1000000001", "password": "x"}).status_code == 401)
check("client CANNOT read another client (403)",
      client.get(f"/users/{B_ID}", headers=ah).status_code == 403)
check("client CANNOT list clients (403)", client.get("/users", headers=ah).status_code == 403)
check("trainer reads any client", client.get(f"/users/{B_ID}", headers=th).status_code == 200)

# ---- 1. metrics are trainer-entered, not calculated ----
check("new client bmi/bmr/tdee default to null",
      alice["user"]["bmi"] is None and alice["user"]["bmr"] is None and alice["user"]["tdee"] is None)
r = client.patch(f"/clients/{A_ID}", headers=th, json={"weight": 60, "height": 165, "age": 30, "sex": "female"})
check("setting weight/height/age/sex does NOT auto-calculate metrics",
      r.json()["bmi"] is None and r.json()["bmr"] is None and r.json()["tdee"] is None)
r = client.patch(f"/clients/{A_ID}", headers=th, json={"bmi": 22.0, "bmr": 1320, "tdee": 2046})
check("trainer can enter metrics", r.json()["bmi"] == 22.0 and r.json()["bmr"] == 1320.0)
check("client can VIEW metrics once set", client.get("/users/me", headers=ah).json()["tdee"] == 2046.0)
check("client CANNOT edit metrics (403)",
      client.patch(f"/clients/{A_ID}", headers=ah, json={"bmi": 99}).status_code == 403)

# ---- 2. sessions ----
def mk_session(offset_days, status="upcoming", details=None):
    r = client.post(
        f"/clients/{A_ID}/sessions", headers=th,
        json={"date": str(monday + timedelta(days=offset_days)), "status": status,
              "workout_details": details},
    )
    assert r.status_code == 201, r.text
    return r.json()

# three sessions inside the current Mon..Sun week
s_mon = mk_session(0)
s_tue = mk_session(1)
s_wed = mk_session(2)

r = client.get(f"/clients/{A_ID}/sessions/summary", headers=ah).json()
check("week summary starts with 0 done", r["done"] == 0 and r["total"] == 3)

# trainer marks outcomes for this week's sessions
client.patch(f"/clients/{A_ID}/sessions/{s_mon['id']}", headers=th, json={"status": "done"})
client.patch(f"/clients/{A_ID}/sessions/{s_tue['id']}", headers=th, json={"status": "missed"})
client.patch(f"/clients/{A_ID}/sessions/{s_wed['id']}", headers=th, json={"status": "done"})
r = client.get(f"/clients/{A_ID}/sessions/summary", headers=ah).json()
check("after marking: done counter updates", r["done"] == 2)
check("after marking: missed counter updates", r["missed"] == 1)

# trainer posts workout details on the next (future) session
future = client.post(
    f"/clients/{A_ID}/sessions", headers=th,
    json={"date": str(today + timedelta(days=1)), "status": "upcoming"},
).json()
r = client.get(f"/clients/{A_ID}/sessions/summary", headers=ah).json()
check("client does NOT see workout_details before it is posted",
      r["next_session"] and r["next_session"]["workout_details"] is None)
client.patch(f"/clients/{A_ID}/sessions/{future['id']}", headers=th,
             json={"workout_details": "Push day: bench 4x8, OHP 3x10"})
r = client.get(f"/clients/{A_ID}/sessions/summary", headers=ah).json()
check("client sees next session's workout_details once posted",
      r["next_session"] and "bench" in r["next_session"]["workout_details"])

check("client CANNOT create a session (403)",
      client.post(f"/clients/{A_ID}/sessions", headers=ah, json={"date": str(today)}).status_code == 403)
check("client CANNOT edit a session (403)",
      client.patch(f"/clients/{A_ID}/sessions/{future['id']}", headers=ah, json={"status": "done"}).status_code == 403)
check("client CANNOT see another client's sessions (403)",
      client.get(f"/clients/{B_ID}/sessions", headers=ah).status_code == 403)

# ---- 3. meal plan (free text, 5000-word cap, trainer-write / client-read) ----
r = client.put(f"/clients/{A_ID}/meal-plan", headers=th, json={"plan_text": "Eat well. " * 3})
check("trainer writes the meal plan text", r.status_code == 200 and r.json()["word_count"] == 6)
check("client views meal plan read-only + timestamp",
      client.get(f"/clients/{A_ID}/meal-plan", headers=ah).json()["updated_at"] is not None)
check("client CANNOT write the meal plan (403)",
      client.put(f"/clients/{A_ID}/meal-plan", headers=ah, json={"plan_text": "hax"}).status_code == 403)
check("meal plan over 5000 words is rejected (422)",
      client.put(f"/clients/{A_ID}/meal-plan", headers=th,
                 json={"plan_text": "word " * 5001}).status_code == 422)
check("meal plan of exactly 5000 words is accepted",
      client.put(f"/clients/{A_ID}/meal-plan", headers=th,
                 json={"plan_text": "word " * 5000}).status_code == 200)
check("client CANNOT see another client's meal plan (403)",
      client.get(f"/clients/{B_ID}/meal-plan", headers=ah).status_code == 403)

# ---- 4. supplements ----
r = client.post(f"/clients/{A_ID}/supplements", headers=th,
                json={"name": "Creatine", "dosage": "5g/day", "notes": "post-workout"})
check("trainer adds a supplement (201)", r.status_code == 201)
check("client views supplements read-only",
      client.get(f"/clients/{A_ID}/supplements", headers=ah).status_code == 200)
check("client CANNOT add a supplement (403)",
      client.post(f"/clients/{A_ID}/supplements", headers=ah, json={"name": "x"}).status_code == 403)

# ---- 5. notes: trainer-only, never visible to the client ----
client.post(f"/clients/{A_ID}/notes", headers=th, json={"note_text": "Prefers morning sessions"})
check("trainer can list notes", len(client.get(f"/clients/{A_ID}/notes", headers=th).json()) == 1)
check("client CANNOT read their OWN notes (403)",
      client.get(f"/clients/{A_ID}/notes", headers=ah).status_code == 403)
check("client CANNOT read another client's notes (403)",
      client.get(f"/clients/{B_ID}/notes", headers=ah).status_code == 403)
check("client CANNOT add a note (403)",
      client.post(f"/clients/{A_ID}/notes", headers=ah, json={"note_text": "x"}).status_code == 403)
check("no token -> notes 401/403", client.get(f"/clients/{A_ID}/notes").status_code in (401, 403))

# ---- schedules (still enforced) ----
check("client CANNOT edit a schedule (403)",
      client.put(f"/clients/{A_ID}/schedule", headers=ah, json={"entries": []}).status_code == 403)

# ---- 6. progress: daily weight check-in ----
r = client.post(f"/clients/{A_ID}/progress-logs", headers=ah, json={"weight": 70.5})
check("client logs today's weight", r.status_code == 200 and r.json()["weight"] == 70.5)
r = client.post(f"/clients/{A_ID}/progress-logs", headers=ah, json={"weight": 70.1})
check("logging again the same day overwrites (once a day)", r.json()["weight"] == 70.1)
for i in range(1, 6):
    client.post(f"/clients/{A_ID}/progress-logs", headers=ah,
                json={"weight": 70 + i, "date": str(today - timedelta(days=i))})
client.post(f"/clients/{A_ID}/progress-logs", headers=ah,
            json={"weight": 99, "date": str(today - timedelta(days=20))})  # older than 7d
r = client.get(f"/clients/{A_ID}/progress-logs", headers=ah).json()
check("client sees last 7 days only", len(r) == 6 and all(x["weight"] != 99 for x in r))
check("trainer views progress logs read-only (GET 200)",
      client.get(f"/clients/{A_ID}/progress-logs", headers=th).status_code == 200)
check("trainer CANNOT log weight for a client (403)",
      client.post(f"/clients/{A_ID}/progress-logs", headers=th, json={"weight": 80}).status_code == 403)
check("client CANNOT log weight for ANOTHER client (403)",
      client.post(f"/clients/{B_ID}/progress-logs", headers=ah, json={"weight": 80}).status_code == 403)
check("client CANNOT read ANOTHER client's progress logs (403)",
      client.get(f"/clients/{B_ID}/progress-logs", headers=ah).status_code == 403)

# ---- 7. weekly measurements ----
r = client.post(f"/clients/{A_ID}/weekly-measurements", headers=ah,
                json={"weight": 70, "chest_cm": 100, "waist_cm": 80, "thighs_cm": 55, "arm_cm": 35})
check("client logs weekly measurements", r.status_code == 200 and r.json()["chest_cm"] == 100)
r = client.post(f"/clients/{A_ID}/weekly-measurements", headers=ah, json={"waist_cm": 79})
check("logging again the same week updates the same row", r.json()["waist_cm"] == 79 and r.json()["chest_cm"] == 100)
check("only one measurement row this week",
      len(client.get(f"/clients/{A_ID}/weekly-measurements", headers=ah).json()) == 1)
check("trainer views measurements read-only (GET 200)",
      client.get(f"/clients/{A_ID}/weekly-measurements", headers=th).status_code == 200)
check("trainer CANNOT log measurements (403)",
      client.post(f"/clients/{A_ID}/weekly-measurements", headers=th, json={"weight": 80}).status_code == 403)
check("client CANNOT read ANOTHER client's measurements (403)",
      client.get(f"/clients/{B_ID}/weekly-measurements", headers=ah).status_code == 403)

# ---- 8. diet photos ----
r = client.put(f"/clients/{A_ID}/diet-photos", headers=ah,
               json={"photos": [{"photo_url": "data:image/png;base64,AAA", "note": "breakfast"}]})
check("client uploads a diet photo", r.status_code == 200 and len(r.json()["photos"]) == 1)
dp_id = r.json()["id"]
r = client.put(f"/clients/{A_ID}/diet-photos", headers=ah,
               json={"photos": [{"photo_url": f"u{i}"} for i in range(11)]})
check("more than 10 photos is rejected (422)", r.status_code == 422)
check("client CANNOT upload for ANOTHER client (403)",
      client.put(f"/clients/{B_ID}/diet-photos", headers=ah,
                 json={"photos": [{"photo_url": "x"}]}).status_code == 403)
check("trainer CANNOT upload diet photos (403)",
      client.put(f"/clients/{A_ID}/diet-photos", headers=th,
                 json={"photos": [{"photo_url": "x"}]}).status_code == 403)
r = client.patch(f"/clients/{A_ID}/diet-photos/{dp_id}/review", headers=th,
                 json={"trainer_comment": "Great choices today", "trainer_diet_rating": 4})
check("trainer leaves a daily comment (with timestamp)",
      r.status_code == 200 and r.json()["trainer_comment"] == "Great choices today"
      and r.json()["trainer_comment_at"] is not None)
check("trainer rates the day's diet discipline 1-5", r.json()["trainer_diet_rating"] == 4)
check("diet rating out of range -> 422",
      client.patch(f"/clients/{A_ID}/diet-photos/{dp_id}/review", headers=th,
                   json={"trainer_diet_rating": 9}).status_code == 422)
seen_dp = client.get(f"/clients/{A_ID}/diet-photos", headers=ah).json()[0]
check("client sees the trainer's comment + diet rating",
      seen_dp["trainer_comment"] == "Great choices today" and seen_dp["trainer_diet_rating"] == 4)
check("client CANNOT set a diet review (403)",
      client.patch(f"/clients/{A_ID}/diet-photos/{dp_id}/review", headers=ah,
                   json={"trainer_comment": "x"}).status_code == 403)
check("client CANNOT read ANOTHER client's diet photos (403)",
      client.get(f"/clients/{B_ID}/diet-photos", headers=ah).status_code == 403)

# ---- 8b. 24h diet-photo auto-purge ----
check("client CANNOT trigger the purge (403)",
      client.post("/admin/purge-diet-photos?older_than_hours=0", headers=ah).status_code == 403)
r = client.post("/admin/purge-diet-photos?older_than_hours=0", headers=th)
check("manual purge (older_than_hours=0) clears 1 record", r.status_code == 200 and r.json()["cleared"] == 1)
after = client.get(f"/clients/{A_ID}/diet-photos", headers=ah).json()[0]
check("purge cleared the photos array", after["photos"] == [])
check("purge KEPT trainer_comment / _at / diet_rating",
      after["trainer_comment"] == "Great choices today"
      and after["trainer_comment_at"] is not None
      and after["trainer_diet_rating"] == 4)
check("purge is idempotent (nothing left to clear)",
      client.post("/admin/purge-diet-photos?older_than_hours=0", headers=th).json()["cleared"] == 0)
check("default purge (24h) leaves a just-uploaded photo alone",
      client.put(f"/clients/{B_ID}/diet-photos", headers=bh, json={"photos": [{"photo_url": "x"}]}).status_code == 200
      and client.post("/admin/purge-diet-photos", headers=th).json()["cleared"] == 0)

# ---- 9. password reset / change ----
check("trainer resets a client's password (204)",
      client.post(f"/clients/{A_ID}/reset-password", headers=th, json={"new_password": "temp123"}).status_code == 204)
check("client logs in with the temp password",
      client.post("/auth/login", json={"phone_number": "1000000001", "password": "temp123"}).status_code == 200)
ah = {"Authorization": f"Bearer {client.post('/auth/login', json={'phone_number': '1000000001', 'password': 'temp123'}).json()['access_token']}"}
check("client CANNOT reset another user's password (403)",
      client.post(f"/clients/{B_ID}/reset-password", headers=ah, json={"new_password": "temp123"}).status_code == 403)
check("reset password under 6 chars -> 422",
      client.post(f"/clients/{A_ID}/reset-password", headers=th, json={"new_password": "x"}).status_code == 422)
check("client change-password needs the correct current password (400)",
      client.post("/users/me/change-password", headers=ah,
                  json={"current_password": "wrong", "new_password": "newpass1"}).status_code == 400)
check("client changes own password (204)",
      client.post("/users/me/change-password", headers=ah,
                  json={"current_password": "temp123", "new_password": "newpass1"}).status_code == 204)
ah = {"Authorization": f"Bearer {client.post('/auth/login', json={'phone_number': '1000000001', 'password': 'newpass1'}).json()['access_token']}"}

# ---- 10. reports ----
r = client.post(f"/clients/{A_ID}/reports", headers=ah,
                json={"file_url": "data:application/pdf;base64,JVBER", "note": "blood work"})
check("client uploads a report (201)", r.status_code == 201)
check("trainer views client's reports (read)",
      len(client.get(f"/clients/{A_ID}/reports", headers=th).json()) == 1)
check("trainer CANNOT upload a report (403)",
      client.post(f"/clients/{A_ID}/reports", headers=th, json={"file_url": "x"}).status_code == 403)
check("client CANNOT upload to ANOTHER client's reports (403)",
      client.post(f"/clients/{B_ID}/reports", headers=ah, json={"file_url": "x"}).status_code == 403)
check("client CANNOT read ANOTHER client's reports (403)",
      client.get(f"/clients/{B_ID}/reports", headers=ah).status_code == 403)

# ---- 11. session rating endpoints are GONE (ratings moved to Daily Check-in) ----
sid = next(s for s in client.get(f"/clients/{A_ID}/sessions", headers=th).json() if s["status"] == "done")["id"]
check("old client rating endpoint no longer exists (404/405)",
      client.patch(f"/clients/{A_ID}/sessions/{sid}/rating", headers=ah,
                   json={"client_rating": 4}).status_code in (404, 405))
check("old trainer rating endpoint no longer exists (404/405)",
      client.patch(f"/clients/{A_ID}/sessions/{sid}/trainer-rating", headers=th,
                   json={"trainer_rating": 4}).status_code in (404, 405))

# ---- 11b. self-service profile: photo + feeling note ----
r = client.patch("/users/me", headers=ah,
                 json={"profile_photo_url": "data:image/png;base64,AAAA", "feeling_note": "feeling strong"})
check("client sets own profile photo + feeling note",
      r.status_code == 200 and r.json()["feeling_note"] == "feeling strong")
check("feeling note shows in the trainer's client list",
      next(u for u in client.get("/users", headers=th).json() if u["id"] == A_ID)["feeling_note"] == "feeling strong")
check("profile photo shows in the trainer's client list",
      next(u for u in client.get("/users", headers=th).json() if u["id"] == A_ID)["profile_photo_url"].startswith("data:image"))

# ---- 12. packages + automatic session counting ----
r = client.post(f"/clients/{B_ID}/packages", headers=th, json={"total_sessions": 12})
check("trainer creates a package with a free-number total", r.status_code == 201 and r.json()["total_sessions"] == 12)
check("new package starts at 0 used / 12 remaining",
      r.json()["sessions_used"] == 0 and r.json()["sessions_remaining"] == 12)
check("client can VIEW own package status",
      client.get(f"/clients/{B_ID}/packages/current", headers=bh).json()["sessions_remaining"] == 12)
check("client CANNOT create a package (403)",
      client.post(f"/clients/{B_ID}/packages", headers=bh, json={"total_sessions": 5}).status_code == 403)

bs = client.post(f"/clients/{B_ID}/sessions", headers=th, json={"date": str(today), "status": "upcoming"}).json()
client.patch(f"/clients/{B_ID}/sessions/{bs['id']}", headers=th, json={"status": "done"})
check("marking a session done auto-increments sessions_used",
      client.get(f"/clients/{B_ID}/packages/current", headers=th).json()["sessions_used"] == 1)
check("...and recalculates sessions_remaining",
      client.get(f"/clients/{B_ID}/packages/current", headers=th).json()["sessions_remaining"] == 11)
client.patch(f"/clients/{B_ID}/sessions/{bs['id']}", headers=th, json={"status": "upcoming"})
check("undoing a done session decrements sessions_used",
      client.get(f"/clients/{B_ID}/packages/current", headers=th).json()["sessions_used"] == 0)

# last-session alert surfaces on the client's own record
client.post(f"/clients/{B_ID}/packages", headers=th, json={"total_sessions": 1})
me_b = client.get("/users/me", headers=bh).json()
check("renewing replaces the current package (1 session)", me_b["package"]["total_sessions"] == 1)
check("client record carries package brief + trainer name for the banner",
      me_b["package"]["sessions_remaining"] == 1 and me_b["package"]["trainer_name"] == "Tina")
listed = client.get("/users?search=Bob", headers=th).json()[0]
check("trainer client list carries the same package info for the tag",
      listed["package"]["sessions_remaining"] == 1)

# ---- 13. payments (trainer-only) ----
r = client.post(f"/clients/{A_ID}/payments", headers=th,
                json={"amount": 5000, "method": "UPI", "notes": "March fees"})
check("trainer adds a payment (201)", r.status_code == 201)
check("trainer views payments", len(client.get(f"/clients/{A_ID}/payments", headers=th).json()) == 1)
check("client CANNOT view payments (403)",
      client.get(f"/clients/{A_ID}/payments", headers=ah).status_code == 403)
check("client CANNOT add a payment (403)",
      client.post(f"/clients/{A_ID}/payments", headers=ah, json={"amount": 1, "method": "Cash"}).status_code == 403)
check("no token -> payments 401/403", client.get(f"/clients/{A_ID}/payments").status_code in (401, 403))

# ---- 14. analytics dashboard (trainer only) ----
check("client CANNOT open analytics (403)", client.get("/analytics", headers=ah).status_code == 403)
a = client.get("/analytics", headers=th).json()
check("analytics: active_clients counted", a["active_clients"] >= 2)
check("analytics: attendance rate computed per client",
      any(row["done"] >= 1 and row["attendance_rate"] is not None for row in a["attendance"]))
check("analytics: monthly revenue grouped by month",
      len(a["monthly_revenue"]) >= 1 and a["monthly_revenue"][0]["total"] == 5000)
check("analytics: last-session/zero client counted", a["clients_last_session_or_zero"] >= 1)

# ---- 15. announcements ----
check("client CANNOT post an announcement (403)",
      client.post("/announcements", headers=ah, json={"message": "hi"}).status_code == 403)
client.post("/announcements", headers=th, json={"message": "Gym closed Friday"})
client.post("/announcements", headers=th, json={"message": "New timings from Monday"})
check("client sees the LATEST announcement",
      client.get("/announcements/latest", headers=ah).json()["message"] == "New timings from Monday")
check("no token -> announcements/latest 401/403",
      client.get("/announcements/latest").status_code in (401, 403))

# ---- 16. workout history is available to the client (archive) ----
hist = client.get(f"/clients/{A_ID}/sessions", headers=ah).json()
check("client can list ALL their sessions for the history archive", len(hist) >= 3)

# ---- 17. transformations (trainer-managed; minimum 2, no maximum) ----
check("client CANNOT list transformations (403)",
      client.get("/transformations", headers=ah).status_code == 403)
r = client.post("/transformations", headers=th,
                json={"client_name": "Priya", "before_photo_url": "data:img,b",
                      "after_photo_url": "data:img,a", "caption": "-8kg in 12 weeks"})
check("trainer adds a transformation (201)", r.status_code == 201)
t1 = r.json()["id"]
t2 = client.post("/transformations", headers=th, json={"client_name": "Ravi", "caption": "-6kg"}).json()["id"]
check("trainer edits a transformation",
      client.patch(f"/transformations/{t1}", headers=th, json={"caption": "-9kg"}).json()["caption"] == "-9kg")
check("client CANNOT add a transformation (403)",
      client.post("/transformations", headers=ah, json={"client_name": "x"}).status_code == 403)
check("cannot delete a transformation while only 2 remain (409)",
      client.delete(f"/transformations/{t1}", headers=th).status_code == 409)
t3 = client.post("/transformations", headers=th, json={"client_name": "Sara", "caption": "+5kg lean"}).json()["id"]
check("with a 3rd entry a delete is allowed again (204)",
      client.delete(f"/transformations/{t3}", headers=th).status_code == 204)
check("back at 2 entries, delete is blocked again (409)",
      client.delete(f"/transformations/{t2}", headers=th).status_code == 409)
check("no upper limit — a 10th+ entry is fine",
      all(client.post("/transformations", headers=th,
                      json={"client_name": f"C{i}"}).status_code == 201 for i in range(8)))

# ---- 18. public landing page (no auth) ----
lp = client.get("/public/landing")
check("landing page is public (200, no token)", lp.status_code == 200)
lp = lp.json()
check("landing shows the trainer name", lp["trainer"]["name"] == "Tina")
check("landing lists every transformation", len(lp["transformations"]) == 10)
check("landing stats default to 0 before the trainer sets them",
      lp["stats"] == {"clients": 0, "transformations": 0, "sessions": 0})
client.patch("/users/me", headers=th,
             json={"total_clients_stat": 120, "total_transformations_stat": 95, "total_sessions_stat": 1432})
check("landing stats are the trainer's typed-in numbers",
      client.get("/public/landing").json()["stats"] == {"clients": 120, "transformations": 95, "sessions": 1432})
client.post("/transformations", headers=th, json={"client_name": "One more"})
check("adding real transformations does NOT change the manual stat",
      client.get("/public/landing").json()["stats"]["transformations"] == 95)
check("trainer's /users/me echoes the manual stats back for the editor",
      client.get("/users/me", headers=th).json()["total_sessions_stat"] == 1432)
check("landing stat rejects a negative number (422)",
      client.patch("/users/me", headers=th, json={"total_clients_stat": -3}).status_code == 422)
client.patch("/users/me", headers=th, json={"bio": "10 years coaching.", "credentials": "NASM-CPT"})
check("trainer bio + credentials appear on the public landing",
      client.get("/public/landing").json()["trainer"]["bio"] == "10 years coaching."
      and client.get("/public/landing").json()["trainer"]["credentials"] == "NASM-CPT")

print(f"\nAll {_passed} smoke checks passed.")
os.close(_db_fd)
os.unlink(_db_path)
