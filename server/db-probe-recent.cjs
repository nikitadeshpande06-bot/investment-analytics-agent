/* Read-only probe for the most recent rows. */
require("dotenv").config();
const { Client } = require("pg");

(async () => {
    const c = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    await c.connect();
    const a = await c.query(
        "SELECT email, activity, session_id, created_at FROM investai_activities ORDER BY created_at DESC LIMIT 15"
    );
    console.log("RECENT ACTS", a.rows.length);
    a.rows.forEach(x => console.log(" ", x.created_at, "|", x.email, "|", x.activity, "|", x.session_id));
    const u = await c.query(
        "SELECT email, name, language, currency, created_at FROM investai_users ORDER BY created_at DESC LIMIT 10"
    );
    console.log("RECENT USERS", u.rows.length);
    u.rows.forEach(x => console.log(" ", x.created_at, "|", x.email, "|", x.name, "|", x.language, "|", x.currency));
    await c.end();
})().catch(e => { console.error("ERR:", e.message); process.exit(1); });
