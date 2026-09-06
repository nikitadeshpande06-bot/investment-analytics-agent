export default async function run(page, ui) {
  const results = {};

  // --- Landing scrollability ---
  results.bodyScrollable = await page.evaluate(() =>
    getComputedStyle(document.body).overflowY === 'auto' ||
    getComputedStyle(document.documentElement).overflowY === 'auto');
  await page.evaluate(() => window.scrollTo(0, 999999));
  await page.waitForTimeout(200);
  results.scrolledToBottom = await page.evaluate(() =>
    window.scrollY > 200);
  results.footerReachable = await page.evaluate(() => {
    const f = document.querySelector('.landing-footer');
    const r = f.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  });

  // --- Signup view reachable & back-to-home works ---
  await page.evaluate(() => { window.scrollTo(0, 0); document.getElementById('heroSignupBtn').click(); });
  await page.waitForTimeout(200);
  results.signupShown = await page.evaluate(() => !document.getElementById('authView').hidden);
  results.topbarPresent = await page.evaluate(() => !!document.querySelector('.auth-topbar'));
  await page.evaluate(() => document.getElementById('authHomeBtn').click());
  await page.waitForTimeout(200);
  results.backHomeWorks = await page.evaluate(() =>
    document.getElementById('authView').hidden &&
    !!document.getElementById('authGate'));

  // Close button too
  await page.evaluate(() => document.getElementById('landingSigninBtn').click());
  await page.waitForTimeout(200);
  await page.evaluate(() => document.getElementById('authCloseBtn').click());
  await page.waitForTimeout(200);
  results.closeWorks = await page.evaluate(() => document.getElementById('authView').hidden);

  // --- After login: dashboard still scrolls internally, body locked ---
  await page.evaluate(() => {
    document.getElementById('signupName').value = 'T';
    document.getElementById('signupEmail').value = 't@t.com';
    document.getElementById('signupPassword').value = 'secret123';
    document.getElementById('signupForm').dispatchEvent(new Event('submit', { cancelable: true }));
  });
  await page.waitForTimeout(300);
  results.authedBodyLocked = await page.evaluate(() =>
    document.body.classList.contains('is-authed') &&
    getComputedStyle(document.body).overflowY === 'hidden');
  results.mainContentScrolls = await page.evaluate(() => {
    const mc = document.querySelector('.main-content');
    return mc.scrollHeight > mc.clientHeight &&
      getComputedStyle(mc).overflowY === 'auto';
  });

  // mobile viewport check
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.getElementById('logoutBtn').click());
  await page.waitForTimeout(300);
  results.mobileBodyScrollable = await page.evaluate(() =>
    getComputedStyle(document.body).overflowY === 'auto');
  results.mobileNoHorizScroll = await page.evaluate(() =>
    document.documentElement.scrollWidth <= window.innerWidth + 1);

  return results;
}
