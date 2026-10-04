export default async function run(page, ui) {
  const out = {};

  // empty-state test: fresh state, welcome-only chat, then click More detail
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("investai_session_v1", JSON.stringify({ email: "testuser@example.com", at: Date.now() }));
    localStorage.setItem("investai_users_v1", JSON.stringify({ "testuser@example.com": { name: "Test User", email: "testuser@example.com" } }));
    localStorage.setItem("investai_prefs_v1", JSON.stringify({ language: "en", currency: "USD" }));
  });
  await page.goto("http://localhost:5500/analytics-chatboy.html", { waitUntil: "load" });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const btn = document.querySelector('button.nav-item[data-section="chat"]');
    if (btn) btn.click();
  });
  await page.waitForTimeout(800);

  page.on("dialog", d => d.accept().catch(() => { }));
  const clearBtn = page.locator("#clearChatBtn");
  out.clearBtnCount = await clearBtn.count();
  if (out.clearBtnCount) {
    await clearBtn.click();
    await page.waitForTimeout(800);
  }
  out.msgsAfterClear = await page.locator("#chatMessages .chat-message").count();

  await page.locator("#chatMoreDetailBtn").click();
  await page.waitForTimeout(1200);
  out.toast = await page.locator("#toastMessage").innerText().catch(() => "(none)");
  out.msgsAfterEmptyClick = await page.locator("#chatMessages .chat-message").count();
  out.newAssistantMsg = out.msgsAfterEmptyClick > out.msgsAfterClear;
  const last = await page.locator("#chatMessages .chat-message").last().innerText().catch(() => "");
  out.lastMsg = last.slice(0, 120);

  await page.screenshot({ path: "qa-elab-empty.png" });
  return out;
}
