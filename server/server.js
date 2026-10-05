/* ============================================================
 * InvestAI — Investment Analytics BACKEND
 *
 * Local Node.js/Express backend for analytics-chatboy.html.
 * NO external AI APIs, NO API keys, NO Ollama requirement:
 * /api/chat runs the SAME rule-based answer engine the dashboard
 * uses in the browser (extracted live from src/dashboard.js, so
 * context resolution, the investment-only guard, follow-ups,
 * bullet/shorten/point-reference and elaboration behaviour are
 * identical), and /api/analyze runs the SAME rule-based analysis
 * formulas as the frontend (portfolio, risk, screener, projection).
 *
 * Endpoints:
 *   GET  /api/health   -> server + engine status
 *   POST /api/chat     -> { message|question, history?, detailed?, sessionId? }
 *                         => { success, answer }
 *   POST /api/analyze  -> { type: "portfolio"|"risk"|"screener"|"prediction", ... }
 *                         => { success, result }
 *   GET  /             -> serves analytics-chatboy.html (same origin, no CORS pain)
 *   GET  /src/*        -> serves the dashboard scripts/styles
 * ============================================================ */

const fs = require("fs");
require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const tracking = require("./tracking");
const { buildXlsx } = require("./xlsx-export");

const app = express();
const PORT = process.env.PORT || 4000;

/* Permissive CORS for local dev; when CORS_ORIGINS is set (production),
 * only those comma-separated origins may call the API. */
const allowedOrigins = (process.env.CORS_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);

const adminToken = function adminToken() {
    const t = process.env.ADMIN_TOKEN;
    if (t) return t;
    /* Legacy "investai-admin" default only in development - production
     * requires an explicit ADMIN_TOKEN (see .env.production.example). */
    if (process.env.NODE_ENV === "production") {
        console.error("ADMIN_TOKEN is REQUIRED in production.");
        return "__no_admin_access__";
    }
    return "investai-admin";
};

app.use(
    cors(
        allowedOrigins.length
            ? {
                  origin(origin, cb) {
                      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
                      return cb(new Error("Origin not allowed by CORS"));
                  }
              }
            : {}
    )
);
app.use(express.json({ limit: "1mb" }));

/* Cloud tracking — initializes investai_users / investai_activities.
 * No-op when DATABASE_URL is absent. */
tracking.init();

/* ============================================================
   LOAD THE REAL CHATBOT ENGINE FROM src/dashboard.js
   The same extraction the QA harnesses use, so the server
   answers EXACTLY like the in-browser engine.
   ============================================================ */

const ROOT = path.join(__dirname, "..");
const dashboardSource = fs.readFileSync(
    path.join(ROOT, "src", "dashboard.js"),
    "utf8"
);

function extract(startPattern, endMarker) {
    const startMatch = dashboardSource.match(startPattern);
    if (!startMatch) throw new Error("engine block not found: " + startPattern);
    const start = startMatch.index;
    const end = dashboardSource.indexOf(endMarker, start);
    if (end < 0) throw new Error("engine end not found: " + endMarker);
    return dashboardSource.slice(start, end);
}

const engineCode = [
    extract(/const LOCAL_TOPICS/, "/*\n * ELABORATION REQUESTS"),
    extract(/const ELABORATION_PATTERNS/, "const INVESTMENT_KEYWORDS"),
    extract(/const INVESTMENT_KEYWORDS/, "/*\n * True when the message"),
    extract(/const FOLLOW_UP_PATTERNS/, "const BULLET_FORMAT_PATTERNS"),
    extract(/const BULLET_FORMAT_PATTERNS/, "const INVESTMENT_REFUSAL")
].join("\n");

const engine = new Function(
    "const chatSettings = " +
        JSON.stringify({
            riskLevel: "moderate",
            horizon: "long-term",
            followUpContext: true,
            responseDetail: "medium"
        }) + ";\n" +
        "const state = { chat: [] };\n" +
        "const API_URL = 'http://localhost:" + PORT + "';\n" +
        engineCode + "\n" +
        "const INVESTMENT_REFUSAL = \"I can only help with investment-related questions.\";\n" +
    "return { LOCAL_TOPICS, getLocalTopicFromHistory, detectQuestionIntent, findTopicInText, getTopicIntentAnswer, getElaborationAnswer, getFollowUpAnswer, getLocalAnswer, isElaborationRequest, isBulletFormatRequest, isShortenRequest, isPointReferenceRequest, isFollowUpTailText, extractPointReference, getPointIndex, buildPointReferenceAnswer, reformatAsBullets, shortenPreviousAnswer, isInvestmentRelated, isContextualFollowUp, isPronounReference, rememberTopicInContext, resolveActiveTopic, conversationContext, INVESTMENT_REFUSAL };"
)();

const {
    getLocalAnswer,
    getElaborationAnswer,
    findTopicInText,
    isElaborationRequest,
    isBulletFormatRequest,
    isShortenRequest,
    isPointReferenceRequest,
    isFollowUpTailText,
    extractPointReference,
    getPointIndex,
    buildPointReferenceAnswer,
    reformatAsBullets,
    shortenPreviousAnswer,
    isInvestmentRelated,
    isContextualFollowUp,
    rememberTopicInContext,
    INVESTMENT_REFUSAL
} = engine;

const DETAILED_SUFFIX =
    "\n\nMore detail: consider how this fits your risk tolerance, " +
    "time horizon, liquidity needs and overall diversification. " +
    "The above are general guidelines, not personalized advice.";

/* ============================================================
   PER-CLIENT CONVERSATION HISTORY
   The dashboard sends its own history; when it does not, the
   server keeps the last turns per sessionId so follow-ups
   ("Why is it important?") still resolve server-side.
   ============================================================ */

const SESSION_HISTORY_LIMIT = 8;

const sessions = new Map();

function getSessionHistory(sessionId) {
    if (!sessionId) return [];
    return sessions.get(sessionId) || [];
}

function saveSessionHistory(sessionId, history) {
    if (!sessionId) return;
    sessions.set(sessionId, history.slice(-SESSION_HISTORY_LIMIT));

    if (sessions.size > 200) {
        const oldest = sessions.keys().next().value;
        sessions.delete(oldest);
    }
}

function normalizeHistory(history) {
    if (!Array.isArray(history)) return [];

    return history
        .filter(
            entry =>
                entry &&
                typeof entry.role === "string" &&
                typeof entry.content === "string" &&
                (entry.role === "user" || entry.role === "assistant")
        )
        .map(entry => ({
            role: entry.role === "user" ? "user" : "assistant",
            content: entry.content.slice(0, 2000)
        }))
        .slice(-SESSION_HISTORY_LIMIT);
}

/* ============================================================
   CHAT PIPELINE — mirrors askQuestion() in dashboard.js
   (guard -> pure follow-up routing -> local answer engine)
   ============================================================ */

function answerQuestion(question, clientHistory, detailed) {
    const cleanQuestion = String(question || "").trim();
    const history = clientHistory.length
        ? clientHistory
        : [];

    if (!cleanQuestion) {
        return { answer: "Please enter a question.", refusal: false };
    }

    /* A question that names a topic updates the active context
     * even when answered outside the intent engine — same rule
     * as the browser pipeline. */
    const namedTopic = findTopicInText(cleanQuestion);
    if (namedTopic) {
        rememberTopicInContext(namedTopic);
    }

    const pointReference = extractPointReference(cleanQuestion);

    const questionIsFollowUp =
        history.length > 0 &&
        (isContextualFollowUp(cleanQuestion) ||
            isBulletFormatRequest(cleanQuestion) ||
            isShortenRequest(cleanQuestion) ||
            isElaborationRequest(cleanQuestion) ||
            isPointReferenceRequest(cleanQuestion) ||
            (pointReference && isFollowUpTailText(pointReference.rest)));

    /* Investment-only guard: mirror the browser behaviour. */
    if (
        !isInvestmentRelated(cleanQuestion) &&
        !(
            questionIsFollowUp &&
            history.some(entry => isInvestmentRelated(entry.content))
        )
    ) {
        return { answer: INVESTMENT_REFUSAL, refusal: true };
    }

    const previousAssistant = [...history]
        .reverse()
        .find(entry => entry && entry.role === "assistant");
    const previousUserEntry = [...history]
        .reverse()
        .find(entry => entry && entry.role === "user");

    const previousAnswer = previousAssistant
        ? previousAssistant.content
        : "";
    const previousQuestion = previousUserEntry
        ? previousUserEntry.content
        : "";

    const followUpText = pointReference ? pointReference.rest : cleanQuestion;

    const isPureFollowUp =
        questionIsFollowUp && !findTopicInText(followUpText);

    if (isPureFollowUp) {
        const pointIndex =
            (pointReference && pointReference.index) ||
            getPointIndex(followUpText);

        if (
            pointIndex &&
            (isPointReferenceRequest(cleanQuestion) ||
                (pointReference && isFollowUpTailText(pointReference.rest)))
        ) {
            const pointAnswer = buildPointReferenceAnswer(
                pointIndex,
                previousAnswer,
                previousQuestion
            );

            if (pointAnswer) {
                return { answer: pointAnswer, refusal: false };
            }
        }

        if (isBulletFormatRequest(cleanQuestion)) {
            const reformatted = reformatAsBullets(previousAnswer);

            return {
                answer: reformatted ||
                    "Ask an investment question first — then I can " +
                    "reformat that answer in bullet points.",
                refusal: false
            };
        }

        if (isShortenRequest(cleanQuestion)) {
            const shortened = shortenPreviousAnswer(previousAnswer);

            return {
                answer: shortened ||
                    "Ask an investment question first — then I can " +
                    "summarize that answer.",
                refusal: false
            };
        }

        if (isElaborationRequest(cleanQuestion)) {
            const elaborated = getElaborationAnswer(
                previousQuestion,
                previousAnswer
            );

            if (elaborated) {
                return {
                    answer: detailed
                        ? elaborated + DETAILED_SUFFIX
                        : elaborated,
                    refusal: false
                };
            }
        }
    }

    const answer = getLocalAnswer(cleanQuestion, history);

    return {
        answer: detailed ? answer + DETAILED_SUFFIX : answer,
        refusal: answer === INVESTMENT_REFUSAL
    };
}

/* ============================================================
   ANALYZE ENGINE — mirrors the dashboard's rule-based formulas
   ============================================================ */

function getPortfolioAllocation(risk) {
    if (risk === "conservative") {
        return [
            { asset: "US Bonds", percentage: 45 },
            { asset: "US Equities", percentage: 30 },
            { asset: "International Equities", percentage: 10 },
            { asset: "Cash / Treasury Bills", percentage: 15 }
        ];
    }

    if (risk === "aggressive") {
        return [
            { asset: "US Equities", percentage: 60 },
            { asset: "International Equities", percentage: 20 },
            { asset: "US Bonds", percentage: 10 },
            { asset: "Cash / Alternatives", percentage: 10 }
        ];
    }

    return [
        { asset: "US Equities", percentage: 45 },
        { asset: "US Bonds", percentage: 30 },
        { asset: "International Equities", percentage: 15 },
        { asset: "Cash / Treasury Bills", percentage: 10 }
    ];
}

function calculateRiskScore(risk) {
    if (risk === "conservative") {
        return { score: 3, rating: "Low to Moderate" };
    }

    if (risk === "aggressive") {
        return { score: 7, rating: "High" };
    }

    return { score: 5, rating: "Moderate" };
}

const screenerCategories = [
    {
        name: "Large Cap Stocks",
        aliases: ["us equities", "equities", "stocks", "large cap stocks"],
        description:
            "Established companies with relatively large market capitalizations.",
        risk: "moderate"
    },
    {
        name: "Technology",
        aliases: ["technology", "tech", "us equities"],
        description:
            "Technology-oriented companies and technology-related investments.",
        risk: "high"
    },
    {
        name: "Healthcare",
        aliases: ["healthcare", "health care"],
        description:
            "Companies operating in healthcare, pharmaceuticals, and medical services.",
        risk: "moderate"
    },
    {
        name: "Consumer Goods",
        aliases: ["consumer goods", "consumer", "us equities"],
        description:
            "Companies providing consumer products and everyday goods.",
        risk: "moderate"
    },
    {
        name: "Government Bonds",
        aliases: ["bonds", "government bonds", "fixed income"],
        description:
            "Debt securities issued by governments and government-related entities.",
        risk: "conservative"
    },
    {
        name: "International Markets",
        aliases: ["international equities", "emerging markets", "international markets"],
        description:
            "Investment opportunities outside the domestic market.",
        risk: "high"
    },
    {
        name: "Real Estate",
        aliases: ["reits", "real estate", "property"],
        description:
            "Real-estate-related investments and property markets.",
        risk: "moderate"
    },
    {
        name: "ETFs",
        aliases: ["etfs", "etf", "exchange traded funds"],
        description:
            "Diversified baskets of securities traded on exchanges, covering many markets.",
        risk: "moderate"
    },
    {
        name: "Commodities",
        aliases: ["commodities", "gold", "raw materials"],
        description:
            "Physical assets such as energy, metals and agricultural products.",
        risk: "high"
    },
    {
        name: "Crypto",
        aliases: ["crypto", "cryptocurrency", "digital assets"],
        description:
            "Highly volatile digital assets; suitable only for aggressive risk profiles.",
        risk: "high"
    },
    {
        name: "Cash Equivalents",
        aliases: ["cash equivalents", "cash", "money market"],
        description:
            "Highly liquid instruments intended for capital preservation.",
        risk: "conservative"
    }
];

function getScreenerResults(selected, risk) {
    function matchesSelection(item, value) {
        const v = value.toLowerCase().trim();

        if (item.name.toLowerCase() === v) return true;

        return (item.aliases || []).some(
            alias =>
                alias === v ||
                v.includes(alias) ||
                alias.includes(v)
        );
    }

    if (selected.length) {
        return screenerCategories.filter(item =>
            selected.some(value => matchesSelection(item, value))
        );
    }

    const compatible =
        risk === "aggressive"
            ? ["conservative", "moderate", "high"]
            : risk === "moderate"
                ? ["conservative", "moderate"]
                : ["conservative"];

    return screenerCategories.filter(item =>
        compatible.includes(item.risk)
    );
}

function getAnnualReturnRates(risk) {
    if (risk === "conservative") {
        return { conservative: 0.04, expected: 0.06, optimistic: 0.08 };
    }

    if (risk === "aggressive") {
        return { conservative: 0.05, expected: 0.09, optimistic: 0.13 };
    }

    return { conservative: 0.045, expected: 0.075, optimistic: 0.105 };
}

function calculateProjection(initial, years, risk, annualContribution = 0) {
    const rates = getAnnualReturnRates(risk);

    const rows = [];

    let conservativeValue = initial;
    let expectedValue = initial;
    let optimisticValue = initial;

    for (let year = 1; year <= years; year++) {
        conservativeValue =
            (conservativeValue + annualContribution) *
            (1 + rates.conservative);

        expectedValue =
            (expectedValue + annualContribution) *
            (1 + rates.expected);

        optimisticValue =
            (optimisticValue + annualContribution) *
            (1 + rates.optimistic);

        rows.push({
            year,
            contribution: annualContribution,
            conservativeValue,
            endingValue: expectedValue,
            optimisticValue
        });
    }

    return rows;
}

function roundMoney(value) {
    return Math.round(value * 100) / 100;
}

function analyze(payload) {
    const type = String(payload.type || "").toLowerCase();

    if (type === "portfolio") {
        const budget = Number(payload.budget);
        const risk = String(payload.risk || "").toLowerCase();
        const horizon = Number(payload.horizon);
        const goal = String(payload.goal || "");
        const holdings = String(payload.holdings || "");
        const excluded = String(payload.excluded || "");

        if (!budget || budget <= 0 || !risk || !horizon || horizon <= 0) {
            return { error: "budget, risk and a positive horizon are required." };
        }

        const allocation = getPortfolioAllocation(risk).map(item => ({
            ...item,
            amount: roundMoney(budget * item.percentage / 100)
        }));

        return {
            type: "portfolio",
            budget,
            risk,
            horizon,
            goal,
            holdings,
            excluded,
            allocation
        };
    }

    if (type === "risk") {
        const description = String(payload.description || "");
        const investorRisk = String(payload.investorRisk || payload.risk || "").toLowerCase();
        const horizon = Number(payload.horizon);
        const marketContext = String(payload.marketContext || "");

        if (!description || !investorRisk || !horizon || horizon <= 0) {
            return {
                error: "description, investorRisk and a positive horizon are required."
            };
        }

        const calculated = calculateRiskScore(investorRisk);

        return {
            type: "risk",
            description,
            investorRisk,
            horizon,
            marketContext,
            score: calculated.score,
            rating: calculated.rating
        };
    }

    if (type === "screener") {
        const risk = String(payload.risk || "").toLowerCase();
        const selected = Array.isArray(payload.selected)
            ? payload.selected.filter(Boolean)
            : [];

        if (!risk) {
            return { error: "risk is required." };
        }

        return {
            type: "screener",
            selected,
            assetClasses: selected,
            risk,
            results: getScreenerResults(selected, risk)
        };
    }

    if (type === "prediction") {
        const initial = Number(payload.initial);
        const risk = String(payload.risk || "").toLowerCase();
        const years = Number(payload.years);
        const annualContribution = Number(payload.annualContribution) || 0;

        if (!initial || initial <= 0 || !risk || !years || years <= 0) {
            return { error: "initial, risk and a positive years value are required." };
        }

        const rows = calculateProjection(
            initial,
            years,
            risk,
            annualContribution
        ).map(row => ({
            ...row,
            conservativeValue: roundMoney(row.conservativeValue),
            endingValue: roundMoney(row.endingValue),
            optimisticValue: roundMoney(row.optimisticValue)
        }));

        const finalRow = rows[rows.length - 1];

        return {
            type: "prediction",
            initial,
            risk,
            years,
            annualContribution,
            rates: getAnnualReturnRates(risk),
            rows,
            summary: {
                conservativeValue: finalRow.conservativeValue,
                expectedValue: finalRow.endingValue,
                optimisticValue: finalRow.optimisticValue
            }
        };
    }

    return {
        error: "Unknown analysis type. Use type: portfolio | risk | screener | prediction."
    };
}

/* ============================================================
   ROUTES
   ============================================================ */

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        service: "InvestAI Analytics Server",
        engine: "local rule-based (dashboard answer engine)",
        ai: "none",
        externalApis: "none",
        uptimeSeconds: Math.round(process.uptime())
    });
});

app.post("/api/chat", (req, res) => {
    try {
        const body = req.body || {};

        const question = String(
            body.question || body.message || ""
        ).trim();

        if (!question) {
            return res.status(400).json({
                success: false,
                message: "Question is required."
            });
        }

        const detailed = body.detailed === true;

        const clientHistory = normalizeHistory(body.history);

        const sessionId =
            typeof body.sessionId === "string" && body.sessionId
                ? body.sessionId
                : req.get("x-session-id") || "";

        /* Server-side history is used only when the client does not
         * send its own (the dashboard always does). */
        const history =
            clientHistory.length
                ? clientHistory
                : normalizeHistory(getSessionHistory(sessionId));

        const result = answerQuestion(question, history, detailed);

        const updated = history.concat(
            { role: "user", content: question },
            { role: "assistant", content: result.answer }
        );

        saveSessionHistory(sessionId, updated);

        res.json({
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
        console.error("Chat API error:", error);
        res.status(500).json({
            success: false,
            message: "Internal analytics server error."
        });
    }
});

app.post("/api/analyze", (req, res) => {
    try {
        const payload = req.body || {};

        if (!payload || typeof payload !== "object") {
            return res.status(400).json({
                success: false,
                message: "A JSON body is required."
            });
        }

        const result = analyze(payload);

        if (result.error) {
            return res.status(400).json({
                success: false,
                message: result.error
            });
        }

        res.json({
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
        console.error("Analyze API error:", error);
        res.status(500).json({
            success: false,
            message: "Internal analytics server error."
        });
    }
});


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
 * origin (opening the file directly still works via CORS). */
app.get("/", (req, res) => {
    res.sendFile(path.join(ROOT, "analytics-chatboy.html"));
});

app.use("/src", express.static(path.join(ROOT, "src")));

/* Serve the Admin Board page (same origin as the admin APIs). */
app.get("/admin", (req, res) => {
    res.sendFile(path.join(ROOT, "admin.html"));
});

/* Also serve /admin.html directly using the same file. */
app.get("/admin.html", (req, res) => {
    res.sendFile(path.join(ROOT, "admin.html"));
});



app.get("/api/admin/summary", (req, res) => {
    try {
        const token = String(req.query.token || "");

        if (!token || token !== adminToken()) {
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

        if (!token || token !== adminToken()) {
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
                    /* Genuine OOXML .xlsx (ZIP of XML parts) - see xlsx-export.js */
                    const xlsx = buildXlsx([
                        { name: "Users", rows: users, cols: ["email", "name", "language", "currency", "created_at"] },
                        { name: "Activities", rows: activities, cols: ["email", "session_id", "activity", "detail", "created_at"] }
                    ]);

                    res.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
                    res.set("Content-Disposition", 'attachment; filename="investai-export.xlsx"');
                    return res.send(xlsx);
                }

                /* default: CSV */
                let csv = "type,email,name,language,currency,session_id,activity,detail,created_at\n";
                users.forEach(u => {
                    csv += ["user", u.email, u.name, u.language, u.currency, "", "", "", u.created_at].map(csvCell).join(",") + "\n";
                });
                activities.forEach(a => {
                    csv += ["activity", a.email, "", "", "", a.session_id, a.activity, a.detail, a.created_at].map(csvCell).join(",") + "\n";
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

app.listen(PORT, () => {
    console.log(
        "InvestAI Analytics Server running on http://localhost:" + PORT
    );
    console.log("  GET  /api/health");
    console.log("  POST /api/chat");
    console.log("  POST /api/analyze");
    console.log("  POST /api/track-user");
    console.log("  GET  /api/admin/summary");
    console.log("  GET  /api/admin/export");
    console.log("  Dashboard: http://localhost:" + PORT + "/");
});
