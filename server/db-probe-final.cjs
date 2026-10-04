/* Read-only probe for the e2e-final-* rows (no modification). */
require("dotenv").config();
const { Client } = require("pg");

(async () => {
    const c = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    await c.connect();
    const a = await c.query(
        "SELECT email, activity, session_id, detail, created_at FROM investai_activities WHERE email LIKE 'e2e-final-%' ORDER BY created_at ASC"
    );
    console.log("ACTS", a.rows.length);
    a.rows.forEach(x => console.log(" ", x.email, "|", x.activity, "|", x.session_id, "|", x.detail, "|", x.created_at));
    const u = await c.query(
        "SELECT email, name, language, currency, created_at FROM investai_users WHERE email LIKE 'e2e-final-%'"
    );
    console.log("USERS", u.rows.length);
    u.rows.forEach(x => console.log(" ", x.email, "|", x.name, "|", x.language, "|", x.currency, "|", x.created_at));
    await c.end();
})().catch(e => { console.error("ERR:", e.message); process.exit(1); });
