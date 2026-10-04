/* One-shot patcher: wires tracking into server.js (idempotent). */
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "server.js");
let s = fs.readFileSync(file, "utf8");
const before = s.length;
let changed = [];

if (!s.includes('require("./tracking")')) {
    s = s.replace(
        'const cors = require("cors");',
        'const cors = require("cors");\nconst tracking = require("./tracking");'
    );
    changed.push("import tracking");
}

if (!s.includes("tracking.init()")) {
    s = s.replace(
        'app.use(express.json({ limit: "1mb" }));',
        'app.use(express.json({ limit: "1mb" }));\n\n/* Cloud tracking — initializes investai_users / investai_activities.\n * No-op when DATABASE_URL is absent. */\ntracking.init();'
    );
    changed.push("tracking.init()");
}

/* --- /api/track-user --- */
if (!s.includes('/api/track-user')) {
    const trackUserRoute = `
app.post("/api/track-user", (req, res) => {
    try {
        const body = req.body || {};
        const email = String(body.email || "").trim();

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "email is required."
            });
        }

        const activity = String(body.activity || "login").slice(0, 100);
        const detail = body.detail ? String(body.detail).slice(0, 500) : null;
        const sessionId = body.sessionId || req.get("x-session-id") || null;

        tracking.upsertUser({
            email,
            name: body.name,
            language: body.language,
            currency: body.currency
        }).catch(error => console.warn("track-user upsert failed:", error.message));

        tracking.track(email, sessionId, activity, detail).catch(error =>
            console.warn("track-user activity failed:", error.message)
        );

        res.json({ success: true });
    } catch (error) {
        console.error("track-user error:", error);
        res.status(500).json({
            success: false,
            message: "Internal analytics server error."
        });
    }
});

/* Serve the dashboard itself so the frontend and the API share one
 * origin (opening the file directly still works via CORS). */`;
    s = s.replace(
        `/* Serve the dashboard itself so the frontend and the API share one
 * origin (opening the file directly still works via CORS). */`,
        trackUserRoute
    );
    changed.push("/api/track-user route");
}

/* --- tracking in /api/chat --- */
if (!s.includes('tracking.track(\n            body.email')) {
    s = s.replace(
        `        res.json({
            success: true,
            question,
            answer: result.answer,
            refused: result.refusal
        });
    } catch (error) {
        console.error("Chat API error:", error);`,
        `        res.json({
            success: true,
            question,
            answer: result.answer,
            refused: result.refusal
        });

        /* Fire-and-forget activity tracking — never affects the response. */
        tracking.track(
            body.email || req.get("x-user-email") || null,
            sessionId || null,
            "chat",
            question.slice(0, 200)
        );
    } catch (error) {
        console.error("Chat API error:", error);`
    );
    changed.push("/api/chat tracking");
}

/* --- tracking in /api/analyze --- */
if (!s.includes('tracking.track(\n            payload.email')) {
    s = s.replace(
        `        res.json({
            success: true,
            result,
            engine: "local rule-based",
            createdAt: new Date().toISOString()
        });
    } catch (error) {
        console.error("Analyze API error:", error);`,
        `        res.json({
            success: true,
            result,
            engine: "local rule-based",
            createdAt: new Date().toISOString()
        });

        /* Fire-and-forget activity tracking — never affects the response. */
        tracking.track(
            payload.email || req.get("x-user-email") || null,
            payload.sessionId || req.get("x-session-id") || null,
            "analyze_" + String(payload.type || "unknown"),
            JSON.stringify(payload).slice(0, 200)
        );
    } catch (error) {
        console.error("Analyze API error:", error);`
    );
    changed.push("/api/analyze tracking");
}

/* --- admin summary --- */
if (!s.includes('/api/admin/summary')) {
    const adminRoutes = `
app.get("/api/admin/summary", (req, res) => {
    try {
        const token = String(req.query.token || "");

        if (!token || token !== (process.env.ADMIN_TOKEN || "investai-admin")) {
            return res.status(401).json({
                success: false,
                message: "Invalid admin token."
            });
        }

        Promise.all([
            tracking.listUsers(200),
            tracking.listActivities(200)
        ])
            .then(([users, activities]) => {
                const perUser = {};

                activities.forEach(a => {
                    const key = a.email || "(anonymous)";
                    if (!perUser[key]) {
                        perUser[key] = { email: key, activityCount: 0, lastActivity: null };
                    }
                    perUser[key].activityCount += 1;
                    if (!perUser[key].lastActivity || a.created_at > perUser[key].lastActivity) {
                        perUser[key].lastActivity = a.created_at;
                    }
                });

                res.json({
                    success: true,
                    counts: {
                        users: users.length,
                        activities: activities.length
                    },
                    perUser: Object.values(perUser),
                    users,
                    activities
                });
            })
            .catch(error => {
                console.error("admin summary error:", error);
                res.status(500).json({
                    success: false,
                    message: "Internal analytics server error."
                });
            });
    } catch (error) {
        console.error("admin summary error:", error);
        res.status(500).json({
            success: false,
            message: "Internal analytics server error."
        });
    }
});

app.get("/api/admin/export", (req, res) => {
    try {
        const token = String(req.query.token || "");

        if (!token || token !== (process.env.ADMIN_TOKEN || "investai-admin")) {
            return res.status(401).json({
                success: false,
                message: "Invalid admin token."
            });
        }

        const format = String(req.query.format || "csv").toLowerCase();

        Promise.all([tracking.listUsers(10000), tracking.listActivities(10000)])
            .then(([users, activities]) => {
                const esc = v => String(v == null ? "" : v).replace(/[<>&]/g, c =>
                    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
                const csvCell = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';

                if (format === "xlsx") {
                    let xml =
                        '<?xml version="1.0"?>\\n<?mso-application progid="Excel.Sheet"?>\\n' +
                        '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ' +
                        'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';

                    const sheet = (name, rows, cols) => {
                        let out = '<Worksheet ss:Name="' + esc(name) + '"><Table>';
                        out += '<Row>' + cols.map(c => '<Cell><Data ss:Type="String">' + esc(c) + '</Data></Cell>').join("") + '</Row>';
                        rows.forEach(r => {
                            out += '<Row>' + cols.map(c => '<Cell><Data ss:Type="String">' + esc(r[c]) + '</Data></Cell>').join("") + '</Row>';
                        });
                        return out + '</Table></Worksheet>';
                    };

                    xml += sheet("Users", users, ["email", "name", "language", "currency", "created_at"]);
                    xml += sheet("Activities", activities, ["email", "session_id", "activity", "detail", "created_at"]);
                    xml += '</Workbook>';

                    res.set("Content-Type", "application/vnd.ms-excel");
                    res.set("Content-Disposition", 'attachment; filename="investai-export.xls"');
                    return res.send(xml);
                }

                /* default: CSV */
                let csv = "type,email,name,language,currency,session_id,activity,detail,created_at\\n";
                users.forEach(u => {
                    csv += ["user", u.email, u.name, u.language, u.currency, "", "", "", u.created_at].map(csvCell).join(",") + "\\n";
                });
                activities.forEach(a => {
                    csv += ["activity", a.email, "", "", "", a.session_id, a.activity, a.detail, a.created_at].map(csvCell).join(",") + "\\n";
                });

                res.set("Content-Type", "text/csv; charset=utf-8");
                res.set("Content-Disposition", 'attachment; filename="investai-export.csv"');
                res.send(csv);
            })
            .catch(error => {
                console.error("admin export error:", error);
                res.status(500).json({
                    success: false,
                    message: "Internal analytics server error."
                });
            });
    } catch (error) {
        console.error("admin export error:", error);
        res.status(500).json({
            success: false,
            message: "Internal analytics server error."
        });
    }
});

app.listen(PORT, () => {`;
    s = s.replace(
        `app.listen(PORT, () => {`,
        adminRoutes
    );
    changed.push("/api/admin/summary + /api/admin/export routes");
}

/* --- startup log lines --- */
if (!s.includes('console.log("  POST /api/track-user");')) {
    s = s.replace(
        'console.log("  POST /api/analyze");',
        'console.log("  POST /api/analyze");\n    console.log("  POST /api/track-user");\n    console.log("  GET  /api/admin/summary");\n    console.log("  GET  /api/admin/export");'
    );
    changed.push("startup log lines");
}

fs.writeFileSync(file, s);
console.log("patch applied:", changed.join(", ") || "nothing to change");
console.log("len:", before, "->", s.length);
