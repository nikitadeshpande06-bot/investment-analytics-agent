# 📊 InvestAI — Investment Analyst MCP

A **fully local** investment analytics dashboard and MCP (Model Context Protocol) server.
Build portfolios, evaluate risk, screen investment categories and generate illustrative
future projections — **100% in your browser, no API keys required** (no Groq, no cloud AI).

> ⚠️ **Educational purposes only.** This is not personalized financial advice. All
> investing involves risk, including possible loss of principal.

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

## 📝 Disclaimer

This software provides **educational, rule-based estimates only**. It does not use
live market data, does not guarantee future returns, and is **not** financial
advice. Always consult a qualified financial advisor before making investment
decisions.

## 📄 License

Provided as-is for educational use.
