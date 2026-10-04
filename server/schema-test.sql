-- Schema mirrored from server/tracking.js (SCHEMA constant)
CREATE TABLE IF NOT EXISTS investai_users (
    id           SERIAL PRIMARY KEY,
    email        TEXT UNIQUE NOT NULL,
    name         TEXT NOT NULL,
    language     TEXT,
    currency     TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS investai_activities (
    id           SERIAL PRIMARY KEY,
    email        TEXT,
    session_id   TEXT,
    activity     TEXT NOT NULL,
    detail       TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activities_email ON investai_activities (email);
CREATE INDEX IF NOT EXISTS idx_activities_created ON investai_activities (created_at);
