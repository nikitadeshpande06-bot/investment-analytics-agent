/* Inspect actual schema of investai_users / investai_activities in Supabase. */
require("dotenv").config();
const { Pool } = require("pg");

(async () => {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    const q = (t) => pool.query(
        "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = '" + t + "' ORDER BY ordinal_position"
    );
    const u = await q("investai_users");
    console.log("--- investai_users ---");
    u.rows.forEach(x => console.log(" ", x.column_name, "|", x.data_type, "|", x.column_default));
    const a = await q("investai_activities");
    console.log("--- investai_activities ---");
    a.rows.forEach(x => console.log(" ", x.column_name, "|", x.data_type, "|", x.column_default));
    await pool.end();
})().catch(e => { console.error("ERR:", e.message); process.exit(1); });
