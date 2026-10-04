export default async function run(page, ui) {
  const out = {};

  await page.evaluate(() => {
    localStorage.setItem("investai_session_v1", JSON.stringify({ email: "testuser@example.com", at: Date.now() }));
    localStorage.setItem("investai_prefs_v1", JSON.stringify({ language: "en", currency: "USD" }));
    localStorage.setItem("investai_users_v1", JSON.stringify({ "testuser@example.com": { name: "Test User", email: "testuser@example.com" } }));
  });
  await page.goto("http://localhost:5500/analytics-chatboy.html", { waitUntil: "load" });
  await page.waitForTimeout(2000);

  out.bodyClass = await page.evaluate(() => document.body.className);
  out.gate = await page.evaluate(() => !!document.getElementById("authGate"));

  if (out.gate) {
    // Fall back: sign up through the UI
    await page.getByRole("button", { name: /get started/i }).first().click().catch(() => {});
    await page.waitForTimeout(500);
    const inputs = page.locator("#signupForm input:visible");
    const n = await inputs.count();
    out.signupInputs = n;
    if (n >= 3) {
      await inputs.nth(0).fill("Test User");
      await inputs.nth(1).fill("testuser@example.com");
      await inputs.nth(2).fill("TestPass123!");
      await page.locator("#signupForm button[type=submit], #signupForm .auth-submit").first().click();
      await page.waitForTimeout(1500);
    }
    out.gateAfter = await page.evaluate(() => !!document.getElementById("authGate"));
  }

  const input = page.locator("#chatInput");
  out.inputCount = await input.count();

  async function ask(q) {
    await input.fill(q);
    await input.press("Enter");
    await page.waitForTimeout(3000);
    const bubbles = page.locator(".chat-message, .chat-bubble, .message, [class*=message]");
    const cnt = await bubbles.count();
    const last = bubbles.nth(cnt - 1);
    const txt = cnt ? (await last.innerText().catch(() => "(err)")).slice(0, 300) : "(none)";
    return txt;
  }

  const refusalStart = "I'm the InvestAI Analytics assistant";
  const results = {};
  const cases = [
    ["investment", "What is diversification and why does it reduce risk in a portfolio?"],
    ["nonInvestment", "What is the best way to cook pasta?"],
    ["followUp", "Tell me more about it"],
    ["football", "Who won the football world cup in 2022?"],
    ["stocks", "Should I buy index funds for long term retirement investing?"],
    ["weather", "What's the weather like today?"],
  ];
  for (const [key, q] of cases) {
    const a = await ask(q);
    results[key] = { q, answer: a, refused: a.startsWith(refusalStart) };
  }
  out.results = results;

  await page.screenshot({ path: "qa-guard-chat.png" });
  return out;
}

/* ==== REPLACEMENT MARKER - see next edit ==== */
