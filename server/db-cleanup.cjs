/* Cleanup temp verification rows from the earlier db-verify run. */
require("dotenv").config();
const { Client } = require("pg");

(async () => {
    const c = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    try {
        await c.connect();
        const d = await c.query("DELETE FROM investai_activities WHERE email = 'db-verify@test.local'");
        const u = await c.query("DELETE FROM investai_users WHERE email = 'db-verify@test.local'");
        const after = await c.query(
            "SELECT (SELECT COUNT(*) FROM investai_users) users, (SELECT COUNT(*) FROM investai_activities) acts"
        );
        console.log(JSON.stringify({
            deletedActivities: d.rowCount,
            deletedUsers: u.rowCount,
            remaining: after.rows[0]
        }));
    } catch (e) {
        console.error("cleanup error:", e.message);
        process.exit(1);
    } finally {
        await c.end();
    }
})();
