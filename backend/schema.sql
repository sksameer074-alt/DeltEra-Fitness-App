-- Delt_era Fitness - database schema
-- You can run this in the Supabase SQL editor, OR just let the backend
-- create the table automatically on startup (SQLAlchemy create_all).

create table if not exists users (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    phone_number text not null unique,
    password text not null,                      -- bcrypt hash, never plaintext
    role text not null check (role in ('trainer', 'client')),
    weight double precision,
    height double precision,
    age integer,
    sex text,
    activity_level text,
    profile_photo_url text,
    feeling_note text,
    has_injury boolean not null default false,
    injury_comment text,
    has_health_condition boolean not null default false,
    health_condition_comment text,
    -- Trainer-entered body metrics. NOT calculated. NULL until the trainer sets them.
    bmi double precision,
    bmr double precision,
    tdee double precision,
    created_at timestamptz not null default now()
);

create index if not exists users_role_idx on users (role);

-- One weekly training slot per row. `time` is India Standard Time ("HH:MM").
create table if not exists schedules (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references users(id) on delete cascade,
    day_of_week integer not null check (day_of_week between 0 and 6),  -- 0=Mon .. 6=Sun
    "time" text not null
);

create index if not exists schedules_client_idx on schedules (client_id);

-- Dated training sessions with an outcome status.
create table if not exists sessions (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references users(id) on delete cascade,
    date date not null,
    status text not null default 'upcoming' check (status in ('upcoming', 'done', 'missed')),
    workout_details text,
    client_rating integer check (client_rating between 1 and 5),
    client_comment text,
    trainer_rating integer check (trainer_rating between 1 and 5)
);
create index if not exists sessions_client_idx on sessions (client_id);
create index if not exists sessions_date_idx on sessions (date);

-- One free-text meal plan per client (trainer-written, <= 5000 words enforced in the API).
-- NOTE: this replaced an earlier per-entry meal_plans table. If upgrading an existing
-- database:  drop table if exists meal_plans;  then re-run this file.
create table if not exists meal_plans (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null unique references users(id) on delete cascade,
    plan_text text not null default '',
    updated_at timestamptz not null default now()
);

-- Per-client supplements.
create table if not exists supplements (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references users(id) on delete cascade,
    name text not null,
    dosage text,
    notes text
);
create index if not exists supplements_client_idx on supplements (client_id);

-- Trainer-only notes about a client. Never exposed to the client via the API.
create table if not exists notes (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references users(id) on delete cascade,
    note_text text not null,
    created_at timestamptz not null default now()
);
create index if not exists notes_client_idx on notes (client_id);

-- Progress: daily weight check-in (one row per client per date).
create table if not exists progress_logs (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references users(id) on delete cascade,
    weight double precision not null,
    date date not null,
    unique (client_id, date)
);
create index if not exists progress_logs_client_idx on progress_logs (client_id);

-- Progress: weekly body measurements.
create table if not exists weekly_measurements (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references users(id) on delete cascade,
    date date not null,
    weight double precision,
    chest_cm double precision,
    waist_cm double precision,
    thighs_cm double precision,
    arm_cm double precision
);
create index if not exists weekly_measurements_client_idx on weekly_measurements (client_id);

-- Diet photos: one entry per client per date. `photos` is a JSON array (max 10)
-- of {photo_url, note?}. Trainer leaves one comment for the whole day.
create table if not exists diet_photos (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references users(id) on delete cascade,
    date date not null,
    photos jsonb not null default '[]'::jsonb,
    trainer_comment text,
    trainer_comment_at timestamptz,
    trainer_diet_rating integer check (trainer_diet_rating between 1 and 5),
    unique (client_id, date)
);
create index if not exists diet_photos_client_idx on diet_photos (client_id);

-- Client-uploaded files (PDF / image). Stored permanently; trainer views read-only.
create table if not exists reports (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references users(id) on delete cascade,
    file_url text not null,
    note text,
    uploaded_at timestamptz not null default now()
);
create index if not exists reports_client_idx on reports (client_id);

-- Purchased session blocks. The newest row is the client's current package.
-- sessions_used is bumped automatically when a session is marked "done".
create table if not exists packages (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references users(id) on delete cascade,
    trainer_id uuid references users(id) on delete set null,
    total_sessions integer not null,
    sessions_used integer not null default 0,
    sessions_remaining integer generated always as (total_sessions - sessions_used) stored,
    start_date date not null,
    created_at timestamptz not null default now()
);
create index if not exists packages_client_idx on packages (client_id);

-- Trainer-recorded payments. Never exposed to the client via the API.
create table if not exists payments (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references users(id) on delete cascade,
    amount double precision not null,
    method text not null,
    date date not null,
    notes text
);
create index if not exists payments_client_idx on payments (client_id);

-- Trainer broadcast messages. The newest is shown to all clients.
create table if not exists announcements (
    id uuid primary key default gen_random_uuid(),
    message text not null,
    created_at timestamptz not null default now()
);
