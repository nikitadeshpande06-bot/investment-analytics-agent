/* ============================================================
 * InvestAI — CLOUD TRACKING LAYER (Cloud SQL PostgreSQL)
 * Zero-impact when DATABASE_URL is absent: every call is a
 * no-op, so local behaviour is 100% unchanged.
 * Loaded lazily so a missing/unreachable DB never blocks the
 * existing chat/analyze endpoints.
 * ============================================================ */

require("dotenv").config();

const DATABASE_URL = process.env.DATABASE_URL || "";

let pool = null;
let readyPromise = null;

function enabled() {
    return Boolean(DATABASE_URL);
}

function getPool() {
    if (!pool) {
        const { Pool } = require("pg");
        pool = new Pool({
            connectionString: DATABASE_URL,
            ssl: process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false },
            max: 5,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 8000
        });
    }
    return pool;
}

/* Table schema — created on first use (idempotent). */
const SCHEMA = `
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
`;

function init() {
    if (!enabled()) return Promise.resolve(false);
    if (!readyPromise) {
        readyPromise = getPool()
            .query(SCHEMA)
            .then(() => {
                console.log("Cloud SQL tracking ready (investai_users, investai_activities).");
                return true;
            })
            .catch(error => {
                console.warn("Cloud SQL tracking disabled (DB unreachable):", error.message);
                return false;
            });
    }
    return readyPromise;
}

/* Fire-and-forget writer — never throws into request handlers. */
function track(email, sessionId, activity, detail) {
    if (!enabled()) return Promise.resolve(false);
    return init().then(ok => {
        if (!ok) return false;
        return getPool()
            .query(
                "INSERT INTO investai_activities (email, session_id, activity, detail) VALUES ($1,$2,$3,$4)",
                [email || null, sessionId || null, String(activity), detail ? String(detail).slice(0, 2000) : null]
            )
            .then(() => true)
            .catch(error => {
                console.warn("Activity write failed:", error.message);
                return false;
            });
    });
}

/* Upsert user on signup/login. */
function upsertUser(user) {
    if (!enabled() || !user || !user.email) return Promise.resolve(false);
    return init().then(ok => {
        if (!ok) return false;
        return getPool()
            .query(
                `INSERT INTO investai_users (email, name, language, currency)
                 VALUES ($1,$2,$3,$4)
                 ON CONFLICT (email) DO UPDATE
                 SET name = EXCLUDED.name,
                     language = COALESCE(EXCLUDED.language, investai_users.language),
                     currency = COALESCE(EXCLUDED.currency, investai_users.currency)`,
                [user.email, user.name || user.email, user.language || null, user.currency || null]
            )
            .then(() => true)
            .catch(error => {
                console.warn("User upsert failed:", error.message);
                return false;
            });
    });
}

/* Readers for the admin dashboard / exports. */
function listActivities(limit = 200) {
    if (!enabled()) return Promise.resolve([]);
    return init().then(ok => {
        if (!ok) return [];
        return getPool()
            .query(
                "SELECT email, session_id, activity, detail, created_at FROM investai_activities ORDER BY created_at DESC LIMIT $1",
                [limit]
            )
            .then(result => result.rows)
            .catch(error => {
                console.warn("Activity list failed:", error.message);
                return [];
            });
    });
}

function listUsers(limit = 200) {
    if (!enabled()) return Promise.resolve([]);
    return init().then(ok => {
        if (!ok) return [];
        return getPool()
            .query(
                "SELECT email, name, language, currency, created_at FROM investai_users ORDER BY created_at DESC LIMIT $1",
                [limit]
            )
            .then(result => result.rows)
            .catch(error => {
                console.warn("User list failed:", error.message);
                return [];
            });
    });
}

module.exports = { enabled, init, track, upsertUser, listActivities, listUsers };
