/* The 3 required fixes, asserted. Full askQuestion pipeline incl.
 * guard, follow-up routing, bullet/shorten handlers, context layer. */
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "src", "dashboard.js"), "utf8");

const extract = (startRe, endMarker) => {
    const i = src.search(startRe);
    if (i < 0) throw new Error("start not found: " + startRe);
    const j = src.indexOf(endMarker, i);
    if (j < 0) throw new Error("end not found: " + endMarker);
    return src.slice(i, j);
};

const code = [
    extract(/const LOCAL_TOPICS/, "/*\n * ELABORATION REQUESTS"),
    extract(/const ELABORATION_PATTERNS/, "const INVESTMENT_KEYWORDS"),
    extract(/const INVESTMENT_KEYWORDS/, "/*\n * True when the message"),
    extract(/const FOLLOW_UP_PATTERNS/, "const BULLET_FORMAT_PATTERNS"),
    extract(/const BULLET_FORMAT_PATTERNS/, "const INVESTMENT_REFUSAL"),
    "const INVESTMENT_REFUSAL = \"I can only help with investment-related questions.\";"
].join("\n");

const prelude =
    "const chatSettings = " +
    JSON.stringify({ riskLevel: "moderate", horizon: "long-term", followUpContext: true, responseDetail: "medium" }) +
    ";\nconst state = { chat: [] };\n";

const engine = new Function(
    prelude + code +
    "\nreturn { LOCAL_TOPICS, getLocalTopicFromHistory, detectQuestionIntent, findTopicInText, getTopicIntentAnswer, getElaborationAnswer, getFollowUpAnswer, getLocalAnswer, isElaborationRequest, isBulletFormatRequest, isShortenRequest, isPointReferenceRequest, isFollowUpTailText, extractPointReference, getPointIndex, buildPointReferenceAnswer, reformatAsBullets, shortenPreviousAnswer, isInvestmentRelated, isContextualFollowUp, extractPreviousAnswerPoints, sessionContext, conversationContext };"
)();

const layer = fs.readFileSync(path.join(__dirname, "src", "context-resolution.js"), "utf8");
const window = {};
Object.assign(global, engine, { window });
new Function("window", layer)(window);
const getLocalAnswer = window.getLocalAnswer;
const isContextualFollowUp = window.isContextualFollowUp;

const INVESTMENT_REFUSAL = "I can only help with investment-related questions.";

function ask(question, history) {
    const q = String(question || "").trim();
    const hist = Array.isArray(history) ? history : [];

    const pointReference = extractPointReference(q);
    const questionIsFollowUp =
        hist.length > 0 &&
        (isContextualFollowUp(q) ||
            isBulletFormatRequest(q) ||
            isShortenRequest(q) ||
            isElaborationRequest(q) ||
            isPointReferenceRequest(q) ||
            (pointReference && isFollowUpTailText(pointReference.rest)));

    if (!isInvestmentRelated(q) &&
        !(questionIsFollowUp && hist.some(e => isInvestmentRelated(e.content)))) {
        return INVESTMENT_REFUSAL;
    }

    const prevA = [...hist].reverse().find(e => e && e.role === "assistant");
    const prevU = [...hist].reverse().find(e => e && e.role === "user");
    const previousAnswer = prevA ? prevA.content : "";
    const previousQuestion = prevU ? prevU.content : "";

    const followUpText = pointReference ? pointReference.rest : q;
    const isPureFollowUp = questionIsFollowUp && !findTopicInText(followUpText);

    if (isPureFollowUp) {
        const pointIndex = (pointReference && pointReference.index) || getPointIndex(followUpText);
        if (pointIndex && (isPointReferenceRequest(q) || (pointReference && isFollowUpTailText(pointReference.rest)))) {
            const pa = buildPointReferenceAnswer(pointIndex, previousAnswer, previousQuestion);
            if (pa) return pa;
        }
        if (isBulletFormatRequest(q)) {
            return reformatAsBullets(previousAnswer) || "Ask an investment question first — then I can reformat that answer in bullet points.";
        }
        if (isShortenRequest(q)) {
            return shortenPreviousAnswer(previousAnswer) || "Ask an investment question first — then I can summarize that answer.";
        }
        if (isElaborationRequest(q)) {
            const e = getElaborationAnswer(previousQuestion, previousAnswer);
            if (e) return e;
        }
        return getLocalAnswer(q, hist);
    }

    return getLocalAnswer(q, hist);
}

function turn(hist, q) {
    const a = ask(q, hist);
    hist.push({ role: "user", content: q });
    hist.push({ role: "assistant", content: a });
    return a;
}

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
    if (ok) { pass++; console.log("PASS  " + name); }
    else { fail++; console.log("FAIL  " + name + (detail ? " -> " + detail : "")); }
};

/* Fix 1: portfolio risk -> its types = PORTFOLIO risk types */
const h1 = [];
turn(h1, "What is portfolio risk?");
const a1 = turn(h1, "What are its types?");
check("fix1: portfolio risk -> portfolio types",
    /types of portfolio risk/i.test(a1) && !/types of investment risk/i.test(a1),
    a1.slice(0, 100));

/* And the reverse: investment risk -> its types = INVESTMENT risk types */
const h1b = [];
turn(h1b, "What is investment risk?");
const a1b = turn(h1b, "What are its types?");
check("fix1b: investment risk -> investment types preserved",
    /types of investment risk/i.test(a1b) && !/types of portfolio risk/i.test(a1b),
    a1b.slice(0, 100));

/* Fix 2: diversification -> its benefits = diversification benefits */
const h2 = [];
turn(h2, "What is diversification?");
const a2 = turn(h2, "What are its benefits?");
check("fix2: diversification -> diversification benefits",
    /Benefits of diversification/i.test(a2) && !/Benefits of stocks/i.test(a2),
    a2.slice(0, 100));

/* Fix 2b: stale-entity guard — stocks asked first, diversification
 * answered on the keyword path, then a pronoun must follow
 * diversification (the newest topic), not stocks. */
const h2b = [
    { role: "user", content: "What are stocks?" },
    { role: "assistant", content: "Stocks are shares of ownership in companies." }
];
turn(h2b, "What is diversification?");
const a2b = turn(h2b, "What are its benefits?");
check("fix2b: pronoun follows newest named topic (not stale stocks)",
    /diversification/i.test(a2b),
    a2b.slice(0, 100));

/* Fix 3: bonds -> bullets -> in short = bond content, no wrapper */
const h3 = [];
turn(h3, "What are bonds?");
const a3a = turn(h3, "Give it in bullet points");
const a3b = turn(h3, "In short");
check("fix3a: bullets reformat bond content",
    a3a.includes("Here it is in bullet points:") &&
    a3a.includes("Bonds are loans to governments"),
    a3a.slice(0, 100));
check("fix3b: in-short summarizes bond content, no wrapper leak",
    a3b.startsWith("In short: ") &&
    /Bonds are loans to governments/i.test(a3b) &&
    !/bullet points/i.test(a3b),
    a3b.slice(0, 120));

/* Regression: existing shorten/bullet behaviour on plain prose */
const h4 = [];
turn(h4, "What is portfolio risk?");
const a4b = turn(h4, "Give it in bullet points");
const a4s = turn(h4, "In short");
check("regression: portfolio def bullets keep content",
    a4b.includes("chance that the combined portfolio loses value"),
    a4b.slice(0, 100));
check("regression: in-short of portfolio bullets has no wrapper",
    a4s.startsWith("In short: ") && !/bullet points/i.test(a4s),
    a4s.slice(0, 120));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
