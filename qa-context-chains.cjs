/* Full 3-turn chain verification for the required scenarios. */
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "src", "dashboard.js"), "utf8");

const start = src.indexOf("const LOCAL_TOPICS");
const endMarker = "/* ============================================================\n * FORMAT FOLLOW-UPS";
const end = src.indexOf(endMarker);
let code = src.slice(start, end);
code =
    "const chatSettings = " +
    JSON.stringify({ riskLevel: "moderate", horizon: "long", followUpContext: true }) +
    ";\n" +
    "const state = { chat: [] };\n" +
    "function isBulletFormatRequest(){return false;}\n" +
    "function isShortenRequest(){return false;}\n" +
    code;
code += "\nreturn { getLocalAnswer };";
const engine = new Function("window", code)({});
const getLocalAnswer = engine.getLocalAnswer;

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
    if (ok) { pass++; console.log("PASS  " + name); }
    else { fail++; console.log("FAIL  " + name + (detail ? " -> " + detail : "")); }
};

function turn(hist, q) {
    const a = getLocalAnswer(q, hist);
    hist.push({ role: "user", content: q });
    hist.push({ role: "assistant", content: a });
    return a;
}

/* Chain 1: bonds across three turns */
const h1 = [];
const a0 = turn(h1, "What are bonds?");
const a1 = turn(h1, "How do they generate returns?");
check("chain bonds: returns answer about bonds", /bond/i.test(a1) && !/Here's how|Great question/i.test(a1), a1.slice(0, 80));
const a2 = turn(h1, "What are their risks?");
check("chain bonds: risks answer about bonds", /interest-rate risk|Credit\/default/i.test(a2), a2.slice(0, 80));

/* Chain 2: investment risk -> its types (NOT portfolio risk) */
const h2 = [];
const b0 = turn(h2, "What is investment risk?");
const b1 = turn(h2, "What are its types?");
check("chain risk: types are investment-risk types", /market risk/i.test(b1) && !/Portfolio risk is the risk of your entire/i.test(b1), b1.slice(0, 80));

/* Chain 3: explicit switch bonds -> investment risk -> pronoun follows risk */
const h3 = [];
turn(h3, "What are bonds?");
turn(h3, "What is investment risk?");
const c1 = turn(h3, "Why is it important?");
check("chain switch: 'Why is it important?' follows investment risk", /Understanding risk is important/i.test(c1), c1.slice(0, 80));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
