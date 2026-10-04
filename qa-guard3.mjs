export default async function run(page, ui) {
  const out = {};
  const refusalStart = "I'm the InvestAI Analytics assistant";

  // open the Analytics Chat section (sidebar may be collapsed -> JS click)
  await page.evaluate(() => {
    const btn = document.querySelector('button.nav-item[data-section="chat"]') ||
      Array.from(document.querySelectorAll("button")).find(b => /Ask Analytics/i.test(b.textContent));
    if (btn) btn.click();
  });
  await page.waitForTimeout(800);

  const input = page.locator("#chatInput");
  out.chatReady = await input.isVisible().catch(() => false);
  out.gate = await page.evaluate(() => !!document.getElementById("authGate"));
  if (!out.chatReady) {
    await page.screenshot({ path: "qa-guard-blocked.png" });
    return out;
  }

  async function ask(q) {
    const before = await page.locator("#chatMessages .chat-message").count();
    await input.fill(q);
    await input.press("Enter");
    // wait until 2 new messages (user + assistant) have appeared
    await page.waitForFunction(
      (n) => document.querySelectorAll("#chatMessages .chat-message").length >= n + 2,
      before,
      { timeout: 20000 }
    ).catch(() => { });
    await page.waitForTimeout(1500);
    const last = page.locator("#chatMessages .chat-message").last();
    const txt = (await last.count()) ? await last.innerText().catch(() => "(err)") : "(none)";
    return String(txt).slice(0, 400);
  }

  const cases = [
    ["investment", "What is diversification and why does it reduce risk in a portfolio?", false],
    ["nonInvestment", "What is the best way to cook pasta?", true],
    ["followUp", "Tell me more about it", null],
    ["football", "Who won the football world cup in 2022?", true],
    ["stocks", "Should I buy index funds for long term retirement investing?", false],
    ["weather", "What's the weather like today?", true],
  ];
  out.results = {};
  for (const [key, q, expectRefusal] of cases) {
    const a = await ask(q);
    const refused = a.startsWith(refusalStart);
    out.results[key] = { q, answer: a, refused, expectRefusal, pass: expectRefusal === null ? null : refused === expectRefusal };
  }

  await page.screenshot({ path: "qa-guard-chat.png" });
  return out;
}
