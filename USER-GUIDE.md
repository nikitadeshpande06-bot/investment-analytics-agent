# 📖 InvestAI User Guide

A step-by-step guide to using the InvestAI investment analytics dashboard.

> ⚠️ Educational purposes only — not financial advice.

**Open the app:** https://investai-backend-production-8cbd.up.railway.app

---

## 1. Sign up

1. Open the app — you'll land on the auth gate with a **Get Started / Sign up** option.
2. Click **Get Started** to open the signup form.
3. Fill in:
   - **Name**
   - **Email**
   - **Password**
   - **Language** (preference)
   - **Currency** (see §3)
4. Submit — you'll be taken straight into the dashboard.

Your session is kept in the browser, so a page refresh keeps you logged in.

## 2. Log in / Log out

- **Log in:** from the landing view, choose **Sign in**, enter your email and
  password, and submit. The login form also lets you pick a language/currency
  — useful if you want to switch.
- **Log out:** click the **Logout** button in the dashboard. You return to the
  auth gate. Your preferences are remembered for the next login.

## 3. Selecting language and currency

- On signup (or login) choose your **currency** from the dropdown:
  **USD, INR, EUR, GBP, JPY, CAD, AUD, SGD, AED, CHF**.
- All monetary values in the dashboard are formatted with your currency's
  symbol and local separators, e.g. `$1,234.50`, `₹1,234.50`, `1.234,50 €`,
  `￥1,234.50`, `CHF 1'234.50`, `AED 1,234.50`.
- Your choice is saved, survives page refreshes and logout→login, and can be
  changed later from the login form's currency selector.

## 4. Using the dashboard

The sidebar navigates between sections:

- **Portfolio** — build a diversified allocation by budget, risk tolerance,
  time horizon and goals.
- **Risk** — score your portfolio's risk (0–10), rating, factors and stress tests.
- **Screener** — screen asset classes for investment ideas.
- **Projection** — year-by-year illustrative growth chart + table.
- **Chat** — the investment chatbot (§5).
- **History** — your last 20 analyses.
- **Reports** — review and download analysis reports.

Use the theme toggle for dark/light mode. Everything you generate is saved in
your browser's local storage.

## 5. Using the investment chatbot

Open the **Chat** section and type a question, e.g.:

- "What are bonds?"
- "What is diversification?"
- "What are ETFs?"
- "What is portfolio risk?"

The chatbot answers with clear, rule-based explanations — definitions,
benefits, risks, importance and examples.

## 6. Asking follow-up questions

The chatbot remembers the current topic within a conversation. You can ask
short follow-ups without repeating the topic:

> **You:** What are bonds?
> **Bot:** Bonds are loans to governments or companies that pay interest…
> **You:** What about their returns?
> **Bot:** Bonds' benefits: predictable income… *(still about bonds)*
> **You:** And the risks?
> **Bot:** The main risks of bonds are: 1. Interest-rate risk…
> **You:** Give me an example.
> **Bot:** Example: buying a 10-year government bond paying 6% interest…

You can also steer the format: "summarize in bullets", "explain in short",
"why is it important", "what types exist", "what causes it".

## 7. Running investment analysis

Each section has a form:

- **Portfolio:** budget, risk tolerance (conservative/moderate/aggressive),
  time horizon, optional goals/holdings.
- **Risk:** describe your portfolio, pick your risk tolerance and horizon.
- **Screener:** select asset classes and risk tolerance.
- **Projection:** initial amount, regular contribution, risk profile, years.

Submit to generate results instantly.

## 8. Understanding results

- **Portfolio:** a suggested allocation across asset classes with amounts and
  an action plan; adjust inputs to compare scenarios.
- **Risk:** a score out of 10 with a rating (e.g. moderate), the key risk
  factors, and stress-test scenarios showing potential drawdowns.
- **Screener:** a ranked list of investment ideas per asset class with
  rationale and risk notes.
- **Projection:** an assumed annual growth rate for your risk profile applied
  year-by-year (compound growth) — illustrative, not a guarantee.
- **History/Reports:** revisit past analyses or download a text report.

All figures are rule-based estimates for education, not predictions.

## 9. Logging out

When finished, click **Logout**. Your session ends and the auth gate returns.
Your saved preferences (language, currency) remain so your next login starts
with the same setup.
