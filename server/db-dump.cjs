/* Direct DB read of investai_activities — evidence dump. */
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
            "SELECT email, activity, session_id, detail, created_at FROM investai_activities ORDER BY created_at DESC LIMIT 20"
        );
        console.log("DIRECT DB ACTS:", acts.rows.length);
        acts.rows.forEach(x =>
            console.log(" ", x.email, "|", x.activity, "|", x.session_id, "|", x.created_at)
        );

        const users = await c.query(
            "SELECT email, name, created_at FROM investai_users ORDER BY created_at DESC LIMIT 20"
        );
        console.log("DIRECT DB USERS:", users.rows.length);
        users.rows.forEach(x => console.log(" ", x.email, "|", x.name, "|", x.created_at));

        await c.end();
    } catch (e) {
        console.error("ERR:", e.message);
        process.exit(1);
    }
})();
