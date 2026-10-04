export default async function run(page, ui) {
  const out = {};
  // 1. Landing visible
  out.landing = await page.locator('#authGate, .auth-gate, [id*="auth"]').count();

  // Switch to Get Started (signup view)
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.waitForTimeout(300);
  out.afterGetStarted = (await page.locator('body').innerText()).slice(0, 400);

  // Screenshot signup view desktop
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: 'qa-signup-desktop.png' });
  return out;
}
