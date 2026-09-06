export default async function run(page, ui) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 999999));
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'shot-landing-bottom.png' });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => document.getElementById('landingSignupBtn').click());
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'shot-signup-mobile.png' });
  return 'ok';
}
