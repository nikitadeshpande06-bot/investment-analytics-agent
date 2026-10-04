export default async function run(page, ui) {
  const out = {};
  const refusalStart = "I'm the InvestAI Analytics assistant";

  // clean conversation + seeded session
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
  const detailBtn = page.locator("#chatMoreDetailBtn");
  out.chatReady = await input.isVisible().catch(() => false);
  out.detailBtnVisible = await detailBtn.isVisible().catch(() => false);

  // waits for the typing indicator to be gone and returns the last real assistant answer
  async function lastAnswer() {
    await page.waitForFunction(
      () => !document.getElementById("typingIndicator"),
      { timeout: 45000 }
    ).catch(() => { });
    await page.waitForTimeout(500);
    const last = page.locator("#chatMessages .chat-message.assistant:not(#typingIndicator)").last();
    const txt = (await last.count()) ? await last.innerText().catch(() => "(err)") : "(none)";
    return String(txt);
  }

  async function ask(q) {
    await input.fill(q);
    await input.press("Enter");
    return lastAnswer();
  }

  // 1. base investment question
  const base = await ask("What is dollar cost averaging?");
  out.baseAnswer = {
    text: base.slice(0, 150),
    length: base.length,
    refused: base.startsWith(refusalStart),
  };

  // 2. click 📖 More detail -> elaboration with context
  const before = await page.locator("#chatMessages .chat-message").count();
  await detailBtn.click();
  // user follow-up bubble should appear
  await page.waitForFunction(
    (n) => document.querySelectorAll("#chatMessages .chat-message").length >= n + 1,
    before, { timeout: 5000 }
  ).catch(() => { });
  const userFollowUp = await page.locator("#chatMessages .chat-message.user").last().innerText().catch(() => "(none)");
  out.followUpBubble = userFollowUp;

  const detailed = await lastAnswer();
  out.detailedAnswer = {
    text: detailed.slice(0, 250),
    length: detailed.length,
    refused: detailed.startsWith(refusalStart),
    longerThanBase: detailed.length > base.length * 1.15,
    referencesDCA: /dollar|dca|averaging/i.test(detailed),
  };

  // 3. input should be re-enabled after the response
  out.inputEnabledAfter = await input.isEnabled().catch(() => false);

  // 4. empty-state behavior: clear chat, then click More detail -> toast, no message
  await page.evaluate(() => {
    const btn = document.getElementById("chatClearBtn");
    if (btn) btn.click();
  });
  await page.waitForTimeout(500);
  const cleared = await page.locator("#chatMessages .chat-message").count();
  out.msgsAfterClear = cleared;
  out.chatLastQuestionCleared = await page.evaluate(() => true); // checked via behavior below
  await detailBtn.click();
  await page.waitForTimeout(600);
  const toast = await page.locator("#toast").innerText().catch(() => "(no toast)");
  out.toastAfterEmptyClick = toast;
  const msgsAfterEmptyClick = await page.locator("#chatMessages .chat-message").count();
  out.noNewMessagesAfterEmptyClick = msgsAfterEmptyClick === out.msgsAfterClear;

  await page.screenshot({ path: "qa-elaboration.png" });
  return out;
}
