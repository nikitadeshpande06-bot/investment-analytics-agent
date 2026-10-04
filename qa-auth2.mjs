export default async function run(page, ui) {
  const out = {};
  // Desktop signup screenshot
  await page.getByRole('button', { name: 'Get Started' }).click().catch(() => { });
  await page.waitForTimeout(300);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: 'qa-signup-desktop.png' });

  // Fill signup form with test data
  const inputs = page.locator('input');
  out.inputCount = await inputs.count();
  const texts = [];
  for (let i = 0; i < await inputs.count(); i++) {
    texts.push(await inputs.nth(i).getAttribute('placeholder') || await inputs.nth(i).getAttribute('type'));
  }
  out.inputs = texts;
  await inputs.nth(0).fill('Test User');
  await inputs.nth(1).fill('testuser@example.com');
  await inputs.nth(2).fill('TestPass123!');
  await page.screenshot({ path: 'qa-signup-filled.png' });

  // Submit
  const submit = page.getByRole('button', { name: /sign up|create/i }).first();
  out.submitFound = await submit.count();
  await submit.click();
  await page.waitForTimeout(800);
  out.afterSubmit = (await page.locator('body').innerText()).slice(0, 500);
  await page.screenshot({ path: 'qa-after-submit.png' });
  return out;
}
