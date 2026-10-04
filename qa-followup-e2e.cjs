/* END-TO-END follow-up test: simulates the askQuestion pipeline
   (guard -> follow-up handling -> local engine) using the REAL
   functions extracted from dashboard.js source. */
const fs = require("fs");
const src = fs.readFileSync(
  require("path").join(__dirname, "src", "dashboard.js"),
  "utf8"
);

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

const mod = new Function(
  code +
  "\nreturn { LOCAL_TOPICS, getLocalTopicFromHistory, detectQuestionIntent, findTopicInText, getTopicIntentAnswer, getElaborationAnswer, getFollowUpAnswer, getLocalAnswer, isElaborationRequest, isBulletFormatRequest, isShortenRequest, reformatAsBullets, shortenPreviousAnswer, isInvestmentRelated, isContextualFollowUp };"
)();
const fns = mod;

const REFUSAL = "I can only help with investment-related questions.";

/* Mini pipeline mirroring askQuestion's follow-up logic */
function chat(question, history) {
  const q = String(question || "").trim();
  const hist = Array.isArray(history) ? history : [];

  const questionIsFollowUp =
    hist.length > 0 &&
    (fns.isContextualFollowUp(q) ||
      fns.isBulletFormatRequest(q) ||
      fns.isShortenRequest(q) ||
      fns.isElaborationRequest(q));

  if (
    !fns.isInvestmentRelated(q) &&
    !(questionIsFollowUp && hist.some(e => fns.isInvestmentRelated(e.content)))
  ) {
    return REFUSAL;
  }

  const isPureFollowUp =
    questionIsFollowUp && !fns.findTopicInText(q);

  if (isPureFollowUp) {
    const prevA = [...hist].reverse().find(e => e && e.role === "assistant");
    const prevU = [...hist].reverse().find(e => e && e.role === "user");
    const prevAnswer = prevA ? prevA.content : "";
    const prevQuestion = prevU ? prevU.content : "";

    if (fns.isBulletFormatRequest(q)) {
      const r = fns.reformatAsBullets(prevAnswer);
      return r || "Ask an investment question first — then I can reformat that answer in bullet points.";
    }
    if (fns.isShortenRequest(q)) {
      const s = fns.shortenPreviousAnswer(prevAnswer);
      return s || "Ask an investment question first — then I can summarize that answer.";
    }
    if (fns.isElaborationRequest(q)) {
      const e = fns.getElaborationAnswer(prevQuestion, prevAnswer);
      if (e) return e;
    }
    return fns.getLocalAnswer(q, hist);
  }

  /* normal pipeline (server/local) — use local engine for the test */
  return fns.getLocalAnswer(q, hist);
}

const riskAnswer =
  "Portfolio risk is the chance that your investments lose value, driven by asset mix, time horizon and concentration. Use the Risk Evaluator section to score your portfolio from 1-10.";

const hist = [
  { role: "user", content: "What is portfolio risk?" },
  { role: "assistant", content: riskAnswer }
];

let fail = 0;
const check = (name, ok, extra) => {
  if (!ok) fail++;
  console.log((ok ? "PASS" : "FAIL") + " | " + name + (ok || !extra ? "" : " | got: " + extra));
};

/* 1. topical question answered normally */
check("What is portfolio risk? -> definition",
  chat("What is portfolio risk?", []).includes("chance that the combined portfolio loses value"), true);

/* 2. Elaborate it -> expands previous answer, NOT refused */
const elab = chat("Elaborate it", hist);
check("Elaborate it -> not refused", elab !== REFUSAL, elab.slice(0, 80));
check("Elaborate it -> expands prev answer", elab !== riskAnswer && elab.length > 40, elab.slice(0, 80));

const elab2 = chat("Explain more", hist);
check("Explain more -> not refused", elab2 !== REFUSAL, elab2.slice(0, 80));
check("Explain more -> expands prev answer", elab2 !== riskAnswer, elab2.slice(0, 80));

const elab3 = chat("in detail", hist);
check("in detail -> not refused", elab3 !== REFUSAL, elab3.slice(0, 80));

const elab4 = chat("tell me more", hist);
check("tell me more -> not refused", elab4 !== REFUSAL, elab4.slice(0, 80));

/* 3. Give in bullet point(s) -> SAME previous answer as bullets */
const bullets = chat("Give in bullet point", hist);
check("Give in bullet point -> bullets", bullets.startsWith("Here it is in bullet points:"), bullets.slice(0, 80));
check("bullets keep prev content verbatim",
  bullets.includes("chance that your investments lose value") &&
  bullets.includes("Use the Risk Evaluator section"), bullets.slice(0, 120));
check("bullets are NOT a new generic answer", !bullets.includes("Great question") && !bullets.includes("Here's how I'd think about that"), true);

const bullets2 = chat("give it in bullet points", hist);
check("give it in bullet points -> bullets too", bullets2.startsWith("Here it is in bullet points:"), bullets2.slice(0, 80));

/* 4. In short -> summarizes previous answer */
const short = chat("In short", hist);
check("In short -> summary of prev", short.startsWith("In short: ") && short.includes("chance that your investments lose value"), short.slice(0, 80));

const sum = chat("summarize", hist);
check("summarize -> summary", sum.startsWith("In short: "), sum.slice(0, 80));

/* 5. Give an example -> example tied to previous topic */
const ex = chat("Give an example", hist);
check("Give an example -> not refused", ex !== REFUSAL, ex.slice(0, 80));
check("Give an example -> example content", /example/i.test(ex) && ex.length > 30, ex.slice(0, 80));

/* 6. Non-investment still refused (with and without history) */
check("weather refused (no history)", chat("What's the weather like today?", []) === REFUSAL);
check("weather refused (with investment history)", chat("What's the weather like today?", hist) === REFUSAL);
check("pasta refused (with history)", chat("What is the best way to cook pasta?", hist) === REFUSAL);
check("joke refused", chat("Tell me a joke", hist) === REFUSAL);
check("programming refused", chat("How do I write a for loop in Python?", hist) === REFUSAL);

/* 7. Follow-up w/o investment history still refused */
check("'In short' w/o history refused", chat("In short", []) === REFUSAL);
check("'Elaborate it' w/o history refused", chat("Elaborate it", []) === REFUSAL);

/* 8. Intent distinctions preserved */
const divDef = chat("What is diversification?", []);
const divWhy = chat("Why is diversification important?", []);
const divHow = chat("How does diversification work?", []);
check("What is diversification -> definition", divDef.startsWith("Diversification means spreading your money"), divDef.slice(0, 60));
check("Why diversification important -> importance", /important because it reduces/.test(divWhy), divWhy.slice(0, 80));
check("How does diversification work -> mechanism", divHow.includes("correlation"), divHow.slice(0, 80));
check("definition != importance != how", divDef !== divWhy && divWhy !== divHow);

/* 9. Contextual follow-up still resolves topic from history */
const whyIt = chat("Why is it important?", hist);
check("Why is it important? (context) -> not refused", whyIt !== REFUSAL, whyIt.slice(0, 80));
check("Why is it important? -> risk importance", /Understanding risk is important/.test(whyIt), whyIt.slice(0, 80));

/* 10. No 'Personalization:' text leaks into local answers */
check("no Personalization leak", !String(divDef + whyIt + elab + bullets + short).includes("Personalization:"));

console.log(fail === 0 ? "\nALL E2E TESTS PASSED" : "\n" + fail + " FAILURES");
process.exit(fail === 0 ? 0 : 1);
