/* Verifies Supabase connectivity + schema. Prints counts only, never secrets. */
require("dotenv").config();
const { Pool } = require("pg");

const p = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    const u = await p.query("SELECT count(*)::int AS n FROM investai_users");
    const a = await p.query("SELECT count(*)::int AS n FROM investai_activities");
    console.log("users:", u.rows[0].n, "activities:", a.rows[0].n);
    await p.end();
})().catch(e => { console.error("DB error:", e.message); process.exit(1); });
