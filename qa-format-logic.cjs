/* Quick logic test for the added bullet/short format follow-ups.
   Extracts the new functions + guard behavior from dashboard.js source. */
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
  extract(/const BULLET_FORMAT_PATTERNS/, "const DETAILED_SUFFIX"),
  extract(/const INVESTMENT_KEYWORDS/, "function isInvestmentRelated"),
  extract(/function isInvestmentRelated/, "/*\n * True when the message"),
].join("\n");

const mod = new Function(code + "\nreturn { isBulletFormatRequest, isShortenRequest, reformatAsBullets, shortenPreviousAnswer, isInvestmentRelated };")();
const { isBulletFormatRequest, isShortenRequest, reformatAsBullets, shortenPreviousAnswer, isInvestmentRelated } = mod;

const prev = "Diversification means spreading investments across different asset classes, sectors and regions. It reduces dependence on any single investment. It can help manage portfolio risk over time.";

const cases = [
  ["bullet 'give the answer in bullet form'", isBulletFormatRequest("Give the answer in bullet form"), true],
  ["bullet 'in bullet points'", isBulletFormatRequest("give the answer in bullet points"), true],
  ["bullet 'answer in points'", isBulletFormatRequest("Answer in points please"), true],
  ["bullet non-request", isBulletFormatRequest("What is diversification?"), false],
  ["short 'in short'", isShortenRequest("In short"), true],
  ["short 'briefly'", isShortenRequest("explain briefly"), true],
  ["short non-request", isShortenRequest("What are bonds?"), false],
];

const guard = (q, pureFormat) => {
  const followUp = pureFormat && (isBulletFormatRequest(q) || isShortenRequest(q));
  if (!isInvestmentRelated(q) && !followUp) return "REFUSED";
  return "PASS";
};

const guardCases = [
  ["format q passes w/ history", guard("Give the answer in bullet form", true), "PASS"],
  ["weather still refused", guard("What's the weather like today?", false), "REFUSED"],
  ["topical short q answered normally", isInvestmentRelated("In short, what is diversification?"), true],
];

const reformatted = reformatAsBullets(prev);
const short = shortenPreviousAnswer(prev);

const reformatCases = [
  ["prose -> bullets (header + 3 bullets = 5 lines)", reformatted.split("\n").length === 5 && reformatted.startsWith("Here it is in bullet points:")],
  ["bullets contain original sentences verbatim", reformatted.includes("Diversification means spreading investments across different asset classes, sectors and regions.")],
  ["already bulleted kept as-is", /Here it is in bullet points:/.test(reformatAsBullets("- a\n- b\n- c")) && /- a\n- b\n- c/.test(reformatAsBullets("- a\n- b\n- c"))],
  ["shorten prose keeps first sentences", short.startsWith("In short: Diversification means spreading")],
  ["empty -> null", reformatAsBullets("") === null && shortenPreviousAnswer("") === null],
];

let fail = 0;
const check = (name, actual, expected) => {
  const ok = actual === expected;
  if (!ok) fail++;
  console.log((ok ? "PASS" : "FAIL") + " | " + name + " | got: " + actual);
};
cases.forEach(([n, a, e]) => check(n, a, e));
guardCases.forEach(([n, a, e]) => check(n, a, e));
reformatCases.forEach(([n, a]) => check(n, a, true));

console.log(fail === 0 ? "ALL LOGIC TESTS PASSED" : fail + " FAILURES");
process.exit(fail === 0 ? 0 : 1);
