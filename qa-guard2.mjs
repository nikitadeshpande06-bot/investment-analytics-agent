export default async function run(page, ui) {
  const out = {};
  const refusalStart = "I'm the InvestAI Analytics assistant";

  await page.evaluate(() => {
    localStorage.setItem("investai_session_v1", JSON.stringify({ email: "testuser@example.com", at: Date.now() }));
    localStorage.setItem("investai_users_v1", JSON.stringify({ "testuser@example.com": { name: "Test User", email: "testuser@example.com" } }));
    localStorage.setItem("investai_prefs_v1", JSON.stringify({ language: "en", currency: "USD" }));
  });
  await page.goto("http://localhost:5500/analytics-chatboy.html", { waitUntil: "load" });
  await page.waitForTimeout(2000);

  out.gateAfterSeed = await page.evaluate(() => !!document.getElementById("authGate"));

  if (out.gateAfterSeed) {
    try {
      await page.locator("button:has-text('Get Started')").first().click({ timeout: 5000 });
      await page.waitForTimeout(600);
      const inputs = page.locator("#signupForm input");
      out.signupInputs = await inputs.count();
      await inputs.nth(0).fill("Test User");
      await inputs.nth(1).fill("testuser@example.com");
      await inputs.nth(2).fill("TestPass123!");
      await page.locator("#signupForm button[type=submit]").click();
      await page.waitForTimeout(1500);
    } catch (e) {
      out.signupError = String(e).slice(0, 200);
    }
    out.gateAfterSignup = await page.evaluate(() => !!document.getElementById("authGate"));
  }

  const input = page.locator("#chatInput");
  out.chatReady = await input.isVisible().catch(() => false);
  if (!out.chatReady) {
    await page.screenshot({ path: "qa-guard-blocked.png" });
    return out;
  }

  async function ask(q) {
    await input.fill(q);
    await input.press("Enter");
    await page.waitForTimeout(3000);
    const last = page.locator("#chatMessages .chat-message").last();
    const txt = (await last.count()) ? await last.innerText().catch(() => "(err)") : "(none)";
    return String(txt).slice(0, 350);
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
