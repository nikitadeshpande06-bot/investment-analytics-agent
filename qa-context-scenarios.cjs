/* Required-scenario test for context resolution. */
const fs = require("fs");
const path = require("path");

const root = __dirname;
const src = fs.readFileSync(path.join(root, "src", "dashboard.js"), "utf8");

const start = src.indexOf("const LOCAL_TOPICS");
const endMarker = "/* ============================================================\n * FORMAT FOLLOW-UPS";
const end = src.indexOf(endMarker);
if (start < 0 || end < 0) throw new Error("extraction failed");

let code = src.slice(start, end);
code =
    "const chatSettings = " +
    JSON.stringify({ riskLevel: "moderate", horizon: "long", followUpContext: true }) +
    ";\n" +
    "const state = { chat: [] };\n" +
    "function isBulletFormatRequest(){return false;}\n" +
    "function isShortenRequest(){return false;}\n" +
    code;
code += "\nreturn { LOCAL_TOPICS, getLocalAnswer, getFollowUpAnswer, getTopicIntentAnswer, getElaborationAnswer, getLocalTopicFromHistory, findTopicInText, isContextualFollowUp, detectQuestionIntent };";
const mod = new Function("window", code);
const window = {};
const engine = mod(window);
Object.assign(global, engine, { window });

let pass = 0, fail = 0;
function check(name, cond, detail) {
    if (cond) { pass++; console.log("PASS  " + name); }
    else { fail++; console.log("FAIL  " + name + (detail ? " -> " + detail : "")); }
}

function ask(q, hist) {
    return getLocalAnswer(q, hist);
}

/* Scenario 1: bonds topic persists across two pronoun follow-ups */
let hist = [];
hist.push({ role: "user", content: "What are bonds?" });
hist.push({ role: "assistant", content: ask("What are bonds?", []) });
const a1 = ask("How do they generate returns?", hist);
check("S1a bonds -> 'How do they generate returns?' stays on bonds", /bond/i.test(a1) && !/Here's how I'd think|Great question/i.test(a1), a1.slice(0, 100));
hist.push({ role: "user", content: "How do they generate returns?" });
hist.push({ role: "assistant", content: a1 });
const a2 = ask("What are their risks?", hist);
check("S1b bonds -> 'What are their risks?' stays on bonds", /bond/i.test(a2), a2.slice(0, 100));

/* Scenario 2: investment risk -> its types (NOT portfolio risk) */
let hist2 = [];
hist2.push({ role: "user", content: "What is investment risk?" });
hist2.push({ role: "assistant", content: ask("What is investment risk?", []) });
const b1 = ask("What are its types?", hist2);
check("S2 investment risk -> its types", /market risk|credit risk/i.test(b1), b1.slice(0, 120));

/* Scenario 3: elaborate / explain more keeps topic */
let hist3 = [];
hist3.push({ role: "user", content: "What is investment risk?" });
hist3.push({ role: "assistant", content: ask("What is investment risk?", []) });
const c1 = ask("Explain more", hist3);
check("S3 'Explain more' stays on investment risk", /risk/i.test(c1), c1.slice(0, 100));

/* Scenario 4: give an example resolves to context topic */
let hist4 = [];
hist4.push({ role: "user", content: "What are bonds?" });
hist4.push({ role: "assistant", content: ask("What are bonds?", []) });
const d1 = ask("Give an example", hist4);
check("S4 'Give an example' resolves to bonds", /bond|government/i.test(d1), d1.slice(0, 100));

/* Scenario 5: why is it important */
let hist5 = [];
hist5.push({ role: "user", content: "What are stocks?" });
hist5.push({ role: "assistant", content: ask("What are stocks?", []) });
const e1 = ask("Why is it important?", hist5);
check("S5 'Why is it important?' -> stocks", /stock/i.test(e1), e1.slice(0, 100));

/* Scenario 6: new explicit topic switches context */
let hist6 = [];
hist6.push({ role: "user", content: "What are bonds?" });
hist6.push({ role: "assistant", content: ask("What are bonds?", []) });
const f1 = ask("What is diversification?", hist6);
check("S6 explicit new topic switches", /diversif/i.test(f1), f1.slice(0, 100));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
