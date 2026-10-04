// Mirror of the guard logic in src/dashboard.js for quick logic checks
const src = await import("node:fs").then(fs =>
  fs.readFileSync(new URL("./src/dashboard.js", import.meta.url), "utf8")
);

// Extract the keyword list + both functions and eval them
const kwMatch = src.match(/const INVESTMENT_KEYWORDS = \[[\s\S]*?\];/);
const fnMatch = src.match(/function isInvestmentRelated[\s\S]*?^}/m);
const followMatch = src.match(/const FOLLOW_UP_PATTERNS = \[[\s\S]*?\];\n\nfunction isContextualFollowUp[\s\S]*?^}/m);
if (!kwMatch || !fnMatch || !followMatch) throw new Error("extract failed");

const mod = new Function(
  kwMatch[0] + "\n" + fnMatch[0] + "\n" + followMatch[0] +
  "\nreturn { isInvestmentRelated, isContextualFollowUp };"
)();
const { isInvestmentRelated, isContextualFollowUp } = mod;

function guard(question, history = []) {
  const follow = isContextualFollowUp(question);
  if (
    !isInvestmentRelated(question) &&
    !(follow && history.some(h => isInvestmentRelated(h)))
  ) return "REFUSED";
  return "PASS";
}

const invHist = ["assistant: Diversification spreads risk across asset classes.", "user: What is diversification?"];
const empty = [];

const cases = [
  ["clean pasta refused", guard("What is the best way to cook pasta?", empty), "REFUSED"],
  ["clean weather refused", guard("What's the weather like today?", empty), "REFUSED"],
  ["clean football refused", guard("Who won the football world cup in 2022?", empty), "REFUSED"],
  ["pasta STILL refused w/ inv history", guard("What is the best way to cook pasta?", invHist), "REFUSED"],
  ["weather STILL refused w/ history", guard("What's the weather like today?", invHist), "REFUSED"],
  ["diversification passes", guard("What is diversification and why does it reduce risk?", empty), "PASS"],
  ["follow-up after inv passes", guard("Why is it important?", invHist), "PASS"],
  ["tell me more after inv passes", guard("Tell me more about it", invHist), "PASS"],
  ["follow-up w/o inv history refused", guard("Why is it important?", empty), "REFUSED"],
  ["what about bonds passes", guard("What about bonds?", invHist), "PASS"],
  ["explain more passes", guard("Please explain that in more detail", invHist), "PASS"],
];

let fail = 0;
for (const [name, got, want] of cases) {
  const ok = got === want;
  if (!ok) fail++;
  console.log((ok ? "PASS" : "FAIL") + "  " + name + "  (got " + got + ")");
}
console.log(fail === 0 ? "\nALL LOGIC CHECKS PASSED" : "\n" + fail + " FAILURES");
process.exit(fail === 0 ? 0 : 1);
