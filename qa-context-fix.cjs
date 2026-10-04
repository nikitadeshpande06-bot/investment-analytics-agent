/* Functional check of the follow-up context logic in src/dashboard.js.
 * Extracts the rule-based answer-engine section and runs it in isolation.
 */
const fs = require("fs");
const src = fs.readFileSync(__dirname + "/src/dashboard.js", "utf8");

const start = src.indexOf("const LOCAL_TOPICS");
const end = src.indexOf("const INVESTMENT_REFUSAL");
if (start < 0 || end < 0) { console.error("section not found"); process.exit(1); }
let code = src.slice(start, end);

// Stubs for globals used in this section
const chatSettings = { riskLevel: "moderate", horizon: "long", followUpContext: true };
code = "const chatSettings = " + JSON.stringify(chatSettings) + ";\n" + code;

eval(code);

const historyOf = (...pairs) => {
    const h = [];
    for (const [q, a] of pairs) { h.push({ role: "user", content: q }); h.push({ role: "assistant", content: a }); }
    return h;
};

const riskDef = getLocalAnswer("What is investment risk?", []);
const hist = historyOf(
    ["What is investment risk?", riskDef],
);

const tests = [
    ["What are its types?", "types"],
    ["Why is it important?", "why"],
    ["Give examples", "example"],
    ["What are its risks?", "risks or fallthrough"],
];

let fail = 0;
for (const [q] of tests) {
    const ans = getFollowUpAnswer(q, hist) || getLocalAnswer(q, hist);
    const repeatedDef = ans.includes(riskDef.slice(0, 60));
    console.log("Q:", q);
    console.log("A:", ans.slice(0, 160).replace(/\n/g, " | "));
    console.log("repeats definition?", repeatedDef, "\n");
    if (repeatedDef) fail++;
}

// Elaboration / explain more must expand, not repeat
for (const q of ["Elaborate it", "Explain more"]) {
    const ans = getLocalAnswer(q, hist);
    console.log("Q:", q, "->", ans.slice(0, 100).replace(/\n/g, " | "), "\n");
    if (ans.includes(riskDef.slice(0, 60))) fail++;
}

// Definition must still repeat nothing: first question answered with definition
console.log("First Q answer:", riskDef.slice(0, 80));

// "What are its types?" keyword check must not match generic investment types answer
const tAns = getLocalAnswer("What are its types?", hist);
if (!/market risk/i.test(tAns)) { console.error("FAIL: types answer missing market risk"); fail++; }
if (/main types of investments are/i.test(tAns)) { console.error("FAIL: answered generic investment types"); fail++; }

console.log(fail === 0 ? "ALL CHECKS PASSED" : fail + " CHECKS FAILED");
process.exit(fail === 0 ? 0 : 1);
