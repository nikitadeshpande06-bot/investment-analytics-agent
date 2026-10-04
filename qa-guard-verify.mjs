export default async function run(page, ui) {
  const out = {};
  const refusalStart = "I'm the InvestAI Analytics assistant";

  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("investai_session_v1", JSON.stringify({ email: "testuser@example.com", at: Date.now() }));
    localStorage.setItem("investai_users_v1", JSON.stringify({ "testuser@example.com": { name: "Test User", email: "testuser@example.com" } }));
    localStorage.setItem("investai_prefs_v1", JSON.stringify({ language: "en", currency: "USD" }));
  });
  await page.goto("http://localhost:5500/investment-analyst-mcp/analytics-chatboy.html", { waitUntil: "load" });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const btn = document.querySelector('button.nav-item[data-section="chat"]');
    if (btn) btn.click();
  });
  await page.waitForTimeout(800);

  const input = page.locator("#chatInput");

  async function ask(q) {
    await input.fill(q);
    await input.press("Enter");
    await page.waitForFunction(
      () => !document.getElementById("typingIndicator"),
      { timeout: 60000 }
    ).catch(() => { });
    await page.waitForTimeout(600);
    const last = page.locator("#chatMessages .chat-message.assistant:not(#typingIndicator)").last();
    const txt = (await last.count()) ? await last.innerText().catch(() => "(err)") : "(none)";
    return String(txt);
  }

  const steps = [];
  async function step(name, q, expectRefusal) {
    const a = await ask(q);
    const refused = a.startsWith(refusalStart);
    steps.push({ name, q, refused, expectRefusal, ok: refused === expectRefusal, answer: a.slice(0, 110) });
  }

  await step("1. investment question", "What is diversification in investing?", false);
  await step("2. follow-up 'why is it important?'", "Why is it important?", false);
  await step("3. off-topic pasta (history has investment words)", "What is the best way to cook pasta?", true);
  await step("4. off-topic weather again", "What's the weather like today?", true);
  await step("5. investment question still works after refusals", "Should I invest in index funds?", false);
  await step("6. follow-up again", "Tell me more about it", false);

  out.steps = steps;
  out.allPassed = steps.every(s => s.ok);
  out.chatStillActive = await input.isEnabled();

  // persisted history intact after refusals
  out.historyIntact = await page.evaluate(() => {
    const raw = localStorage.getItem("investment_dashboard_local_v5");
    const chat = raw ? (JSON.parse(raw).chat || []) : [];
    return { total: chat.length, roles: chat.map(m => m.role) };
  });

  await page.screenshot({ path: "qa-guard-fixed.png" });
  return out;
}
