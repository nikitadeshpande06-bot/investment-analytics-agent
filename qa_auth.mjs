export default async function run(page, ui) {
  const results = {};

  results.landingVisible = await page.evaluate(() =>
    !!document.querySelector('#authGate .landing-hero'));
  results.appHiddenBefore = await page.evaluate(() =>
    getComputedStyle(document.querySelector('.app-container')).display === 'none');

  await page.evaluate(() => document.getElementById('heroSignupBtn').click());
  await page.waitForTimeout(200);
  results.signupFormShown = await page.evaluate(() =>
    !document.getElementById('signupForm').hidden);

  await page.evaluate(() => {
    document.getElementById('signupName').value = 'Test User';
    document.getElementById('signupEmail').value = 'test@example.com';
    document.getElementById('signupPassword').value = 'secret123';
    document.getElementById('signupForm')
      .dispatchEvent(new Event('submit', { cancelable: true }));
  });
  await page.waitForTimeout(300);

  results.gateRemovedAfterSignup = await page.evaluate(() =>
    !document.getElementById('authGate'));
  results.appVisibleAfterSignup = await page.evaluate(() =>
    getComputedStyle(document.querySelector('.app-container')).display !== 'none');
  results.userLabel = await page.evaluate(() =>
    document.getElementById('authUserLabel')?.textContent);

  await page.reload();
  await page.waitForTimeout(500);
  results.stillAuthedAfterReload = await page.evaluate(() =>
    document.body.classList.contains('is-authed') && !document.getElementById('authGate'));

  await page.evaluate(() => document.getElementById('logoutBtn').click());
  await page.waitForTimeout(300);
  results.landingAfterLogout = await page.evaluate(() =>
    !!document.querySelector('#authGate .landing-hero') &&
    getComputedStyle(document.querySelector('.app-container')).display === 'none');

  await page.evaluate(() => document.getElementById('landingSigninBtn').click());
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    document.getElementById('loginEmail').value = 'test@example.com';
    document.getElementById('loginPassword').value = 'secret123';
    document.getElementById('loginForm')
      .dispatchEvent(new Event('submit', { cancelable: true }));
  });
  await page.waitForTimeout(300);
  results.appAfterLogin = await page.evaluate(() =>
    document.body.classList.contains('is-authed') && !document.getElementById('authGate'));

  await page.evaluate(() => document.getElementById('logoutBtn').click());
  await page.waitForTimeout(200);
  await page.evaluate(() => document.getElementById('landingSigninBtn').click());
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    document.getElementById('loginEmail').value = 'test@example.com';
    document.getElementById('loginPassword').value = 'wrongpass';
    document.getElementById('loginForm')
      .dispatchEvent(new Event('submit', { cancelable: true }));
  });
  await page.waitForTimeout(200);
  results.wrongPasswordError = await page.evaluate(() =>
    !document.getElementById('loginError').hidden &&
    document.getElementById('loginError').textContent.length > 0);

  return results;
}
