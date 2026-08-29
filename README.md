# Delt_era Fitness

Foundation of a fitness web app.

- **backend/** — Python + FastAPI, SQLAlchemy, Supabase (Postgres)
- **frontend/** — React (Vite) + React Router

## What's built

Tables: `users`, `schedules`, `sessions`, `meal_plans`, `supplements`, `notes`,
`progress_logs`, `weekly_measurements`, `diet_photos`, `reports`, `packages`,
`payments`, `announcements`, `transformations`.

- **Dark / light theme** — one centralized token set in `frontend/src/styles.css`
  (`:root` = light; `@media (prefers-color-scheme: dark)` + `[data-theme]` overrides).
  Follows the device setting automatically; the header has an **Auto / Light / Dark**
  toggle (persisted to `localStorage`). Calm palette: bg `#111110`/`#F7F6F2`, cards
  `#1a1a18`/white, borders `#2a2a27`/`#e2e0d8`, muted bronze `#B8956A` accent, text
  `#e8e6e0`/`#1a1a18` primary and `#8a8a85` secondary. Regular weight, sentence case,
  no italics, no all-caps (except the watermark). Every page is wrapped in one
  `<Layout>` — a sticky header (logo + name + theme toggle + avatar) and a faint fixed
  **"DELT_ERA"** watermark (~3.5% opacity, non-interactive).
- **Explicit save everywhere** — no form auto-saves on keystroke or field change.
  Every editable section has a visible **Save** button (`SaveBar` component) that is
  disabled until there are changes, shows a brief **Saved** confirmation, and warns
  (`"You have unsaved changes — leave anyway?"`) on both in-app navigation and tab
  close/refresh (`useUnsavedGuard` hook; app uses `createBrowserRouter` for the
  navigation block). Add / delete / status actions still apply immediately (with a
  delete confirm). Sign up / log in are one consistent button pair — filled primary
  vs outlined secondary, same size.
- **Public landing page** at `/` (no login): trainer name / photo / bio / credentials,
  Sign up + Log in, and a **transformations** gallery (before/after + caption).
  `GET /public/landing` is unauthenticated. Trainer manages entries + their landing
  bio/photo on the **Transformations** tab. Landing-only **Framer Motion**: three
  independently staggered count-up stats when they scroll into view, and
  fade-in/slide-up on each card (~320ms). Dashboard pages have **no** animation.
- **Landing page stats are manual** — the three headline numbers ("N+ clients",
  "N+ transformations", "N+ sessions completed") are plain numbers the trainer
  types on the **Transformations** tab → *Landing page stats* (`total_clients_stat`,
  `total_transformations_stat`, `total_sessions_stat` on the trainer's user row,
  set via `PATCH /users/me`). They are **never** counted from the `transformations`,
  `users`, or `sessions` tables — changing real data does not move them.
- **Transformations: minimum 2, no maximum** — the trainer can add unlimited
  before/after entries, but at least 2 are always kept so the landing gallery is
  never empty. The Delete button is disabled while only 2 remain, and
  `DELETE /transformations/{id}` returns `409` if it would drop below 2.
- **Trainer signup is locked** — the public **Sign up** page only creates clients
  (no role picker). `POST /auth/signup` hardcodes `role="client"` and ignores any
  `role` in the request body. Create the single trainer account out of band:
  `cd backend && DATABASE_URL=… .venv/bin/python create_trainer.py --name "…" --phone 9000000001 --password "…"`
  (re-runnable; updates the password if the phone already exists, leaves other
  users untouched).
- **Diet-photo 24h auto-purge** — APScheduler job in the API process, daily at
  03:00 UTC. Clears `photos` (and their notes) for entries whose photos are >24h old;
  **keeps** `trainer_comment`, `trainer_comment_at`, `trainer_diet_rating` forever.
  Logs each run (`deltera.diet_purge`). Manual trigger:
  `POST /admin/purge-diet-photos?older_than_hours=N` (trainer) — pass `0` to clear
  everything now for testing. Also a button on the **Analytics** page.

**Tab names:** the client's session view is **Workouts** (`/workouts`), the trainer's
per-client buttons are **Schedule / Workouts / Membership / Meal check-in** (plus
Meal plan, Supplements, Progress, Reports, Payments, Notes). Trainer top nav adds **Analytics**, **Announcements** and **Transformations**.

- **Session ratings were removed** (client + trainer rating screens). The DB columns
  stay, unused. Rating now lives on **Meal check-in**: `diet_photos.trainer_diet_rating`
  (1–5) — the trainer rates the day's diet discipline next to their daily comment;
  the client sees both. No client self-rating.
- **Analytics** (trainer, `GET /analytics`, all computed from existing tables):
  attendance rate per client (done vs missed), monthly revenue (payments grouped by
  `YYYY-MM`), count of clients on their last/0 sessions, total active clients.
- **Workout history archive** — the client's Workouts tab shows a scrollable list of
  every past session with its `workout_details`; the trainer sees the same per client.
- **Profile photo** — client uploads via `PATCH /users/me` (stored on
  `users.profile_photo_url`); shown on their dashboard and as the avatar in the
  trainer's client list (replacing initials).
- **Streak** — computed on the fly from session status (consecutive `done`, breaks on
  `missed`); shown as a badge on the client dashboard.
- **Feeling-today note** — client edits `users.feeling_note` anytime via `PATCH
  /users/me`; shown under the client's name in the trainer's list.
- **Announcements** (`announcements`) — trainer posts a message (**Announcements** tab);
  clients see the latest on their dashboard (`GET /announcements/latest`).
- **Reset Password fixed** — the trainer action was a flaky `window.prompt`; it's now
  an inline form. Endpoint verified end-to-end (`204`, old password stops working).

- Signup / login with **phone number + password** (bcrypt-hashed), JWT bearer auth
- **Validation** — `phone_number` must be exactly 10 digits (numbers only) and
  `password` at least 6 chars, checked inline on the frontend *and* on the backend
  (`422`) for signup and trainer-created clients.
- **Password reset** — trainer sets a new temporary password for a client from the
  client page ("Reset password"); a client changes their own from Profile (needs the
  current password). Only a trainer can reset someone else's; a client can only
  change their own and only knowing the current one.
- **Reports** (`reports`) — client uploads PDF/image files (kept permanently);
  trainer views read-only. Client can only see/upload their own.
- **Session ratings** — client rates a *completed* session 1–5★ with an optional
  comment; trainer separately rates the client's performance 1–5★ on the same
  session. Each side sees the other's rating; a client can never touch `trainer_rating`.
- **Packages + last-session alert** (`packages`) — trainer enters the number of
  sessions purchased (free number input) to create/renew; newest package is current.
  Marking a session **done** auto-increments `sessions_used` (and undo decrements it);
  `sessions_remaining` is a generated column. When remaining is 1 or ≤0 the client
  sees a non-blocking banner ("…contact <trainer> for renewal") on every page, and the
  trainer's client list shows a small tag. No lockout.
- **Payments** (`payments`) — trainer adds/views payment entries (amount, method,
  date, notes) per client. Never visible to the client (403 on every path).
- **Role rule:** a client only ever *reads* their own data and can *write* only their
  own `progress_logs` / `weekly_measurements` / `diet_photos`. A client can never
  write `meal_plans` (read-only) and can never touch `notes` at all (403 on every
  path). A trainer reads/writes everything for any client, **except** progress data,
  which is client-written and trainer-read-only.
- **BMI / BMR / TDEE** — plain nullable number fields on `users`, **entered by the
  trainer** (not calculated). Show "—" until set; client can view, never edit.
- **Meal plan** — one free-text field per client, trainer-written, **5,000-word cap**
  enforced on the frontend (live counter, Save disabled when over) *and* the backend
  (`422`). Client sees it read-only with a "last updated" timestamp.
- **Sessions** — unchanged: manual creation, mark done/missed, post next-day workout
  details. Client's "My Week" is a colour-coded calendar + done/remaining counter.
- **Progress → daily check-in** (`progress_logs`) — client logs weight once a day
  (re-logging overwrites the day), sees the last 7 days; trainer sees it read-only.
- **Progress → weekly measurements** (`weekly_measurements`) — client logs
  weight/chest/waist/thighs/arm once a week (re-logging updates that week's row);
  trainer read-only.
- **Diet photos** (`diet_photos`) — one entry per day, JSON array of up to 10
  `{photo_url, note?}`. Progressive upload UI: one upload area, then an "Add another
  photo" button per slot up to 10, then hidden. Trainer leaves **one comment for the
  whole day**, stored with its timestamp.
  Photos are downscaled client-side and stored as data URLs — swap for Supabase
  Storage in production.
- Schedule and meal times are stored/shown in **IST**.

---

## 1. Database (Supabase)

1. Create a project at [supabase.com](https://supabase.com).
2. Project Settings → Database → Connection string → **URI**. Copy it
   (looks like `postgresql://postgres:PASSWORD@db.xxxx.supabase.co:5432/postgres`).
3. The backend creates all tables automatically on startup.
   (Optional: run `backend/schema.sql` in the Supabase SQL editor instead.)
   **Upgrading an existing DB:** `meal_plans` changed from per-entry rows to one
   free-text row per client — run `drop table if exists meal_plans;` first, then
   restart (or re-run `schema.sql`).

---

## 2. Run the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# edit .env: set DATABASE_URL to your Supabase URI, set JWT_SECRET to a long random string

uvicorn app.main:app --reload --port 8000
```

- API: http://localhost:8000
- Interactive docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

### Offline smoke test (no Supabase needed)

Runs the whole API against a throwaway SQLite DB and checks the access rules:

```bash
cd backend
source .venv/bin/activate
pip install httpx          # test-only dependency
python smoke_test.py
```

---

## 3. Run the frontend

```bash
cd frontend
npm install

cp .env.example .env
# .env: VITE_API_URL=http://localhost:8000  (default is already this)

npm run dev
```

Open http://localhost:5173.

The **Sign up** page only creates **client** accounts. Create the one trainer
account with the script (see *Trainer signup is locked* above):

```bash
cd backend
DATABASE_URL="sqlite:///./deltera_local.sqlite" \
  .venv/bin/python create_trainer.py --name "Salman" --phone 9000000001 --password "trainer1"
```

Trainers land on the client list; clients land on their profile.

---

## 4. Verify a client cannot access another client's data

### Option A — from the browser
1. Sign up **Client A** (phone `1111`) and **Client B** (phone `2222`).
2. Log in as Client A. You land on `/profile` and see your own data
   (`GET /users/me` succeeds).
3. Open dev tools → Console and run:
   ```js
   const t = localStorage.getItem("delt_era_token");
   // try to read the whole client list (trainer-only)
   fetch("http://localhost:8000/users", { headers: { Authorization: `Bearer ${t}` } })
     .then(r => console.log("client list status:", r.status));   // -> 403
   ```
4. Log in as a **trainer**, open a client from the list, copy that client's id from
   the URL (`/clients/<id>`), then as Client A run:
   ```js
   const t = localStorage.getItem("delt_era_token");
   fetch(`http://localhost:8000/users/<PASTE_OTHER_CLIENT_ID>`, { headers: { Authorization: `Bearer ${t}` } })
     .then(r => console.log("other client status:", r.status));   // -> 403
   ```

### Option B — with curl (clear and repeatable)

```bash
API=http://localhost:8000

# Two clients via public signup (phone must be exactly 10 digits)
A=$(curl -s -X POST $API/auth/signup -H 'Content-Type: application/json' \
  -d '{"name":"Client A","phone_number":"1111111111","password":"secret1"}')
B=$(curl -s -X POST $API/auth/signup -H 'Content-Type: application/json' \
  -d '{"name":"Client B","phone_number":"2222222222","password":"secret2"}')

# The trainer is created out of band — public signup can't make one:
#   cd backend && DATABASE_URL="sqlite:///./deltera_local.sqlite" \
#     .venv/bin/python create_trainer.py --name Tina --phone 9999999999 --password trainer1
T=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"phone_number":"9999999999","password":"trainer1"}')

# Pull tokens / ids (jq optional — shown here for clarity)
A_TOKEN=$(echo $A | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
B_ID=$(echo $B    | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])')
A_ID=$(echo $A    | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])')
T_TOKEN=$(echo $T | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

# Client A reads THEIR OWN record  -> 200
curl -s -o /dev/null -w "own record:        %{http_code}\n" \
  $API/users/$A_ID -H "Authorization: Bearer $A_TOKEN"

# Client A tries to read Client B  -> 403 Forbidden
curl -s -o /dev/null -w "other client:      %{http_code}\n" \
  $API/users/$B_ID -H "Authorization: Bearer $A_TOKEN"

# Client A tries the trainer-only list -> 403 Forbidden
curl -s -o /dev/null -w "client list:       %{http_code}\n" \
  $API/users -H "Authorization: Bearer $A_TOKEN"

# Trainer reads Client B -> 200, and the list -> 200
curl -s -o /dev/null -w "trainer -> client: %{http_code}\n" \
  $API/users/$B_ID -H "Authorization: Bearer $T_TOKEN"
curl -s -o /dev/null -w "trainer -> list:   %{http_code}\n" \
  $API/users -H "Authorization: Bearer $T_TOKEN"
```

Expected output:

```
own record:        200
other client:      403
client list:       403
trainer -> client: 200
trainer -> list:   200
```

The enforcement lives in [backend/app/deps.py](backend/app/deps.py)
(`require_trainer` and `load_accessible_client` — the latter 403s a client asking for
an id that isn't their own, and is reused by the profile and schedule read endpoints).

To also check the **schedule** rules by curl, continue the script above:

```bash
# Trainer sets Client A's schedule -> 200
curl -s -o /dev/null -w "trainer sets schedule:  %{http_code}\n" \
  -X PUT $API/clients/$A_ID/schedule -H "Authorization: Bearer $T_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"entries":[{"day_of_week":0,"time":"07:00"},{"day_of_week":3,"time":"18:30"}]}'

# Client A reads THEIR OWN schedule -> 200
curl -s -o /dev/null -w "own schedule:           %{http_code}\n" \
  $API/clients/$A_ID/schedule -H "Authorization: Bearer $A_TOKEN"

# Client A reads Client B's schedule -> 403
curl -s -o /dev/null -w "other client schedule:  %{http_code}\n" \
  $API/clients/$B_ID/schedule -H "Authorization: Bearer $A_TOKEN"

# Client A tries to edit a schedule -> 403
curl -s -o /dev/null -w "client edits schedule:  %{http_code}\n" \
  -X PUT $API/clients/$A_ID/schedule -H "Authorization: Bearer $A_TOKEN" \
  -H 'Content-Type: application/json' -d '{"entries":[]}'
```

### Fastest check of everything

```bash
cd backend && source .venv/bin/activate && pip install httpx && python smoke_test.py
```
Runs **127 assertions**: everything above plus the **24h diet-photo purge**
(clears photos, keeps trainer comment/rating, is idempotent, leaves fresh photos
alone), **transformations** CRUD + the **minimum-2 rule**, **manual landing stats**
(typed by the trainer, never counted from data), **locked trainer signup**
(`role` is always `client`), and the **public landing page** (no auth).

## How to test (in the browser)

Seed **trainer "Salman"** (`9000000001` / `trainer1`) with the script
(`backend/create_trainer.py`), then create a demo client **"Test Client"**
(`8000000001` / `client1`) from the **Sign up** page. Add a **1-session
membership** and a couple of transformations from the trainer side.

- **Landing page** — open **http://localhost:5173/** while logged out: Salman's
  name/bio, Sign up / Log in, and the transformation cards. The three headline
  numbers (**N+ clients / transformations / sessions completed**) count up,
  staggered, as they scroll in; each card fades/slides in. Log in → you're taken
  to the dashboard and the landing is replaced.
- **Landing stats are manual** — Salman → **Transformations** → *Landing page
  stats* → type `120 / 95 / 1432` → **Save stats** → reload the logged-out landing:
  the numbers match. Add or delete transformations / clients — the numbers do
  **not** move.
- **Transformations minimum 2** — Salman → **Transformations**: with only 2
  entries the **Delete** buttons are disabled ("at least 2 required"); add a 3rd
  and they become deletable again. (API: `DELETE` returns `409` below 2.)
- **Trainer signup locked** — the **Sign up** page has no role picker and always
  creates a client. Even `POST /auth/signup` with `{"role":"trainer"}` (via
  dev-tools / curl) returns a client account.
- **Theme** — the header toggle cycles **Auto → Light → Dark** and sticks across
  reloads. With it on Auto, flip your OS appearance and the app follows. The faint
  DELT_ERA watermark sits behind every page. Calm palette / regular weight everywhere.
- **Explicit save** — edit any trainer form (Meal plan, Schedule, Supplements, a
  client profile, Meal-check-in review, a transformation, your profile note) → the
  **Save** button lights up, a **Saved** chip appears after saving, and trying to
  switch tabs mid-edit prompts "You have unsaved changes — leave anyway?".
- **Transformations** — Salman → **Transformations** tab: edit bio/credentials/photo
  (explicit **Save profile**), add/edit/delete before-after entries → they appear on
  the public landing.
- **Diet-photo purge** — client → **Meal check-in** → upload a photo; Salman rates +
  comments it. Salman → **Analytics** → "Run purge now" with **0** hours → the photo
  is cleared but the rating + comment stay. (The real job runs daily at 03:00 UTC and
  only touches photos older than 24h; the log line is `deltera.diet_purge: ...`.)
- **Tab renames** — trainer client page buttons read **Schedule / Workouts /
  Membership / Meal check-in**; client nav has **Workouts** and **Meal check-in**.
- **Reset Password (fixed)** — as Salman, open a client → **Reset password** → an
  inline field appears (no browser prompt) → enter a new password → **Set password**.
  Log in as that client with the new password; the old one now fails.
- **Analytics** — Salman → **Analytics** top nav: active-client count, low-session
  count, per-client attendance %, monthly revenue. `GET /analytics` as a client → 403.
- **Workout history** — client → **Workouts** → "Workout history" scrollable list of
  every past session with its details.
- **Profile photo + streak + feeling note** — client → **Profile** → upload a photo
  (shows as the avatar; also in Salman's client list). Mark a few sessions `done` in a
  row (as Salman) → the client's dashboard shows a "🔥 N-session streak" badge. Type a
  feeling note → it appears under the client's name in the trainer list.
- **Announcements** — Salman → **Announcements** → post a message → client dashboard shows
  it. Post another → clients see the newest.
- **Membership auto-count** — trainer → client → **Membership** → enter `10` → Save →
  **Workouts** → mark one **done** → Membership shows `1 used / 9 remaining`; flip to
  **upcoming** → back to `0 / 10`.
- **Client-to-client isolation** (client-B token `BT`, client-A id `AID`):
  ```bash
  for p in meal-plan progress-logs weekly-measurements diet-photos reports \
           packages sessions notes payments; do
    curl -s -o /dev/null -w "$p -> %{http_code}\n" \
      $API/clients/$AID/$p -H "Authorization: Bearer $BT"
  done
  # meal-plan/progress-logs/weekly-measurements/diet-photos/reports/packages/sessions -> 403
  # notes/payments -> 403 (trainer-only)
  ```

---

## API reference

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/auth/signup` · `/auth/login` | none | phone = 10 digits, password ≥ 6 (`422`); signup **always** creates `role="client"` (any `role` in the body is ignored) |
| POST | `/clients/{id}/reset-password` | **trainer** | `{new_password}` (≥6) |
| POST | `/users/me/change-password` | self | `{current_password, new_password}`; `400` if current wrong |
| PATCH | `/users/me` | self | `{profile_photo_url?, feeling_note?, bio?, credentials?, total_clients_stat?, total_transformations_stat?, total_sessions_stat?}` — self-service + trainer landing content/stats (stats `≥ 0`) |
| GET | `/users/me` | any user | own record incl. `bmi`/`bmr`/`tdee` and `package` brief |
| GET | `/users?search=` | trainer | client list, matches name or phone |
| GET | `/users/{id}` | trainer any / client self | 403 otherwise |
| POST·PATCH | `/clients[/{id}]` | trainer | create / edit client incl. `bmi`/`bmr`/`tdee` |
| GET·PUT | `/clients/{id}/schedule` | GET trainer/self · PUT trainer | weekly time template (IST) |
| GET | `/clients/{id}/sessions[/summary]` | trainer any / client self | list · this-week counters + `next_session` |
| POST·PATCH·DELETE | `/clients/{id}/sessions[/{sid}]` | trainer | create / mark done·missed / workout_details (session rating endpoints removed) |
| GET | `/clients/{id}/meal-plan` | trainer any / client self | `{plan_text, updated_at, word_count, word_limit}` |
| PUT | `/clients/{id}/meal-plan` | **trainer** | `{plan_text}`; `422` if > 5000 words |
| GET·POST·PATCH·DELETE | `/clients/{id}/supplements[/{sid}]` | GET trainer/self · writes trainer | |
| GET·POST·DELETE | `/clients/{id}/notes[/{nid}]` | **trainer only** | client always 403 |
| GET | `/clients/{id}/progress-logs?days=7` | trainer any / client self | last N days |
| POST | `/clients/{id}/progress-logs` | **client self only** | `{weight, date?}`; upserts the day |
| GET | `/clients/{id}/weekly-measurements` | trainer any / client self | history |
| POST | `/clients/{id}/weekly-measurements` | **client self only** | upserts the week |
| GET | `/clients/{id}/diet-photos` | trainer any / client self | entries newest first |
| PUT | `/clients/{id}/diet-photos` | **client self only** | `{date?, photos[≤10]}` |
| PATCH | `/clients/{id}/diet-photos/{eid}/review` | **trainer** | `{trainer_comment?, trainer_diet_rating? 1-5}` |
| GET | `/clients/{id}/reports` | trainer any / client self | files newest first |
| POST | `/clients/{id}/reports` | **client self only** | `{file_url, note?}` (PDF/image data URL) |
| GET | `/clients/{id}/packages[/current]` | trainer any / client self | history · current package |
| POST | `/clients/{id}/packages` | **trainer** | `{total_sessions, start_date?}` — creates/renews |
| GET·POST·DELETE | `/clients/{id}/payments[/{pid}]` | **trainer only** | client always 403 |
| GET | `/analytics` | **trainer only** | attendance, monthly revenue, low-session count, active clients |
| GET | `/announcements/latest` | any user | newest announcement (client dashboard) |
| GET·POST | `/announcements` | **trainer only** | history · post a new one |
| GET | `/public/landing` | **none** | trainer bio/photo/credentials + transformations + `stats{clients, transformations, sessions}` (the trainer's manual numbers) |
| GET·POST·PATCH·DELETE | `/transformations[/{id}]` | **trainer only** | before/after showcase entries; `DELETE` → `409` if it would leave fewer than 2 |
| POST | `/admin/purge-diet-photos?older_than_hours=N` | **trainer** | run the 24h purge now (`N=0` clears all) |
