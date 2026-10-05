# 📊 InvestAI — Investment Analyst Dashboard & Backend

InvestAI is a production web application consisting of a single-page investment
analytics dashboard (auth-gated), a Node.js/Express backend with a rule-based
investment chatbot and analysis engine, and a Supabase (PostgreSQL) database for
user and activity persistence. It also ships an MCP server exposing the same
rule-based analysis tools to MCP clients.

> ⚠️ **Educational purposes only.** This is not personalized financial advice. All
> investing involves risk, including possible loss of principal.

**Production URL:** https://investai-backend-production-8cbd.up.railway.app
**Admin Board:** https://investai-backend-production-8cbd.up.railway.app/admin

---

## ✨ Features

| | Feature | Description |
|---|---|---|
| 💼 | **Portfolio Builder** | Rule-based diversified allocation by budget, risk tolerance, time horizon and goals |
| ⚠️ | **Risk Evaluator** | Portfolio risk score (0–10), rating, key risk factors and stress-test scenarios |
| 🔎 | **Market Screener** | Screen 9 asset classes (equities, bonds, REITs, commodities, crypto…) |
| 📈 | **Future Projection** | Illustrative year-by-year compound growth chart + table |
| 💬 | **Analytics Chat** | Local rule-based investment Q&A (no external AI service) |
| 🕘 | **History** | Last 20 locally generated analyses, saved via `localStorage` |
| 📄 | **Reports** | Review and export any analysis as a downloadable text report |
| 💡 | **Help Chat Widget** | Floating assistant that explains dashboard features |
| 🌙 | **Dark / Light Theme** | Toggleable theme, persisted between sessions |
| 📱 | **Responsive** | Desktop, tablet and mobile layouts |
| 🔐 | **Auth Gate** | Signup / login / logout with language + currency preferences |
| 💱 | **10 Currencies** | USD, INR, EUR, GBP, JPY, CAD, AUD, SGD, AED, CHF with locale-aware formatting |
| 🛡 | **Admin Board** | Token-protected users/activities dashboard with CSV + genuine XLSX export |
| 📊 | **Activity Tracking** | Server-side user upsert + login/logout/analyze events in Supabase |

See **[USER-GUIDE.md](USER-GUIDE.md)** for end-user instructions, **[ADMIN-GUIDE.md](ADMIN-GUIDE.md)**
for administrator instructions, and **[FINAL-TEST-REPORT.md](FINAL-TEST-REPORT.md)** for the
latest production regression results.

---

## 🏗 Architecture

The app is split into two independent layers that work together — or fully apart:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (client layer)                       │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              analytics-chatboy.html  (Dashboard UI)           │  │
│  │                                                               │  │
│  │  Sidebar nav ──► Sections:                                    │  │
│  │    Dashboard │ Portfolio │ Risk │ Screener │ Projection │     │  │
│  │    Chat │ History │ Reports                                   │  │
│  │                                                               │  │
│  │  dashboard.js                                                 │  │
│  │    ├─ Form handling & validation                              │  │
│  │    ├─ Rule-based analysis engines (allocation, risk score,    │  │
│  │    │   screener ideas, compound-growth projection)            │  │
│  │    ├─ Chart rendering                                         │  │
│  │    └─ Persistence ──► localStorage (last 20 analyses, prefs)  │  │
│  └──────────────────────────────┬────────────────────────────────┘  │
└─────────────────────────────────┼───────────────────────────────────┘
                                  │  (optional, only for AI chat)
                    fetch POST /api/chat, GET /api/health
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    LOCAL SERVER (backend layer)                     │
│                                                                     │
│  src/index.ts                                                       │
│    ├─ MCP server (stdio transport)                                  │
│    │    tools: portfolio-builder │ risk-evaluator │                 │
│    │           market-screener        (consumed by MCP clients)     │
│    │                                                                │
│    └─ Express HTTP server (127.0.0.1:4000)                          │
│         ├─ GET  /api/health ──► server + Ollama status              │
│         ├─ POST /api/chat   ──► proxies prompt to Ollama            │
│         └─ CORS enabled for the local dashboard                     │
│                                  │                                  │
│                                  │ HTTP (localhost only)            │
│                                  ▼                                  │
│              ┌─────────────────────────────────────┐                │
│              │  Ollama (optional, 127.0.0.1:11434) │                │
│              │        local LLM, e.g. llama3.2     │                │
│              └─────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────────────┘
```

### Production architecture (frontend / backend / database)

```
┌────────────────────────────────────────────────────────────┐
│                       BROWSER                              │
│  index.html + analytics-chatboy.html + dashboard.js        │
│   ├─ Auth gate (signup/login/logout, language + currency)  │
│   ├─ Dashboard sections (portfolio/risk/screener/projection│
│   │   chat/history/reports)                                │
│   └─ localStorage: session, prefs, users, history          │
└──────────────────────────┬─────────────────────────────────┘
                           │ HTTPS (fetch, INVEST_API_BASE)
                           ▼
┌────────────────────────────────────────────────────────────┐
│          EXPRESS BACKEND  (server/server.js)               │
│   GET  /            → dashboard UI                         │
│   GET  /admin       → Admin Board (token-gated APIs)       │
│   GET  /api/health  POST /api/chat  POST /api/analyze      │
│   POST /api/track-user                                     │
│   GET  /api/admin/summary   GET /api/admin/export (csv|xlsx)│
│   ├─ Rule-based analyze engine (4 modes)                   │
│   ├─ Rule-based chat + context resolution (sessionId)      │
│   └─ Fire-and-forget activity tracking                     │
└──────────────────────────┬─────────────────────────────────┘
                           │ SSL PostgreSQL
                           ▼
┌────────────────────────────────────────────────────────────┐
│              SUPABASE (PostgreSQL)                         │
│  investai_users (email, name, language, currency, created) │
│  investai_activities (email, session_id, activity, detail) │
└────────────────────────────────────────────────────────────┘
```

- **Frontend** — vanilla HTML/CSS/JS; stores the session and preferences in
  `localStorage` and calls the REST API for chat, analysis and tracking.
- **Backend** — stateless Express server (`server/server.js`); validates input,
  runs the rule engines, persists user/activity rows.
- **Database** — Supabase PostgreSQL with two tables: `investai_users` and
  `investai_activities`.

### Authentication flow

1. **Signup** — name, email, password, language, currency → session saved as
   `investai_session_v1` in `localStorage`; the user row is upserted to
   `investai_users` via `POST /api/track-user`.
2. **Login** — email + password (the login form also allows changing the
   currency/language, applied immediately after login).
3. **Persistence** — a refresh keeps the session and prefs; logout clears the
   session and returns to the auth gate while keeping prefs.
4. Regular-user auth state is client-held; the backend records user/activity
   rows only. Admin endpoints are protected server-side by `ADMIN_TOKEN`.

### Chatbot & context resolution

`POST /api/chat` (`{ message, sessionId }`) is a deterministic rule-based Q&A
engine covering bonds, stocks, ETFs, diversification, portfolio/investment risk
and more. A `sessionId` ties messages into a conversation so follow-ups such as
"what about their returns", "and the risks", "give me an example" resolve the
topic and pronouns from the previous turn (`src/context-resolution.js`).
Verified context flows include Bonds, Portfolio risk, Diversification,
Investment risk, Stocks and ETFs chains (see FINAL-TEST-REPORT.md).

### Investment analysis modes

`POST /api/analyze` (`{ type, ... }`) mirrors the dashboard's rule formulas:

| `type` | Required fields | Returns |
|---|---|---|
| `portfolio` | `budget`, `risk`, `horizon` | Diversified allocation and expected metrics |
| `risk` | `description`, `investorRisk`, `horizon` | Risk score 0–10, rating, factors, stress tests |
| `screener` | `risk`, `amounts` | Selected asset classes with ideas |
| `prediction` | `initial`, `risk`, `years` | Year-by-year compound projection |

Unknown types and missing fields are rejected with HTTP 400.

### Currency support

Signup/login offer **USD, INR, EUR, GBP, JPY, CAD, AUD, SGD, AED, CHF**. The
selected code is stored in `investai_prefs_v1` and in the user's database row;
`money()` renders locale-appropriate symbols/separators (`$1,234.50`,
`₹1,234.50`, `1.234,50 €`, `￥1,234.50`, `CHF 1'234.50`, `AED 1,234.50`).
Currency survives refresh and logout→login and can be switched at login.

### User activity tracking

`POST /api/track-user` upserts the user (email, name, language, currency) into
`investai_users` and appends activity rows (`login`/`logout`/`signup`/
`analyze_<type>` with session id and timestamp) into `investai_activities`.
Tracking is fire-and-forget and never blocks an API response.

### Admin Board, CSV & genuine XLSX export

`/admin` is a token-protected dashboard. `/api/admin/summary` and
`/api/admin/export` require the `ADMIN_TOKEN` (`?token=…`); missing or wrong
tokens get **HTTP 401**, and the legacy `investai-admin` default is disabled
when `NODE_ENV=production`. Exports: plain CSV (`text/csv`), or a **genuine
OOXML .xlsx** (`format=xlsx`) built as a ZIP of XML parts with two worksheets
(Users, Activities) — verified to open in Excel-compatible readers.

### Data flow

1. **All analytics run in the browser.** Portfolio allocation, risk scoring,
   screening and projections are computed by rule-based engines inside
   `dashboard.js` — nothing is sent anywhere.
2. **Persistence** — inputs, results and preferences are stored in the
   browser's `localStorage`, so data survives refreshes and never leaves
   the machine.
3. **AI chat is the only optional network hop.** When Ollama is running,
   the dashboard posts chat messages to `POST /api/chat` on the local
   Express server, which forwards them to the local Ollama instance and
   returns the answer. If Ollama is offline, the rule-based chat still works.
4. **MCP clients** (Claude Desktop, IDEs, agents) connect to the MCP server
   over **stdio** and invoke the same three rule-based analysis tools
   directly — no browser involved.

### Key design points

- **Zero cloud dependency** — every core feature works with the network
  unplugged; the only optional integration is a *local* Ollama instance.
- **Shared rule base** — the backend tools and the dashboard's in-browser
  engines implement the same deterministic logic, so results are consistent
  whether you use the UI or an MCP client.
- **Single-process backend** — one `index.ts` run serves both the MCP stdio
  transport and the HTTP API, keeping setup minimal.

---

## 🗂 Project Structure

```
investment-analyst-mcp/
├── src/
│   ├── index.ts                  # MCP server (stdio) + Express HTTP API (port 4000)
│   ├── chat-server.ts            # Chat server variant
│   ├── analytics-chatboy.html    # Dashboard UI (the main app)
│   ├── investment-analytics-guide.html
│   ├── styles.css                # Dashboard styles
│   └── dashboard.js              # Dashboard logic (forms, charts, storage, chat)
├── server/
│   └── server.js                 # Standalone Node server variant
├── package.json
└── tsconfig.json
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18 (for the MCP/HTTP server)
- *(Optional)* **Ollama** running locally at `http://127.0.0.1:11434` with a model
  (e.g. `llama3.2`) if you want the AI-powered chat endpoint:
  ```
  ollama pull llama3.2
  ```

### 1. Run the dashboard (no server needed)

The dashboard works fully standalone — just open it:

```
investment-analyst-mcp/src/analytics-chatboy.html
```

All analysis (portfolio, risk, screener, projection, reports) runs locally in the
browser. No API keys, no backend required.

### 2. Run the backend (optional — enables the Ollama chat API)

```bash
cd investment-analyst-mcp
npm install

# Development (auto-reload)
npm run dev

# Or build + start
npm run build
npm start
```

This starts:

- **MCP server** on **stdio** — exposes `portfolio-builder`, `risk-evaluator`
  and `market-screener` tools to any MCP client
- **HTTP server** on `http://localhost:4000`
  - `GET  /api/health` → server + Ollama status
  - `POST /api/chat`   → `{ "message": "...", "model": "llama3.2" }` (optional)

---

## 🔌 MCP Tools

The MCP server exposes three rule-based tools:

| Tool | Inputs | Output |
|---|---|---|
| `portfolio-builder` | budget, risk tolerance, time horizon, goals, existing holdings, excluded sectors | Suggested allocation table with dollar amounts, action plan, key risks |
| `risk-evaluator` | portfolio description, risk tolerance, time horizon, market context | Risk score /10, rating, key risk factors, stress-test scenarios |
| `market-screener` | asset classes, sectors, risk tolerance, time horizon, themes, max results | Ranked investment ideas with rationale and key risks |

### Example MCP client config (Claude Desktop / other MCP hosts)

```json
{
  "mcpServers": {
    "investment-analyst": {
      "command": "node",
      "args": ["path/to/investment-analyst-mcp/build/index.js"]
    }
  }
}
```

---

## 🧠 How the Analysis Works

All analysis is **local and rule-based**:

- **Portfolio Builder** — maps risk tolerance to a fixed diversified allocation
  (e.g. conservative → 50% bonds / 30% US equities / 10% international / 10% cash)
  and scales it by your budget.
- **Risk Evaluator** — assigns a base score by tolerance (3 / 5 / 7 out of 10) and
  lists key risk factors (concentration, market, liquidity, interest-rate, inflation).
- **Market Screener** — maps each selected asset class to a representative,
  diversified investment idea with rationale and risk notes.
- **Future Projection** — classic compound growth: `FV = PV·(1+r)ⁿ + contributions`,
  with return assumptions per risk profile.

The dashboard stores your inputs and results in **browser `localStorage`** —
data survives refreshes and never leaves your machine. Use **🗑️ Clear Saved Data**
in the sidebar to reset everything.

---

## 🛠 Tech Stack

- **Frontend:** Vanilla HTML / CSS / JavaScript (no frameworks, no build step)
- **Backend:** TypeScript, Express 5, `@modelcontextprotocol/sdk`, Zod
- **AI (optional):** Ollama (local LLM, e.g. `llama3.2`)
- **Storage:** Browser `localStorage`

---

## 🔒 Security Notes

- **Never commit secrets.** `.env` files, `DATABASE_URL`, `ADMIN_TOKEN`, passwords and API keys
  must exist only in the platform's environment settings or a local, git-ignored `.env`.
- `.env` is git-ignored; `.env.production.example` contains placeholders only.
- The admin token must be a long random secret in production; weak defaults are rejected
  (legacy default disabled when `NODE_ENV=production`).
- All database access uses SSL.

## 📝 Disclaimer

This software provides **educational, rule-based estimates only**. It does not use
live market data, does not guarantee future returns, and is **not** financial
advice. Always consult a qualified financial advisor before making investment
decisions.

## 📄 License

Provided as-is for educational use.

---

## Deployment

The backend is a plain Node/Express server (no build step). The frontend is a static bundle (index.html + src/*) that talks to the backend over HTTP.

### Backend (Railway / Render / Fly.io)

1. Create a service from this repo; the platform will detect server/package.json and run 
pm start.
2. Set environment variables in the platform dashboard (**never commit them**):

| Variable | Purpose |
|---|---|
| DATABASE_URL | Supabase Postgres connection string |
| ADMIN_TOKEN | Secret for admin endpoints (required in production) |
| PORT | Optional; defaults to 4000 |

3. Deploy. Health check: GET /api/health returns {"status":"ok",...}.

### Frontend (static hosting: Vercel / Netlify / GitHub Pages)

Serve the repo root as a static site. If the backend lives on a different origin, inject the API base URL before uth.js loads, e.g. in index.html:

`html
<script>window.INVEST_API_BASE = "https://your-backend.up.railway.app";</script>
`

The API base is read from window.INVEST_API_BASE and falls back to same-origin (production) or localhost:4000 (development) — see server/server.js and src/auth.js.

### CORS

Set CORS_ORIGINS on the backend to your frontend origin(s) if serving the frontend from a different domain. When unset, permissive CORS is used (fine for local dev).

### Supabase (database)

The backend uses pg against Supabase Postgres. Set DATABASE_URL in the environment; it is read at startup. Connection uses SSL when the URL contains sslmode=require.
