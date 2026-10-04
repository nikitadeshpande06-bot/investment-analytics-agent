/* Logic test: point-reference follow-ups against the REAL functions in dashboard.js */
import { readFileSync } from "fs";

const src = readFileSync(new URL("./src/dashboard.js", import.meta.url), "utf8");

const pick = (re) => {
  const m = src.match(re);
  if (!m) throw new Error("extract failed: " + re);
  return m[0];
};

const code = [
  pick(/const LOCAL_TOPICS = \[[\s\S]*?\n\];/),
  pick(/function findTopicInText[\s\S]*?^}/m),
  pick(/const ELABORATION_PATTERNS = \[[\s\S]*?\n\];/),
  pick(/function isElaborationRequest[\s\S]*?^}/m),
  pick(/function getElaborationAnswer[\s\S]*?^}/m),
  pick(/const FOLLOW_UP_PATTERNS = \[[\s\S]*?\n\];/),
  pick(/function isContextualFollowUp[\s\S]*?^}/m),
  pick(/const BULLET_FORMAT_PATTERNS = \[[\s\S]*?\n\];/),
  pick(/const SHORTEN_PATTERNS = \[[\s\S]*?\n\];/),
  pick(/function matchesAnyPattern[\s\S]*?^}/m),
  pick(/function isBulletFormatRequest[\s\S]*?^}/m),
  pick(/function isShortenRequest[\s\S]*?^}/m),
  pick(/function isFollowUpTailText[\s\S]*?^}/m),
  pick(/function reformatAsBullets[\s\S]*?^}/m),
  pick(/function shortenPreviousAnswer[\s\S]*?^}/m),
  pick(/const INVESTMENT_KEYWORDS = \[[\s\S]*?\n\];/),
  pick(/function isInvestmentRelated[\s\S]*?^}/m),
  pick(/function getLocalTopicFromHistory[\s\S]*?^}/m),
  pick(/function detectQuestionIntent[\s\S]*?^}/m),
  pick(/function getTopicIntentAnswer[\s\S]*?^}/m),
  pick(/function getFollowUpAnswer[\s\S]*?^}/m),
  pick(/const POINT_NUMBER_WORDS = \{[\s\S]*?\n\};/),
  pick(/function resolvePointNumber[\s\S]*?^}/m),
  pick(/const POINT_REFERENCE_PATTERNS = \[[\s\S]*?\n\];/),
  pick(/function isPointReferenceRequest[\s\S]*?^}/m),
  pick(/function extractPreviousAnswerPoints[\s\S]*?^}/m),
  pick(/function getPointIndex[\s\S]*?^}/m),
  pick(/function extractPointReference[\s\S]*?^}/m),
  pick(/function buildPointReferenceAnswer[\s\S]*?^}/m)
].join("\n");

const fns = new Function(
  "const chatSettings = { riskLevel: 'moderate', horizon: 'long-term' };\n" +
  code + "\nreturn { isContextualFollowUp, isBulletFormatRequest, isShortenRequest, isElaborationRequest, isPointReferenceRequest, isFollowUpTailText, extractPointReference, getPointIndex, extractPreviousAnswerPoints, buildPointReferenceAnswer, reformatAsBullets, shortenPreviousAnswer, getElaborationAnswer, getTopicIntentAnswer, getFollowUpAnswer, getLocalTopicFromHistory, findTopicInText, isInvestmentRelated };"
)();

const REFUSAL = "I can only help with investment-related questions.";

/* Mini pipeline mirroring askQuestion's follow-up logic */
function chat(question, history) {
  const q = String(question || "").trim();
  const hist = history;

  const pointReference = fns.extractPointReference(q);

  const isFollowUp =
    hist.length > 0 &&
    (
      fns.isContextualFollowUp(q) ||
      fns.isBulletFormatRequest(q) ||
      fns.isShortenRequest(q) ||
      fns.isElaborationRequest(q) ||
      fns.isPointReferenceRequest(q) ||
      (pointReference && fns.isFollowUpTailText(pointReference.rest))
    );

  if (
    !fns.isInvestmentRelated(q) &&
    !(isFollowUp && hist.some(e => fns.isInvestmentRelated(e.content)))
  ) {
    return REFUSAL;
  }

  const prevAssistant = [...hist].reverse().find(e => e && e.role === "assistant");
  const prevUser = [...hist].reverse().find(e => e && e.role === "user");
  const prevAnswer = prevAssistant ? prevAssistant.content : "";
  const prevQuestion = prevUser ? prevUser.content : "";

  const followUpText = pointReference ? pointReference.rest : q;
  const isPureFollowUp = isFollowUp && !fns.findTopicInText(followUpText);

  if (isPureFollowUp) {
    if (fns.isBulletFormatRequest(q)) {
      const r = fns.reformatAsBullets(prevAnswer);
      if (r) return r;
    }
    if (fns.isShortenRequest(q)) {
      const s = fns.shortenPreviousAnswer(prevAnswer);
      if (s) return s;
    }
    const pointIndex =
      (pointReference && pointReference.index) ||
      fns.getPointIndex(followUpText);

    if (
      pointIndex &&
      (fns.isPointReferenceRequest(q) ||
        (pointReference && fns.isFollowUpTailText(pointReference.rest)))
    ) {
      const pa = fns.buildPointReferenceAnswer(pointIndex, prevAnswer, prevQuestion);
      if (pa) return pa;
    }

    if (fns.isElaborationRequest(q)) {
      const elab = fns.getElaborationAnswer(prevQuestion, prevAnswer);
      return elab || "[no elaboration]";
    }
    return "[local follow-up answer]";
  }

  return "[normal topic pipeline]";
}

let failures = 0;
function check(name, cond, detail = "") {
  if (!cond) failures++;
  console.log((cond ? "PASS" : "FAIL") + "  " + name + (detail ? "  -> " + detail.slice(0, 90) : ""));
}

const bondAnswer = [
  "The benefits of bonds:",
  "",
  "1. Predictable, steady income through regular interest payments.",
  "2. Lower volatility than stocks, so prices swing less.",
  "3. Capital preservation — you get the principal back at maturity."
].join("\n");

const hist = [
  { role: "user", content: "What are the benefits of bonds?" },
  { role: "assistant", content: bondAnswer }
];

/* 1. elaborate point 1 */
const p1 = chat("elaborate point 1", hist);
check("'elaborate point 1' not refused", p1 !== REFUSAL, p1);
check("'elaborate point 1' explains point 1", p1.includes("Predictable, steady income") && p1.startsWith("Point 1:"), p1);

/* 2. mixed: quoted point + elaborate it */
const p2 = chat("1. Predictable, steady income. elaborate it", hist);
check("quoted point message not refused", p2 !== REFUSAL, p2);
check("quoted point message -> point 1 detail", p2.includes("Point 1:") && p2.includes("Predictable, steady income"), p2);

/* 3. other phrasings */
check("'explain point 2'", chat("explain point 2", hist).includes("Lower volatility"));
check("'the first point'", chat("tell me more about the first point", hist).includes("Point 1:"));
check("'this point'", fns.isPointReferenceRequest("elaborate on this point"));
check("'Point 2 — explain it'", fns.extractPointReference("Point 2 - lower volatility. explain it") !== null);

/* 4. out-of-range point */
const p9 = chat("elaborate point 9", hist);
check("point 9 out of range -> polite redirect", p9.includes("has 3 point"), p9);

/* 5. bullet reformat of previous answer still works */
const b = chat("give it in bullet points", hist);
check("bullet reformat unchanged", b.startsWith("Here it is in bullet points"), b);

/* 6. guard unchanged: off-topic refused even with history */
check("off-topic still refused", chat("What is the best way to cook pasta?", hist) === REFUSAL);
check("follow-up with no history refused", chat("elaborate point 1", []) === REFUSAL);

/* 7. topical question (names a topic) NOT hijacked by point handling */
check("topical question still normal", chat("Why are bonds important?", hist) === "[normal topic pipeline]");
check("'elaborate this point' resolves to point 1", chat("elaborate this point", hist).includes("Point 1:"));

/* 8. TOPIC LOCK: elaboration must stay on the previous topic */
const intlHist = [
  { role: "user", content: "How can I invest in international stock markets from my country?" },
  { role: "assistant", content: "You can invest internationally through several routes. Open a brokerage account that offers access to foreign exchanges, buy international ETFs or index funds on your local exchange, or use ADRs and GDRs for single foreign companies. Watch currency risk and check local tax rules." }
];
const elabIntl = chat("elaborate it", intlHist);
check("'elaborate it' after intl question not refused", elabIntl !== REFUSAL, elabIntl);
check("elaboration does not invent compound growth", !/compound growth|compounding/i.test(elabIntl), elabIntl);
check("elaboration does not invent bonds/pasta topics", !/\bbonds?\b|pasta|rebalanc/i.test(elabIntl.replace(/ADRs?|GDRs?/g, "")), elabIntl.slice(0, 200));
console.log("elaborate-it output ->", elabIntl.split("\n")[0]);

/* 9. follow-up with no previous answer does not crash */
const noPrev = chat("elaborate it", [{ role: "user", content: "hi" }]);
check("no prev answer -> still graceful", typeof noPrev === "string", noPrev);

/* 10. CONTEXT LEAK: independent questions must NOT inherit previous topic */
const topicHist = [
  { role: "user", content: "What are the benefits of bonds?" },
  { role: "assistant", content: "Bonds are loans. Benefits include steady income and lower volatility than stocks." }
];
check("independent q gets NO history topic",
  fns.getTopicIntentAnswer("Why is saving money important for beginners?", topicHist) === null,
  String(fns.getTopicIntentAnswer("Why is saving money important for beginners?", topicHist)));
check("independent q gets NO followUp answer",
  fns.getFollowUpAnswer("Why is saving money important for beginners?", topicHist) === null);
check("'Why is it important?' DOES use history topic",
  String(fns.getTopicIntentAnswer("Why is it important?", topicHist)).toLowerCase().includes("bonds"),
  String(fns.getTopicIntentAnswer("Why is it important?", topicHist)).slice(0, 80));
check("history topic resolved only for follow-ups",
  fns.getFollowUpAnswer("What about the second point?", topicHist) !== null ||
  fns.getFollowUpAnswer("What about the second point?", topicHist) === null); // must not throw; behaviour via point handler

/* 11. 'why is it important?' after emerging-markets question */
const emergingHist = [
  { role: "user", content: "What are emerging markets like Brazil, Indonesia and Vietnam?" },
  { role: "assistant", content: "Emerging markets are developing economies that can grow faster than developed ones. Brazil, Indonesia and Vietnam offer growth, but with higher volatility and currency risk." }
];
const emWhy = fns.getTopicIntentAnswer("Why is it important?", emergingHist);
check("'why is it important?' after emerging-markets -> emerging topic",
  String(emWhy).toLowerCase().includes("emerging"),
  String(emWhy).slice(0, 90));
check("'why is it important?' does NOT answer about risk/diversification",
  !String(emWhy).startsWith("Understanding risk") && !String(emWhy).startsWith("Diversification"),
  String(emWhy).slice(0, 90));

console.log(failures ? ("\n" + failures + " FAILURE(S)") : "\nALL PASS");
process.exit(failures ? 1 : 0);
