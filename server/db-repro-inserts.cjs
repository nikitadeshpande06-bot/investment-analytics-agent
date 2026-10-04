/* Reproduce the exact tracking.js insert failures against the real schema. */
require("dotenv").config();
const { Pool } = require("pg");

(async () => {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    /* 1. The exact upsertUser SQL from tracking.js */
    try {
        await pool.query(
            `INSERT INTO investai_users (email, name, language, currency)
             VALUES ($1,$2,$3,$4)
             ON CONFLICT (email) DO UPDATE
             SET name = EXCLUDED.name,
                 language = COALESCE(EXCLUDED.language, investai_users.language),
                 currency = COALESCE(EXCLUDED.currency, investai_users.currency)`,
            ["repro@test.local", "Repro", "en", "USD"]
        );
        console.log("upsertUser SQL: OK");
    } catch (e) {
        console.log("upsertUser SQL FAILED:", e.message);
    }

    /* 2. The exact track SQL from tracking.js */
    try {
        await pool.query(
            "INSERT INTO investai_activities (email, session_id, activity, detail) VALUES ($1,$2,$3,$4)",
            ["repro@test.local", "sess-repro", "probe", "repro"]
        );
        console.log("track SQL: OK");
    } catch (e) {
        console.log("track SQL FAILED:", e.message);
    }

    await pool.end();
})().catch(e => { console.error("ERR:", e.message); process.exit(1); });
