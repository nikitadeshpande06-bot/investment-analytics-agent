/* Dump only the e2e test rows from Supabase. */
require("dotenv").config();
const { Client } = require("pg");

(async () => {
    const c = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    try {
        await c.connect();
        const acts = await c.query(
            "SELECT email, activity, session_id, detail, created_at FROM investai_activities WHERE email LIKE 'e2e%' ORDER BY created_at ASC"
        );
        console.log("E2E ACTS:", acts.rows.length);
        acts.rows.forEach(x =>
            console.log(" ", x.email, "|", x.activity, "|", x.session_id, "|", x.detail, "|", x.created_at)
        );

        const users = await c.query(
            "SELECT email, name, language, currency, created_at FROM investai_users WHERE email LIKE 'e2e%'"
        );
        console.log("E2E USERS:", users.rows.length);
        users.rows.forEach(x => console.log(" ", x.email, "|", x.name, "|", x.language, "|", x.currency, "|", x.created_at));

        await c.end();
    } catch (e) {
        console.error("ERR:", e.message);
        process.exit(1);
    }
})();
