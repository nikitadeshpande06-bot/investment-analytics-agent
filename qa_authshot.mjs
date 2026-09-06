export default async function run(page, ui) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: 'shot-landing.png' });
  await page.evaluate(() => document.getElementById('landingSignupBtn').click());
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'shot-signup.png' });
  return 'ok';
}
