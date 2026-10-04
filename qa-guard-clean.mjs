export default async function run(page, ui) {
  const out = {};
  const refusalStart = "I'm the InvestAI Analytics assistant";

  // wipe app state + reseed a session for a CLEAN conversation
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("investai_session_v1", JSON.stringify({ email: "testuser@example.com", at: Date.now() }));
    localStorage.setItem("investai_users_v1", JSON.stringify({ "testuser@example.com": { name: "Test User", email: "testuser@example.com" } }));
    localStorage.setItem("investai_prefs_v1", JSON.stringify({ language: "en", currency: "USD" }));
  });
  await page.goto("http://localhost:5500/analytics-chatboy.html", { waitUntil: "load" });
  await page.waitForTimeout(2000);

  await page.evaluate(() => {
    const btn = document.querySelector('button.nav-item[data-section="chat"]');
    if (btn) btn.click();
  });
  await page.waitForTimeout(800);

  const input = page.locator("#chatInput");
  out.chatReady = await input.isVisible().catch(() => false);

  async function ask(q) {
    const before = await page.locator("#chatMessages .chat-message").count();
    await input.fill(q);
    await input.press("Enter");
    await page.waitForFunction(
      (n) => document.querySelectorAll("#chatMessages .chat-message").length >= n + 2,
      before, { timeout: 20000 }
    ).catch(() => { });
    await page.waitForTimeout(1500);
    const msgs = page.locator("#chatMessages .chat-message.assistant");
    const last = msgs.last();
    const txt = (await last.count()) ? await last.innerText().catch(() => "(err)") : "(none)";
    return String(txt).slice(0, 300);
  }

  // 1. NON-investment FIRST on a clean conversation -> expect refusal
  const pasta = await ask("What is the best way to cook pasta?");
  out.cleanPasta = { answer: pasta, refused: pasta.startsWith(refusalStart) };

  // 2. Investment question right after refusal -> should be answered
  const div = await ask("What is diversification in investing?");
  out.afterRefusalInvestment = { answer: div.slice(0, 120), refused: div.startsWith(refusalStart) };

  // 3. Follow-up "tell me more" after investment topic -> should NOT be refused
  const more = await ask("Tell me more about it");
  out.followUp = { answer: more.slice(0, 120), refused: more.startsWith(refusalStart) };

  // 4. Non-investment again -> refused? (history has investment keywords -> likely passes)
  const weather = await ask("What's the weather like today?");
  out.weatherAfterInvestment = { answer: weather.slice(0, 120), refused: weather.startsWith(refusalStart) };

  await page.screenshot({ path: "qa-guard-clean.png" });
  return out;
}
