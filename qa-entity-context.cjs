/* Additive context verification: bond risks follow-up + regression of prior flows. */
const fs = require("fs");
const src = fs.readFileSync(__dirname + "/src/dashboard.js", "utf8");

const start = src.indexOf("const LOCAL_TOPICS");
const end = src.indexOf("const INVESTMENT_REFUSAL");
if (start < 0 || end < 0) { console.error("section not found"); process.exit(1); }
let code = src.slice(start, end);
code = "const chatSettings = " + JSON.stringify({ riskLevel: "moderate", horizon: "long", followUpContext: true }) + ";\n" + code;
eval(code);

const historyOf = (...pairs) => {
    const h = [];
    for (const [q, a] of pairs) { h.push({ role: "user", content: q }); h.push({ role: "assistant", content: a }); }
    return h;
};

const answer = (q, hist) => getFollowUpAnswer(q, hist) || getLocalAnswer(q, hist);

let fail = 0;
const check = (name, cond) => {
    console.log((cond ? "PASS" : "FAIL") + ": " + name);
    if (!cond) fail++;
};

/* 1. Bonds -> risks follow-up (the core bug fixed) */
const bondHist = historyOf(["What are bonds?", getLocalAnswer("What are bonds?", [])]);
const bondRisk = answer("What are their risks?", bondHist);
check("bond risks: mentions interest-rate", /interest-rate/i.test(bondRisk));
check("bond risks: mentions credit/default", /credit|default/i.test(bondRisk));
check("bond risks: mentions inflation", /inflation/i.test(bondRisk));
check("bond risks: mentions liquidity", /liquidity/i.test(bondRisk));
check("bond risks: NOT the generic portfolio-risk answer",
    !/Use the Risk Evaluator section/i.test(bondRisk) &&
    !/It depends on asset mix, time horizon and concentration/i.test(bondRisk));

/* 2. Bonds -> how do they generate returns (already worked, must stay) */
const bondHow = answer("How do they generate returns?", bondHist);
check("bond returns: coupon/interest + principal", /interest|coupon/i.test(bondHow) && /principal/i.test(bondHow));
check("bond returns: about bonds", /bond|issuer|lending/i.test(bondHow));

/* 3. Pronoun resolution across other topics */
for (const [seed, seedExpect, follow, followExpect] of [
    ["What are stocks?", /ownership/i, "What are their risks?", /market downturns/i],
    ["What are ETFs?", /basket/i, "What are their risks?", /tracking error/i],
    ["What is diversification?", /spreading/i, "What are their risks?", /over-diversification|correlation/i],
    ["What is compound growth?", /returns start earning/i, "What are its risks?", /Time risk|panicselling|panic-selling|starting late/i],
    ["What are emerging markets?", /developing economies/i, "What are their risks?", /currency risk/i],
]) {
    const hist = historyOf([seed, getLocalAnswer(seed, [])]);
    check(`seed answers: ${seed}`, seedExpect.test(getLocalAnswer(seed, [])));
    const ans = answer(follow, hist);
    check(`${seed} -> "${follow}" topic-specific`, followExpect.test(ans));
}

/* 4. REITs now a first-class topic */
const reitHist = historyOf(["What are REITs?", getLocalAnswer("What are REITs?", [])]);
const reitRisk = answer("What are their risks?", reitHist);
check("REITs: follow-up resolves", /interest|risk/i.test(reitRisk) && !/great question/i.test(reitRisk));
const reitTypes = answer("What are their types?", reitHist);
check("REITs: types follow-up resolves", /REIT|equity|mortgage/i.test(reitTypes));

/* 5. Definition-variant distinction still works (portfolio vs investment risk) */
const prHist = historyOf(["What is portfolio risk?", getLocalAnswer("What is portfolio risk?", [])]);
const irAns = answer("What is investment risk?", prHist);
check("portfolio risk -> investment risk explains relationship", /portfolio risk is/i.test(irAns) && /investment risk is/i.test(irAns));

/* 6. Risk types follow-up still works */
const riskHist = historyOf(["What is investment risk?", getLocalAnswer("What is investment risk?", [])]);
check("investment risk -> its types lists market risk", /market risk/i.test(answer("What are its types?", riskHist)));

/* 7. Elaboration still expands, not repeats */
const elab = answer("Elaborate it", riskHist);
check("elaboration still works", /Going deeper/i.test(elab));

/* 8. Generic patterns must still resolve without history */
check("no history: 'Why is it important?' does not crash", typeof answer("Why is it important?", []) === "string");

/* 9. Non-followup independent question does not inherit topic */
check("independent question not hijacked by context",
    getFollowUpAnswer("Compare bonds and stocks?", bondHist) === null || /compar/i.test(answer("Compare bonds and stocks?", bondHist)));

console.log(fail === 0 ? "\nALL CHECKS PASSED" : `\n${fail} CHECK(S) FAILED`);
process.exit(fail === 0 ? 0 : 1);
