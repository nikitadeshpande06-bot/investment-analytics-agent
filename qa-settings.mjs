import fs from "fs";
const src = fs.readFileSync("src/dashboard.js", "utf8");

const s1 = src.slice(
  src.indexOf("const SETTINGS_KEY"),
  src.indexOf("const CURRENCY_LOCALES")
);
const s2 = src.slice(
  src.indexOf("function getLocalAnswer"),
  src.indexOf("/* ============================================================\n   CHAT MESSAGE RENDERING")
);

let captured = null;
global.fetch = async (url, opts) => {
  captured = JSON.parse(opts.body);
  globalThis._cap = captured;
  return { ok: true, json: async () => ({ answer: "SERVER:" + captured.message.slice(0, 60) }) };
};

const fn = new Function(
  "localStorage",
  `
const $ = () => null;
let state = { chat: [] };
const API_URL = "http://localhost:0";
function getFollowUpAnswer() { return ""; }
` + s1 + "\n" + s2 + "\n" + `
async function run() {
  // 1. Default: investment-only ON -> refusal for off-topic
  const r1 = await askQuestion("What is photosynthesis?");
  console.log("1 investment-only default refusal:", r1.startsWith("I'm the InvestAI Analytics assistant"));

  // 2. Investment-only OFF -> allowed
  chatSettings.investmentOnly = false;
  const r2 = await askQuestion("What is photosynthesis?");
  console.log("2 investment-only off allowed:", !r2.startsWith("I'm the InvestAI Analytics assistant"));
  chatSettings.investmentOnly = true;

  // 3. Follow-up context ON vs OFF
  state.chat = [
    { role: "user", content: "What is diversification?" },
    { role: "assistant", content: "Diversification means spreading your money across asset classes." }
  ];
  await askQuestion("Why is it important?");
  console.log("3a follow-up ON uses history:", _cap.history.length === 2 && _cap.message.includes("Recent conversation"));
  chatSettings.followUpContext = false;
  const refused = await askQuestion("Why is it important?");
  const stale = _cap.history.length === 2;
  await askQuestion("Give an example of an ETF allocation");
  console.log("3b follow-up OFF ignores history:",
    stale && refused.startsWith("I'm the InvestAI") &&
    _cap.history.length === 0 && !_cap.message.includes("Recent conversation"));
  chatSettings.followUpContext = true;
  state.chat = [];

  // 4. Detail levels reflected in server message
  chatSettings.responseDetail = "short";
  await askQuestion("What is an ETF?");
  console.log("4a short suffix:", _cap.message.includes("keep the answer brief"));
  chatSettings.responseDetail = "detailed";
  await askQuestion("What is an ETF?");
  console.log("4b detailed suffix:", _cap.message.includes("in-depth explanation"));
  chatSettings.responseDetail = "medium";
  await askQuestion("What is an ETF?");
  console.log("4c medium neither:", !_cap.message.includes("keep the answer brief") && !_cap.message.includes("in-depth explanation"));

  // 5. Preferences included
  chatSettings.riskLevel = "aggressive";
  chatSettings.horizon = "short-term";
  await askQuestion("What is an ETF?");
  console.log("5 preferences in message:", _cap.message.includes("aggressive") && _cap.message.includes("short-term"));

  // 6. Reset restores defaults
  chatSettings = { investmentOnly: false, responseDetail: "detailed" };
  resetChatSettings();
  console.log("6 reset defaults:", JSON.stringify(chatSettings) === JSON.stringify(defaultSettings));
}
run();
`
);
fn({
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
});

