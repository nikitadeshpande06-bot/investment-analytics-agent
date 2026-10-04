/* Full user-journey e2e: signup/login/logout/chat/analyze as the frontend
 * would send them, then DB verification. Read-only vs application code. */
const EMAIL = "e2e-verify-" + Date.now() + "@test.local";
const BASE = "http://localhost:4000";
const results = [];
const record = (name, ok, detail) => results.push({ name, ok, detail: detail || "" });

const post = async (path, body) => {
    const r = await fetch(BASE + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    let data = null;
    try { data = await r.json(); } catch (e) {}
    return { status: r.status, data };
};
const trackUser = (user, activity, detail) =>
    post("/api/track-user", {
        email: user.email, name: user.name, language: user.language,
        currency: user.currency, activity, detail
    });
const wait = ms => new Promise(r => setTimeout(r, ms));

async function main() {
    console.log("EMAIL:", EMAIL);

    /* 1. signup (as auth.js: trackUser(..., "signup", "New account created")) */
    const su = await trackUser({ email: EMAIL, name: "Verify User", language: "en", currency: "USD" }, "signup", "New account created");
    record("signup: /api/track-user 200 + success", su.status === 200 && su.data.success === true, JSON.stringify(su.data).slice(0, 80));

    /* 2. login (second session: trackUser(..., "login")) */
    const li = await trackUser({ email: EMAIL }, "login");
    record("login: /api/track-user 200 + success", li.status === 200 && li.data.success === true, JSON.stringify(li.data).slice(0, 80));

    /* 3. chat while logged in */
    const ch = await post("/api/chat", { question: "What are bonds?", sessionId: "verify-chat-" + Date.now() });
    record("chat: bonds answer", ch.status === 200 && /Bonds are loans/i.test(ch.data.answer || ""), (ch.data.answer || "").slice(0, 60));

    /* 4. investment analysis while logged in */
    const an = await post("/api/analyze", { type: "portfolio", budget: 10000, risk: "moderate", horizon: 10, goal: "growth" });
    record("analyze: portfolio", an.status === 200 && an.data.result?.allocation?.length === 4, JSON.stringify(an.data.result?.allocation || an.data).slice(0, 80));

    /* 5. logout (trackUser(..., "logout")) */
    const lo = await trackUser({ email: EMAIL }, "logout");
    record("logout: /api/track-user 200 + success", lo.status === 200 && lo.data.success === true, JSON.stringify(lo.data).slice(0, 80));

    /* allow fire-and-forget tracking to flush */
    await wait(1500);

    console.log(JSON.stringify({ EMAIL, results }, null, 2));
    require("fs").writeFileSync("e2e-verify-email.txt", EMAIL);
}
main().catch(e => { console.error("crash:", e); process.exit(1); });
