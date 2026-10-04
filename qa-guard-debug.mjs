export default async function run(page, ui) {
  const out = {};
  out.gate = await page.evaluate(() => !!document.getElementById("authGate"));
  out.bodyClass = await page.evaluate(() => document.body.className);
  out.session = await page.evaluate(() => localStorage.getItem("investai_session_v1"));
  const input = page.locator("#chatInput");
  out.inputVisible = await input.isVisible().catch(e => String(e));
  out.inputBox = await input.boundingBox().catch(() => null);
  // what covers the viewport?
  out.cover = await page.evaluate(() => {
    const el = document.elementFromPoint(innerWidth/2, innerHeight*0.75);
    return el ? (el.id || el.className || el.tagName) : "none";
  });
  out.chatSectionVisible = await page.evaluate(() => {
    const c = document.getElementById("chatInput");
    if (!c) return "none";
    const r = c.getBoundingClientRect();
    return { top: r.top, h: r.height, winH: innerHeight };
  });
  out.snapshot = String(await ui.snapshot()).slice(0, 1500);
  return out;
}
