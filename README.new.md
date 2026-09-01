# ðŸ“Š InvestAI â€” Investment Analyst MCP

A **fully local** investment analytics dashboard and MCP (Model Context Protocol) server.
Build portfolios, evaluate risk, screen investment categories and generate illustrative
future projections â€” **100% in your browser, no API keys required** (no Groq, no cloud AI).

> âš ï¸ **Educational purposes only.** This is not personalized financial advice. All
> investing involves risk, including possible loss of principal.

---

## âœ¨ Features

| | Feature | Description |
|---|---|---|
| ðŸ’¼ | **Portfolio Builder** | Rule-based diversified allocation by budget, risk tolerance, time horizon and goals |
| âš ï¸ | **Risk Evaluator** | Portfolio risk score (0â€“10), rating, key risk factors and stress-test scenarios |
| ðŸ”Ž | **Market Screener** | Screen 9 asset classes (equities, bonds, REITs, commodities, cryptoâ€¦) |
| ðŸ“ˆ | **Future Projection** | Illustrative year-by-year compound growth chart + table |
| ðŸ’¬ | **Analytics Chat** | Local rule-based investment Q&A (no external AI service) |
| ðŸ•˜ | **History** | Last 20 locally generated analyses, saved via `localStorage` |
| ðŸ“„ | **Reports** | Review and export any analysis as a downloadable text report |
| ðŸ’¡ | **Help Chat Widget** | Floating assistant that explains dashboard features |
| ðŸŒ™ | **Dark / Light Theme** | Toggleable theme, persisted between sessions |
| ðŸ“± | **Responsive** | Desktop, tablet and mobile layouts |

---

## ðŸ— Architecture

The app is split into two independent layers that work together â€” or fully apart:

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                        BROWSER (client layer)                       â”‚
â”‚                                                                     â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
â”‚  â”‚              analytics-chatboy.html  (Dashboard UI)           â”‚  â”‚
â”‚  â”‚                                                               â”‚  â”‚
â”‚  â”‚  Sidebar nav â”€â”€â–º Sections:                                    â”‚  â”‚
â”‚  â”‚    Dashboard â”‚ Portfolio â”‚ Risk â”‚ Screener â”‚ Projection â”‚     â”‚  â”‚
â”‚  â”‚    Chat â”‚ History â”‚ Reports                                   â”‚  â”‚
â”‚  â”‚                                                               â”‚  â”‚
â”‚  â”‚  dashboard.js                                                 â”‚  â”‚
â”‚  â”‚    â”œâ”€ Form handling & validation                              â”‚  â”‚
â”‚  â”‚    â”œâ”€ Rule-based analysis engines (allocation, risk score,    â”‚  â”‚
â”‚  â”‚    â”‚   screener ideas, compound-growth projection)            â”‚  â”‚
â”‚  â”‚    â”œâ”€ Chart rendering                                         â”‚  â”‚
â”‚  â”‚    â””â”€ Persistence â”€â”€â–º localStorage (last 20 analyses, prefs)  â”‚  â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                  â”‚  (optional, only for AI chat)
                    fetch POST /api/chat, GET /api/health
                                  â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    LOCAL SERVER (backend layer)                     â”‚
â”‚                                                                     â”‚
â”‚  src/index.ts                                                       â”‚
â”‚    â”œâ”€ MCP server (stdio transport)                                  â”‚
â”‚    â”‚    tools: portfolio-builder â”‚ risk-evaluator â”‚                 â”‚
â”‚    â”‚           market-screener        (consumed by MCP clients)     â”‚
â”‚    â”‚                                                                â”‚
â”‚    â””â”€ Express HTTP server (127.0.0.1:4000)                          â”‚
â”‚         â”œâ”€ GET  /api/health â”€â”€â–º server + Ollama status              â”‚
â”‚         â”œâ”€ POST /api/chat   â”€â”€â–º proxies prompt to Ollama            â”‚
â”‚         â””â”€ CORS enabled for the local dashboard                     â”‚
â”‚                                  â”‚                                  â”‚
â”‚                                  â”‚ HTTP (localhost only)            â”‚
â”‚                                  â–¼                                  â”‚
â”‚              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                â”‚
â”‚              â”‚  Ollama (optional, 127.0.0.1:11434) â”‚                â”‚
â”‚              â”‚        local LLM, e.g. llama3.2     â”‚                â”‚
â”‚              â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Data flow

1. **All analytics run in the browser.** Portfolio allocation, risk scoring,
   screening and projections are computed by rule-based engines inside
   `dashboard.js` â€” nothing is sent anywhere.
2. **Persistence** â€” inputs, results and preferences are stored in the
   browser's `localStorage`, so data survives refreshes and never leaves
   the machine.
3. **AI chat is the only optional network hop.** When Ollama is running,
   the dashboard posts chat messages to `POST /api/chat` on the local
   Express server, which forwards them to the local Ollama instance and
   returns the answer. If Ollama is offline, the rule-based chat still works.
4. **MCP clients** (Claude Desktop, IDEs, agents) connect to the MCP server
   over **stdio** and invoke the same three rule-based analysis tools
   directly â€” no browser involved.

### Key design points

- **Zero cloud dependency** â€” every core feature works with the network
  unplugged; the only optional integration is a *local* Ollama instance.
- **Shared rule base** â€” the backend tools and the dashboard's in-browser
  engines implement the same deterministic logic, so results are consistent
  whether you use the UI or an MCP client.
- **Single-process backend** â€” one `index.ts` run serves both the MCP stdio
  transport and the HTTP API, keeping setup minimal.

---

## ðŸ—‚ Project Structure

```
investment-analyst-mcp/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ index.ts                  # MCP server (stdio) + Express HTTP API (port 4000)
â”‚   â”œâ”€â”€ chat-server.ts            # Chat server variant
â”‚   â”œâ”€â”€ analytics-chatboy.html    # Dashboard UI (the main app)
â”‚   â”œâ”€â”€ investment-analytics-guide.html
â”‚   â”œâ”€â”€ styles.css                # Dashboard styles
â”‚   â””â”€â”€ dashboard.js              # Dashboard logic (forms, charts, storage, chat)
â”œâ”€â”€ server/
â”‚   â””â”€â”€ server.js                 # Standalone Node server variant
â”œâ”€â”€ package.json
â””â”€â”€ tsconfig.json
```

---

## ðŸš€ Getting Started

### Prerequisites

- **Node.js** â‰¥ 18 (for the MCP/HTTP server)
- *(Optional)* **Ollama** running locally at `http://127.0.0.1:11434` with a model
  (e.g. `llama3.2`) if you want the AI-powered chat endpoint:
  ```
  ollama pull llama3.2
  ```

### 1. Run the dashboard (no server needed)

The dashboard works fully standalone â€” just open it:

```
investment-analyst-mcp/src/analytics-chatboy.html
```

All analysis (portfolio, risk, screener, projection, reports) runs locally in the
browser. No API keys, no backend required.

### 2. Run the backend (optional â€” enables the Ollama chat API)

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

- **MCP server** on **stdio** â€” exposes `portfolio-builder`, `risk-evaluator`
  and `market-screener` tools to any MCP client
- **HTTP server** on `http://localhost:4000`
  - `GET  /api/health` â†’ server + Ollama status
  - `POST /api/chat`   â†’ `{ "message": "...", "model": "llama3.2" }` (optional)

---

## ðŸ”Œ MCP Tools

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

## ðŸ§  How the Analysis Works

All analysis is **local and rule-based**:

- **Portfolio Builder** â€” maps risk tolerance to a fixed diversified allocation
  (e.g. conservative â†’ 50% bonds / 30% US equities / 10% international / 10% cash)
  and scales it by your budget.
- **Risk Evaluator** â€” assigns a base score by tolerance (3 / 5 / 7 out of 10) and
  lists key risk factors (concentration, market, liquidity, interest-rate, inflation).
- **Market Screener** â€” maps each selected asset class to a representative,
  diversified investment idea with rationale and risk notes.
- **Future Projection** â€” classic compound growth: `FV = PVÂ·(1+r)â¿ + contributions`,
  with return assumptions per risk profile.

The dashboard stores your inputs and results in **browser `localStorage`** â€”
data survives refreshes and never leaves your machine. Use **ðŸ—‘ï¸ Clear Saved Data**
in the sidebar to reset everything.

---

## ðŸ›  Tech Stack

- **Frontend:** Vanilla HTML / CSS / JavaScript (no frameworks, no build step)
- **Backend:** TypeScript, Express 5, `@modelcontextprotocol/sdk`, Zod
- **AI (optional):** Ollama (local LLM, e.g. `llama3.2`)
- **Storage:** Browser `localStorage`

---

## ðŸ“ Disclaimer

This software provides **educational, rule-based estimates only**. It does not use
live market data, does not guarantee future returns, and is **not** financial
advice. Always consult a qualified financial advisor before making investment
decisions.

## ðŸ“„ License

Provided as-is for educational use.
