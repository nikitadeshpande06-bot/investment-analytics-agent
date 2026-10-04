export default async function run(page, ui) {
  const out = {};
  const auth = page.locator('#authLanding');
  await auth.waitFor({ state: 'attached', timeout: 5000 }).catch(() => { });
  out.gatePresent = await page.locator('#authLanding').count();

  // Sign up (if gate is present)
  if (out.gatePresent) {
    const signup = await page.locator('#heroSignupBtn');
    if (await signup.count()) {
      await signup.click();
      await page.fill('#signupName', 'QA Tester');
      await page.fill('#signupEmail', 'qa@example.com');
      await page.fill('#signupPassword', 'secret123');
      await page.click('#signupForm .auth-submit');
      await page.waitForSelector('.app-container', { state: 'visible', timeout: 5000 });
    }
  }
  out.appVisible = await page.locator('.app-container').isVisible().catch(() => false);

  // Dashboard
  out.statBudget = await page.textContent('#statBudget');

  // Portfolio
  await page.click('.nav-item[data-section="portfolio"]');
  await page.fill('#budget', '10000');
  await page.selectOption('#portfolioRisk', 'moderate');
  await page.fill('#timeHorizon', '10');
  await page.fill('#investmentGoal', 'Long-term wealth');
  await page.click('#portfolioForm button.primary-btn');
  await page.waitForTimeout(300);
  out.portfolioStatus = await page.textContent('#portfolioStatus');

  // Risk
  await page.click('.nav-item[data-section="risk"]');
  await page.fill('#portfolioDescription', '60% US equities, 30% bonds, 10% cash');
  await page.selectOption('#investorRisk', 'moderate');
  await page.fill('#riskTimeHorizon', '10');
  await page.click('#riskForm button.primary-btn');
  await page.waitForTimeout(300);
  out.riskStatus = await page.textContent('#riskStatus');

  // Screener
  await page.click('.nav-item[data-section="screener"]');
  await page.check('input[name="assetClass"][value="US equities"]');
  await page.check('input[name="assetClass"][value="ETFs"]');
  await page.click('#screenerForm button.primary-btn');
  await page.waitForTimeout(300);
  out.screenerStatus = await page.textContent('#screenerStatus');

  // Prediction
  await page.click('.nav-item[data-section="prediction"]');
  await page.fill('#predictionInitial', '10000');
  await page.fill('#predictionContribution', '1000');
  await page.fill('#predictionYears', '10');
  await page.click('#predictionForm button.primary-btn');
  await page.waitForTimeout(300);
  out.predictionStatus = await page.textContent('#predictionStatus');
  out.predictionRows = await page.locator('#predictionTableBody tr').count();

  // Chat
  await page.click('.nav-item[data-section="chat"]');
  await page.fill('#chatInput', 'What is an ETF?');
  await page.click('#chatForm .chat-send-btn');
  await page.waitForTimeout(300);
  out.chatBubbles = await page.locator('#chatMessages .chat-message').count();

  // Watchlist
  await page.click('.nav-item[data-section="watchlist"]');
  await page.fill('#watchlistSymbol', 'AAPL');
  await page.selectOption('#watchlistCountry', 'US');
  await page.fill('#watchlistPrice', '210');
  await page.click('#watchlistForm button.primary-btn');
  await page.waitForTimeout(300);
  out.watchlistRows = await page.locator('#watchlistTableBody tr').count();

  // Reports
  await page.click('.nav-item[data-section="reports"]');
  await page.waitForTimeout(200);
  out.reportPreview = (await page.textContent('#reportPreview')).slice(0, 150);

  return out;
}
