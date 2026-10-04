/* Verification of the pronoun/entity resolution layer.
 * Loads src/dashboard.js's answer-engine section in isolation,
 * then loads src/context-resolution.js on top and runs scenarios.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "investment-analyst-mcp");
const src = fs.readFileSync(path.join(root, "src", "dashboard.js"), "utf8");

/* Extract the answer-engine block (LOCAL_TOPICS .. end of getLocalAnswer) */
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
code += "\nreturn { getLocalAnswer, isContextualFollowUp, findTopicInText, getFollowUpAnswer, getTopicIntentAnswer };";
const mod = new Function("window", code);
const window = {};
const engine = mod(window);
Object.assign(global, engine, { window });

/* Load the resolution layer on top */
const layer = fs.readFileSync(path.join(root, "src", "context-resolution.js"), "utf8");
new Function("window", layer.replace(/window\./g, "window."))(window);

/* The patched versions must be picked up */
const getLocalAnswer = window.getLocalAnswer;
const isContextualFollowUp = window.isContextualFollowUp;

let pass = 0, fail = 0;
function check(name, cond, detail) {
    if (cond) { pass++; console.log("PASS  " + name); }
    else { fail++; console.log("FAIL  " + name + (detail ? " -> " + detail : "")); }
}

const hist = (q, a) => [
    { role: "user", content: q },
    { role: "assistant", content: a || "ok" }
];

/* 1. The exact example from the requirement */
const bondHist = hist("What are bonds?",
    "Bonds are loans to governments or companies.");
const a1 = getLocalAnswer("How do they generate returns?", bondHist);
check("bonds -> 'How do they generate returns?'", /bond/i.test(a1) && !/Here's how I'd think|Great question/i.test(a1), a1.slice(0, 90));

/* 2. Possessive */
const a2 = getLocalAnswer("What are their risks?", bondHist);
check("bonds -> 'What are their risks?'", /interest-rate risk|Credit\/default/i.test(a2), a2.slice(0, 90));

/* 3. ETFs */
const etfHist = hist("What is an ETF?", "An ETF is a basket of securities.");
const a3 = getLocalAnswer("How does it work?", etfHist);
check("etf -> 'How does it work?'", /ETF|index|securit/i.test(a3), a3.slice(0, 90));

/* 4. Diversification */
const divHist = hist("What is diversification?", "Diversification means spreading your money.");
const a4 = getLocalAnswer("Why is it important?", divHist);
check("diversification -> 'Why is it important?'", /diversif/i.test(a4), a4.slice(0, 90));

/* 5. Pronoun question not in the fixed pattern list */
const a5 = getLocalAnswer("How safe are they?", bondHist);
check("'How safe are they?' resolves (not generic fallback)", /bond/i.test(a5), a5.slice(0, 90));

/* 6. Greeting + pronoun must not hit the greeting answer */
const a6 = getLocalAnswer("Hi, how do they generate returns?", bondHist);
check("greeting + pronoun -> entity answer", /bond/i.test(a6) && !/^Hello/i.test(a6), a6.slice(0, 90));

/* 7. No history -> unchanged behaviour (no false resolution) */
const a7 = getLocalAnswer("How do they generate returns?", []);
check("no history -> falls through normally", typeof a7 === "string" && a7.length > 0);

/* 8. Topic named in the follow-up wins over pronoun */
const a8 = getLocalAnswer("How do ETFs generate returns?", bondHist);
check("explicit topic beats pronoun", /ETF/i.test(a8), a8.slice(0, 90));

/* 9. isContextualFollowUp extended */
check("isContextualFollowUp('How safe are they?')", isContextualFollowUp("How safe are they?") === true);
check("isContextualFollowUp('Who won the football world cup?')", isContextualFollowUp("Who won the football world cup in 2022?") === false);

/* 10. Stocks / REITs generic sweep */
const stockHist = hist("What are stocks?", "Equities represent ownership in companies.");
check("stocks -> 'Are they risky?'", /risk|volatil|loss/i.test(getLocalAnswer("Are they risky?", stockHist)));
const reitHist = hist("What are REITs?", "REITs are property portfolios.");
check("reits -> 'How do they pay income?'", /reit|dividend|property|interest/i.test(getLocalAnswer("How do they pay income?", reitHist)));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
