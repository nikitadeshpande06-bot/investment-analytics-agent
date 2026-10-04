/* Backend end-to-end test: starts nothing (assumes server running),
 * hits /api/health, /api/chat (context chains + guard + formats),
 * and /api/analyze (all four types). */
const BASE = "http://localhost:4000";

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
    if (ok) { pass++; console.log("PASS  " + name); }
    else { fail++; console.log("FAIL  " + name + (detail ? " -> " + detail : "")); }
};

async function post(path, body) {
    const r = await fetch(BASE + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    let data = null;
    try { data = await r.json(); } catch (e) { /* noop */ }
    return { status: r.status, data };
}

async function main() {
    /* --- health --- */
    const health = await fetch(BASE + "/api/health").then(r => r.json());
    check("health: ok", health.status === "ok", JSON.stringify(health).slice(0, 80));
    check("health: no external AI", health.ai === "none" && health.externalApis === "none");

    /* --- chat: basic topical question --- */
    const c1 = await post("/api/chat", { message: "What are bonds?" });
    check("chat: bonds definition", c1.status === 200 && /Bonds are loans/i.test(c1.data.answer), (c1.data.answer || "").slice(0, 80));

    /* --- chat: pronoun chain over client history --- */
    const hist = [];
    const t1 = await post("/api/chat", { question: "What are bonds?", history: hist });
    hist.push({ role: "user", content: "What are bonds?" });
    hist.push({ role: "assistant", content: t1.data.answer });
    const t2 = await post("/api/chat", { question: "How do they generate returns?", history: hist });
    check("chat: pronoun 'they' -> bonds", /bond/i.test(t2.data.answer) && !/Here's how|Great question/i.test(t2.data.answer), (t2.data.answer || "").slice(0, 80));
    hist.push({ role: "user", content: "How do they generate returns?" });
    hist.push({ role: "assistant", content: t2.data.answer });
    const t3 = await post("/api/chat", { question: "What are their risks?", history: hist });
    check("chat: 'their risks' -> bond risks", /Interest-rate risk|Credit\/default/i.test(t3.data.answer), (t3.data.answer || "").slice(0, 80));

    /* --- chat: server-side session history (no client history) --- */
    const s1 = await post("/api/chat", { question: "What is investment risk?", sessionId: "test-sess" });
    const s2 = await post("/api/chat", { question: "What are its types?", sessionId: "test-sess" });
    check("chat: session history resolves 'its types' -> investment risk types", /types of investment risk/i.test(s2.data.answer), (s2.data.answer || "").slice(0, 80));

    /* --- chat: investment-only guard --- */
    const g1 = await post("/api/chat", { question: "What is the capital of France?" });
    check("chat: off-topic refused", g1.data.answer && /only help with/i.test(g1.data.answer), (g1.data.answer || "").slice(0, 80));

    /* --- chat: bullet + shorten chain --- */
    const b1 = await post("/api/chat", { question: "What are bonds?" });
    const b2 = await post("/api/chat", { message: "Give it in bullet points", sessionId: "test-bullets", question: "What are bonds?" });
    /* build history explicitly for format follow-ups */
    const fh = [
        { role: "user", content: "What are bonds?" },
        { role: "assistant", content: b1.data.answer }
    ];
    const b3 = await post("/api/chat", { question: "Give it in bullet points", history: fh });
    check("chat: bullets of bond answer", /bullet points/i.test(b3.data.answer) && /Bonds are loans/i.test(b3.data.answer), (b3.data.answer || "").slice(0, 80));
    fh.push({ role: "user", content: "Give it in bullet points" });
    fh.push({ role: "assistant", content: b3.data.answer });
    const b4 = await post("/api/chat", { question: "In short", history: fh });
    check("chat: in-short summarizes bond content, no wrapper", /^In short: /.test(b4.data.answer) && /Bonds are loans/i.test(b4.data.answer) && !/bullet points/i.test(b4.data.answer), (b4.data.answer || "").slice(0, 100));

    /* --- analyze: portfolio --- */
    const a1 = await post("/api/analyze", { type: "portfolio", budget: 10000, risk: "moderate", horizon: 10, goal: "growth" });
    check("analyze: portfolio allocation", a1.status === 200 && a1.data.result.allocation.length === 4 && a1.data.result.allocation[0].amount === 4500, JSON.stringify(a1.data.result?.allocation || a1.data).slice(0, 100));

    /* --- analyze: risk --- */
    const a2 = await post("/api/analyze", { type: "risk", description: "60% equities", investorRisk: "aggressive", horizon: 20 });
    check("analyze: risk score", a2.data.result && a2.data.result.score === 7 && a2.data.result.rating === "High", JSON.stringify(a2.data.result || a2.data).slice(0, 100));

    /* --- analyze: screener --- */
    const a3 = await post("/api/analyze", { type: "screener", risk: "conservative", selected: ["bonds"] });
    check("analyze: screener matches bonds", a3.data.result.results.some(r => r.name === "Government Bonds"), JSON.stringify(a3.data.result?.results?.map(r => r.name) || a3.data).slice(0, 100));

    /* --- analyze: prediction --- */
    const a4 = await post("/api/analyze", { type: "prediction", initial: 1000, risk: "moderate", years: 2, annualContribution: 100 });
    const last = a4.data.result.rows[1];
    check("analyze: projection math", Math.abs(last.endingValue - ((1000 + 100) * 1.075 + 100) * 1.075) < 0.01, JSON.stringify(last));

    /* --- analyze: validation --- */
    const a5 = await post("/api/analyze", { type: "portfolio", budget: -5, risk: "moderate", horizon: 10 });
    check("analyze: invalid input -> 400", a5.status === 400 && a5.data.success === false);

    /* --- dashboard served on same origin --- */
    const page = await fetch(BASE + "/").then(r => r.text());
    check("serve: dashboard html at /", /analytics|InvestAI/i.test(page) && page.includes("chatMessages"));
    const script = await fetch(BASE + "/src/dashboard.js").then(r => r.status);
    check("serve: dashboard.js at /src", script === 200);

    console.log("\n" + pass + " passed, " + fail + " failed");
    /* Delayed exit: process.exit() immediately after concurrent undici
     * fetches trips a libuv assertion on Windows (UV_HANDLE_CLOSING,
     * 0xC0000409). A short timer lets the sockets close cleanly. */
    setTimeout(() => process.exit(fail ? 1 : 0), 100);
}

main().catch(e => { console.error("test crashed:", e.message); process.exit(1); });
