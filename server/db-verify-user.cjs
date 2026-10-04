/* Verify DB rows for the e2e-verify user + restart persistence check. */
require("dotenv").config();
const { Client } = require("pg");
const fs = require("fs");

(async () => {
    const email = process.argv[2] || fs.readFileSync("../e2e-verify-email.txt", "utf8").trim();
    console.log("CHECKING:", email);
    const c = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    await c.connect();
    const a = await c.query(
        "SELECT email, activity, session_id, detail, created_at FROM investai_activities WHERE email=$1 ORDER BY created_at ASC", [email]);
    console.log("ACTS", a.rows.length);
    a.rows.forEach(x => console.log(" ", x.activity, "|", x.session_id, "|", x.detail, "|", x.created_at));
    const u = await c.query(
        "SELECT email, name, language, currency, created_at FROM investai_users WHERE email=$1", [email]);
    console.log("USERS", u.rows.length);
    u.rows.forEach(x => console.log(" ", x.email, "|", x.name, "|", x.language, "|", x.currency, "|", x.created_at));
    await c.end();
})().catch(e => { console.error("ERR:", e.message); process.exit(1); });
