import fs from "fs";
const src = fs.readFileSync("src/dashboard.js", "utf8");
const a = src.indexOf("const FOLLOW_UP_PATTERNS");
const pre = src.slice(a, src.indexOf("function isContextualFollowUp"));
const body = src.slice(
  src.indexOf("/*\n * Find the most recent investment topic"),
  src.indexOf("const INVESTMENT_KEYWORDS")
);

const fn = new Function(
  pre +
  body +
  `
const h = [
  { role: "user", content: "What is diversification?" },
  { role: "assistant", content: "Diversification means spreading your money across asset classes." }
];
for (const q of ["Why is it important?", "How does it work?", "Give me an example.", "What are its benefits?", "What is photosynthesis?"]) {
  console.log("Q:", q, "=>", String(getLocalAnswer(q, h)).slice(0, 90).replace(/\\n/g, " | "));
}
console.log("no-history generic:", getLocalAnswer("Why is it important?", []).slice(0, 60));
`
);
fn();
