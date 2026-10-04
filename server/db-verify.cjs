/* DB verification harness — reads .env, connects to Supabase Session Pooler,
 * initializes the investai_* schema, and runs write/read tests.
 * Reports JSON result on stdout. Never prints the password. */
require("dotenv").config();

const fs = require("fs");
const { Client } = require("pg");

const raw = process.env.DATABASE_URL || "";
const redact = (u) => String(u).replace(/\/\/([^:]+):[^@]*@/, "//$1:***@");

async function main() {
    const out = { steps: [] };

    if (!raw) {
        console.log(JSON.stringify({ PASS: false, reason: "DATABASE_URL missing" }));
        process.exit(1);
    }

    // Parse with URLSearchParams-safe approach (password contains '@')
    let parsed;
    try {
        parsed = new URL(raw);
        out.steps.push({ step: "parse-url", ok: true, host: parsed.hostname, port: parsed.port, db: parsed.pathname, user: parsed.username, passwordContainsAt: (decodeURIComponent(parsed.password) || "").includes("@") });
    } catch (e) {
        // try percent-encoding the password portion
        const m = raw.match(/^postgresql:\/\/([^:@/]+):(.+)@([^:/]+):(\d+)\/(.+)$/);
        if (m) {
            const fixed = `postgresql://${m[1]}:${encodeURIComponent(m[2])}@${m[3]}:${m[4]}/${m[5]}`;
            parsed = new URL(fixed);
            out.steps.push({ step: "parse-url-with-encoding", ok: true, host: parsed.hostname, note: "raw URL was invalid, password percent-encoded for test only" });
        } else {
            console.log(JSON.stringify({ PASS: false, reason: "cannot parse DATABASE_URL", err: e.message }));
            process.exit(1);
        }
    }

    // Build a working connection string (password percent-encoded)
    let cs;
    try {
        const u = new URL(raw);
        const pw = decodeURIComponent(u.password || "");
        cs = `postgresql://${u.username}:${encodeURIComponent(pw)}@${u.hostname}:${u.port || 5432}${u.pathname}`;
        out.steps.push({ step: "build-connstring", ok: true });
    } catch (e) {
        const m = raw.match(/^postgresql:\/\/([^:@/]+):(.+)@([^:/]+):(\d+)\/(.+)$/);
        cs = `postgresql://${m[1]}:${encodeURIComponent(m[2])}@${m[3]}:${m[4]}/${m[5]}`;
        out.steps.push({ step: "build-connstring-regex", ok: true });
    }

    const client = new Client({
        connectionString: cs,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000
    });

    try {
        await client.connect();
        out.steps.push({ step: "connect", ok: true });

        const vr = await client.query("SELECT version()");
        out.steps.push({ step: "select-version", ok: true, version: vr.rows[0].version.slice(0, 60) });

        const schema = fs.readFileSync(require("path").join(__dirname, "schema-test.sql"), "utf8");
        await client.query(schema);
        out.steps.push({ step: "create-tables", ok: true });

        // WRITE test
        const stamp = Date.now();
        await client.query(
            "INSERT INTO investai_activities (email, session_id, activity, detail) VALUES ($1,$2,$3,$4)",
            ["db-verify@test.local", "verify-" + stamp, "db_write_test", "verification write at " + new Date().toISOString()]
        );
        out.steps.push({ step: "insert-activity", ok: true, marker: "verify-" + stamp });

        await client.query(
            `INSERT INTO investai_users (email, name, language, currency)
             VALUES ($1,$2,$3,$4)
             ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name`,
            ["db-verify@test.local", "DB Verify", "en", "USD"]
        );
        out.steps.push({ step: "upsert-user", ok: true });

        // READ test (verify the write landed)
        const act = await client.query(
            "SELECT email, session_id, activity, detail FROM investai_activities WHERE session_id = $1",
            ["verify-" + stamp]
        );
        out.steps.push({ step: "read-activity-back", ok: act.rowCount === 1, rows: act.rowCount });

        const usr = await client.query(
            "SELECT email, name FROM investai_users WHERE email = $1",
            ["db-verify@test.local"]
        );
        out.steps.push({ step: "read-user-back", ok: usr.rowCount === 1, name: usr.rows[0] && usr.rows[0].name });

        // Counts
        const counts = await client.query(
            "SELECT (SELECT COUNT(*) FROM investai_users) AS users, (SELECT COUNT(*) FROM investai_activities) AS activities"
        );
        out.counts = { users: counts.rows[0].users, activities: counts.rows[0].activities };
        out.PASS = true;
    } catch (e) {
        out.PASS = false;
        out.error = e.message;
        out.code = e.code;
    } finally {
        try { await client.end(); } catch (_) {}
    }

    console.log(JSON.stringify(out, null, 2));
}

main();
