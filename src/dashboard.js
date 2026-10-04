"use strict";

/* ============================================================
   INVESTMENT ANALYTICS DASHBOARD
   ============================================================ */

/*
   IMPORTANT:
   The browser does NOT connect directly to Ollama.

   Browser
      ↓
   Node/Express server :4000
      ↓
   /api/chat
      ↓
   Ollama
      ↓
   llama3.2

   Therefore dashboard.js only needs to communicate with
   the local backend.
*/

/* API base: same-origin in production (Cloud Run), localhost only in dev.
   Set window.INVEST_API_BASE to override (e.g. for a custom domain). */
const API_URL =
    window.INVEST_API_BASE ||
    (window.location.protocol.startsWith("http") &&
     !window.location.hostname.includes("localhost")
        ? window.location.origin
        : "http://localhost:4000");

/*
 * BACKEND CONNECTION HELPERS
 * Optional backend at API_URL (server/server.js). Every call
 * degrades gracefully: when the backend is not running, the
 * existing local rule-based logic is used unchanged.
 */
async function requestServerAnalysis(payload) {
    try {
        const response = await fetch(API_URL + "/api/analyze", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) return null;

        const data = await response.json();

        return data && data.success ? data.result : null;
    } catch (error) {
        console.warn(
            "Backend /api/analyze unavailable, using local analysis.",
            error
        );

        return null;
    }
}

async function checkBackendHealth() {
    try {
        const response = await fetch(API_URL + "/api/health");

        if (!response.ok) return;

        const data = await response.json();

        if (data && data.status === "ok") {
            console.info(
                "Backend connected: " +
                    (data.service || "InvestAI Analytics Server")
            );
        }
    } catch (error) {
        console.info(
            "Backend not running on " + API_URL +
                " — using local rule-based mode."
        );
    }
}

const STORAGE_KEY =
    "investment_dashboard_local_v5";

const THEME_KEY =
    "investment_dashboard_theme";

/*
   Chat is restricted to investment and finance questions.

   An investment-only guard refuses clearly unrelated questions
   (see the INVESTMENT TOPIC GUARD section). Short contextual
   follow-ups such as "Why is it important?" are allowed when they
   refer to an earlier investment topic, and a refusal only blocks
   the current message — the conversation continues normally.
*/

const defaultState = {
    portfolio: null,
    risk: null,
    screener: null,
    prediction: null,
    chat: [],
    history: [],
    lastSection: "dashboard"
};

let state = loadState();

/* ============================================================
   BASIC HELPERS
   ============================================================ */

function $(id) {
    return document.getElementById(id);
}

function getValue(id) {
    const element = $(id);

    return element
        ? String(element.value || "").trim()
        : "";
}

function setValue(id, value) {
    const element = $(id);

    if (element) {
        element.value = value ?? "";
    }
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* ============================================================
   USER PREFERENCES (language + currency, set at sign up / sign in)
   ============================================================ */

const PREFS_KEY = "investai_prefs_v1";

function getPrefs() {
    try {
        const raw = localStorage.getItem(PREFS_KEY);
        const prefs = raw ? JSON.parse(raw) : null;
        return (prefs && prefs.currency)
            ? prefs
            : { language: "en", currency: "USD" };
    } catch (error) {
        return { language: "en", currency: "USD" };
    }
}

/* ============================================================
   CHAT SETTINGS
   Persisted separately from dashboard state so the chat
   behavior survives reloads without touching existing data.
   ============================================================ */

const SETTINGS_KEY = "investai_chat_settings_v1";

const defaultSettings = {
    investmentOnly: true,
    followUpContext: true,
    responseDetail: "medium",
    riskLevel: "moderate",
    horizon: "long-term"
};

let chatSettings = loadChatSettings();

function loadChatSettings() {
    try {
        const raw =
            localStorage.getItem(SETTINGS_KEY);

        const parsed =
            raw ? JSON.parse(raw) : {};

        return {
            ...defaultSettings,
            ...parsed
        };

    } catch (error) {
        return {
            ...defaultSettings
        };
    }
}

function saveChatSettings() {
    try {
        localStorage.setItem(
            SETTINGS_KEY,
            JSON.stringify(chatSettings)
        );

    } catch (error) {
        console.error(
            "Settings saving error:",
            error
        );
    }
}

function resetChatSettings() {
    chatSettings = {
        ...defaultSettings
    };

    saveChatSettings();

    applyChatSettingsToUI();
}

/*
 * Sync the Settings page controls with the current
 * values (used on load and after a reset).
 */
function applyChatSettingsToUI() {
    const investmentOnly =
        $("settingInvestmentOnly");

    const followUp =
        $("settingFollowUp");

    const detail =
        $("settingResponseDetail");

    const risk =
        $("settingRiskLevel");

    const horizon =
        $("settingHorizon");

    if (investmentOnly) {
        investmentOnly.checked =
            chatSettings.investmentOnly;
    }

    if (followUp) {
        followUp.checked =
            chatSettings.followUpContext;
    }

    if (detail) {
        detail.value =
            chatSettings.responseDetail;
    }

    if (risk) {
        risk.value =
            chatSettings.riskLevel;
    }

    if (horizon) {
        horizon.value =
            chatSettings.horizon;
    }
}

/*
 * Wire up the Settings page controls. Every change is
 * saved immediately and takes effect on the next question.
 */
function initChatSettings() {
    const investmentOnly =
        $("settingInvestmentOnly");

    if (investmentOnly) {
        investmentOnly.addEventListener(
            "change",
            () => {

                chatSettings.investmentOnly =
                    investmentOnly.checked;

                saveChatSettings();

                showToast(
                    investmentOnly.checked
                        ? "Investment-only mode enabled."
                        : "Investment-only mode disabled — general questions are now allowed.",
                    "⚙️"
                );
            }
        );
    }

    const followUp =
        $("settingFollowUp");

    if (followUp) {
        followUp.addEventListener(
            "change",
            () => {

                chatSettings.followUpContext =
                    followUp.checked;

                saveChatSettings();

                showToast(
                    followUp.checked
                        ? "Follow-up context enabled."
                        : "Follow-up context disabled — each question is answered on its own.",
                    "⚙️"
                );
            }
        );
    }

    const detail =
        $("settingResponseDetail");

    if (detail) {
        detail.addEventListener(
            "change",
            () => {

                chatSettings.responseDetail =
                    detail.value || "medium";

                saveChatSettings();

                showToast(
                    "Response detail set to " +
                    detail.value + ".",
                    "⚙️"
                );
            }
        );
    }

    const risk =
        $("settingRiskLevel");

    if (risk) {
        risk.addEventListener(
            "change",
            () => {

                chatSettings.riskLevel =
                    risk.value || "moderate";

                saveChatSettings();

                showToast(
                    "Risk level set to " +
                    risk.value + ".",
                    "⚙️"
                );
            }
        );
    }

    const horizon =
        $("settingHorizon");

    if (horizon) {
        horizon.addEventListener(
            "change",
            () => {

                chatSettings.horizon =
                    horizon.value || "long-term";

                saveChatSettings();

                showToast(
                    "Investment horizon set to " +
                    horizon.value + ".",
                    "⚙️"
                );
            }
        );
    }

    /* Clear Conversation — reuse the existing clearChat flow. */
    const clearButton =
        $("settingsClearChatBtn");

    if (clearButton) {
        clearButton.addEventListener(
            "click",
            () => {

                if (
                    Array.isArray(state.chat) &&
                    state.chat.length &&
                    !confirm(
                        "Clear the chat? All messages in this conversation " +
                        "will be removed permanently."
                    )
                ) {
                    return;
                }

                clearChat();
            }
        );
    }

    /* Reset Settings — restore defaults. */
    const resetButton =
        $("settingsResetBtn");

    if (resetButton) {
        resetButton.addEventListener(
            "click",
            () => {

                resetChatSettings();

                showToast(
                    "Settings restored to defaults.",
                    "♻️"
                );
            }
        );
    }

    applyChatSettingsToUI();
}

const CURRENCY_LOCALES = {
    USD: "en-US", INR: "en-IN", EUR: "de-DE", GBP: "en-GB",
    JPY: "ja-JP", CAD: "en-CA", AUD: "en-AU", SGD: "en-SG",
    AED: "en-AE", CHF: "de-CH"
};

/* ============================================================
   FORMATTING
   ============================================================ */

function money(value) {
    const prefs = getPrefs();
    return new Intl.NumberFormat(
        CURRENCY_LOCALES[prefs.currency] || "en-US", {
        style: "currency",
        currency: prefs.currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(Number(value) || 0);
}

function percent(value) {
    return `${Number(value).toFixed(1)}%`;
}

function capitalize(value) {
    if (!value) return "";

    const text = String(value);

    return (
        text.charAt(0).toUpperCase() +
        text.slice(1)
    );
}

function formatCompactMoney(value) {
    const amount = Number(value) || 0;
    const symbol =
        { USD: "$", INR: "₹", EUR: "€", GBP: "£", JPY: "¥",
          CAD: "C$", AUD: "A$", SGD: "S$", AED: "د.إ", CHF: "Fr" }[
            getPrefs().currency] || "$";

    if (amount >= 1000000000) {
        return `${symbol}${(
            amount / 1000000000
        ).toFixed(1)}B`;
    }

    if (amount >= 1000000) {
        return `${symbol}${(
            amount / 1000000
        ).toFixed(1)}M`;
    }

    if (amount >= 1000) {
        return `${symbol}${(
            amount / 1000
        ).toFixed(1)}K`;
    }

    return `${symbol}${Math.round(amount)}`;
}

/* ============================================================
   LOCAL STORAGE
   ============================================================ */

function loadState() {
    try {
        const saved =
            localStorage.getItem(
                STORAGE_KEY
            );

        if (!saved) {
            return JSON.parse(
                JSON.stringify(
                    defaultState
                )
            );
        }

        const parsed =
            JSON.parse(saved);

        return {
            ...defaultState,
            ...parsed,

            chat:
                Array.isArray(parsed.chat)
                    ? parsed.chat
                    : [],

            history:
                Array.isArray(parsed.history)
                    ? parsed.history
                    : []
        };

    } catch (error) {
        console.error(
            "State loading error:",
            error
        );

        return JSON.parse(
            JSON.stringify(
                defaultState
            )
        );
    }
}

function saveState() {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(state)
        );

    } catch (error) {
        console.error(
            "State saving error:",
            error
        );
    }
}

/* ============================================================
   TOAST
   ============================================================ */

let toastTimer;

function showToast(
    message,
    icon = "✓"
) {
    const toast = $("toast");

    if (!toast) {
        console.log(message);
        return;
    }

    const messageElement =
        $("toastMessage");

    const iconElement =
        $("toastIcon");

    if (messageElement) {
        messageElement.textContent =
            message;
    }

    if (iconElement) {
        iconElement.textContent =
            icon;
    }

    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer =
        setTimeout(() => {
            toast.classList.remove(
                "show"
            );
        }, 3000);
}

/* ============================================================
   NAVIGATION
   ============================================================ */

const sectionMap = {
    dashboard:
        "dashboardSection",

    portfolio:
        "portfolioSection",

    risk:
        "riskSection",

    screener:
        "screenerSection",

    markets:
        "marketsSection",

    options:
        "optionsSection",

    watchlist:
        "watchlistSection",

    prediction:
        "predictionSection",

    global:
        "globalSection",

    chat:
        "chatSection",

    settings:
        "settingsSection",

    history:
        "historySection",

    reports:
        "reportsSection"
};

const pageTitles = {
    dashboard: [
        "Investment Dashboard",
        "Analyze and manage your investment information."
    ],

    portfolio: [
        "Portfolio Builder",
        "Create a diversified investment allocation."
    ],

    risk: [
        "Risk Evaluator",
        "Evaluate portfolio risk."
    ],

    screener: [
        "Market Screener",
        "Explore investment categories."
    ],

    markets: [
        "Global Markets",
        "World stock markets, exchanges and indices."
    ],

    watchlist: [
        "Watchlist",
        "Track stocks from any market."
    ],

    prediction: [
        "Future Projection",
        "Visualize illustrative investment growth."
    ],

    options: [
        "Types of Investments",
        "Compare investment types by risk, return and liquidity."
    ],

    global: [
        "Global Markets",
        "World indices, global stock lookup, watchlist and currency conversion."
    ],

    chat: [
        "Analytics Chat",
        "Ask questions about investments, technology, education, programming, general knowledge, and more."
    ],

    settings: [
        "Settings",
        "Configure chat behavior and investment preferences."
    ],

    history: [
        "Analysis History",
        "Review your previous locally generated analyses."
    ],

    reports: [
        "Investment Reports",
        "Review and export your analysis."
    ]
};

function showSection(sectionName) {
    if (!sectionMap[sectionName]) {
        sectionName = "dashboard";
    }

    Object.keys(sectionMap)
        .forEach(key => {

            const section =
                $(sectionMap[key]);

            if (section) {
                section.classList.toggle(
                    "active",
                    key === sectionName
                );
            }
        });

    document
        .querySelectorAll(
            "[data-section]"
        )
        .forEach(element => {

            element.classList.toggle(
                "active",
                element.dataset.section ===
                    sectionName
            );
        });

    const title =
        $("pageTitle");

    const subtitle =
        $("pageSubtitle");

    if (pageTitles[sectionName]) {

        if (title) {
            title.textContent =
                pageTitles[sectionName][0];
        }

        if (subtitle) {
            subtitle.textContent =
                pageTitles[sectionName][1];
        }
    }

    state.lastSection =
        sectionName;

    saveState();

    const sidebar =
        $("sidebar");

    if (sidebar) {
        sidebar.classList.remove(
            "open"
        );
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

    if (
        sectionName ===
        "prediction"
    ) {
        connectPortfolioToPrediction();
    }

    if (
        sectionName ===
        "risk"
    ) {
        connectPortfolioToRisk();
    }

    if (
        sectionName ===
        "chat"
    ) {
        setTimeout(() => {

            const input =
                $("chatInput");

            if (input) {
                input.focus();
            }

        }, 100);
    }
}

function initNavigation() {

    document
        .querySelectorAll(
            "[data-section]"
        )
        .forEach(element => {

            element.addEventListener(
                "click",
                () => {

                    showSection(
                        element.dataset.section
                    );
                }
            );
        });

    const mobileButton =
        $("mobileMenuBtn");

    if (mobileButton) {

        mobileButton.addEventListener(
            "click",
            () => {

                const sidebar =
                    $("sidebar");

                if (sidebar) {
                    sidebar.classList.toggle(
                        "open"
                    );
                }
            }
        );
    }
}

/* ============================================================
   THEME
   ============================================================ */

function initTheme() {

    const savedTheme =
        localStorage.getItem(
            THEME_KEY
        );

    if (savedTheme === "dark") {
        document.body.classList.add(
            "dark-mode"
        );
    }

    updateThemeButton();

    const button =
        $("themeToggle");

    if (button) {

        button.addEventListener(
            "click",
            toggleTheme
        );
    }
}

function toggleTheme() {

    document.body.classList.toggle(
        "dark-mode"
    );

    const dark =
        document.body.classList.contains(
            "dark-mode"
        );

    localStorage.setItem(
        THEME_KEY,
        dark ? "dark" : "light"
    );

    updateThemeButton();

    requestAnimationFrame(renderAllCharts);
}

function updateThemeButton() {

    const button =
        $("themeToggle");

    if (!button) return;

    const dark =
        document.body.classList.contains(
            "dark-mode"
        );

    button.textContent =
        dark ? "☀️" : "🌙";
}

/* ============================================================
   PORTFOLIO
   ============================================================ */

function getPortfolioAllocation(
    risk
) {

    if (risk === "conservative") {

        return [
            {
                asset: "US Bonds",
                percentage: 45
            },

            {
                asset: "US Equities",
                percentage: 30
            },

            {
                asset:
                    "International Equities",
                percentage: 10
            },

            {
                asset:
                    "Cash / Treasury Bills",
                percentage: 15
            }
        ];
    }

    if (risk === "aggressive") {

        return [
            {
                asset: "US Equities",
                percentage: 60
            },

            {
                asset:
                    "International Equities",
                percentage: 20
            },

            {
                asset: "US Bonds",
                percentage: 10
            },

            {
                asset:
                    "Cash / Alternatives",
                percentage: 10
            }
        ];
    }

    return [
        {
            asset: "US Equities",
            percentage: 45
        },

        {
            asset: "US Bonds",
            percentage: 30
        },

        {
            asset:
                "International Equities",
            percentage: 15
        },

        {
            asset:
                "Cash / Treasury Bills",
            percentage: 10
        }
    ];
}

async function handlePortfolio(event) {

    event.preventDefault();

    const budget =
        Number(
            getValue("budget")
        );

    const risk =
        getValue(
            "portfolioRisk"
        );

    const horizon =
        Number(
            getValue("timeHorizon")
        );

    const goal =
        getValue(
            "investmentGoal"
        );

    const holdings =
        getValue(
            "existingHoldings"
        );

    const excluded =
        getValue(
            "excludedSectors"
        );

    if (
        budget <= 0 ||
        !risk ||
        horizon <= 0 ||
        !goal
    ) {

        showToast(
            "Please complete the required fields.",
            "⚠️"
        );

        return;
    }

    /* Backend first (same rule-based formulas); local
     * computation remains the fallback. */
    const serverResult = await requestServerAnalysis({
        type: "portfolio",
        budget,
        risk,
        horizon,
        goal,
        holdings,
        excluded
    });

    const allocation =
        (serverResult && Array.isArray(serverResult.allocation))
            ? serverResult.allocation
            : getPortfolioAllocation(risk);

    const rows =
        allocation.map(item => ({
            ...item,

            amount:
                budget *
                item.percentage /
                100
        }));

    state.portfolio = {

        budget,
        risk,
        horizon,
        goal,
        holdings,
        excluded,

        allocation: rows,

        createdAt:
            new Date().toISOString()
    };

    saveState();

    renderPortfolio();

    connectPortfolioToRisk();

    connectPortfolioToPrediction();

    updateDashboardStats();

    updateReport();

    recordHistory(
        "portfolio",
        "Portfolio analysis — " + money(budget),
        capitalize(risk) + " risk, " + horizon +
            " year horizon — Goal: " + (goal || "N/A")
    );

    showToast(
        "Portfolio analysis completed.",
        "✓"
    );
}

function renderPortfolio() {

    const portfolio =
        state.portfolio;

    if (!portfolio) return;

    const result =
        $("portfolioResult");

    const status =
        $("portfolioStatus");

    if (status) {
        status.textContent =
            "Completed";
    }

    if (!result) return;

    result.classList.remove(
        "empty-result"
    );

    let html = `
        <div class="analysis-summary">

            <div class="analysis-highlight">
                <span>
                    Investment Budget
                </span>

                <strong>
                    ${money(
                        portfolio.budget
                    )}
                </strong>
            </div>

            <div class="analysis-highlight">
                <span>
                    Risk Profile
                </span>

                <strong>
                    ${capitalize(
                        portfolio.risk
                    )}
                </strong>
            </div>

            <div class="analysis-highlight">
                <span>
                    Time Horizon
                </span>

                <strong>
                    ${portfolio.horizon}
                    years
                </strong>
            </div>

        </div>

        <div class="analysis-block">

            <h4>
                Suggested Allocation
            </h4>

            <div class="allocation-list">
    `;

    portfolio.allocation
        .forEach(item => {

            html += `
                <div class="allocation-row">

                    <div>

                        <strong>
                            ${escapeHTML(
                                item.asset
                            )}
                        </strong>

                        <span>
                            ${item.percentage}%
                        </span>

                    </div>

                    <strong>
                        ${money(
                            item.amount
                        )}
                    </strong>

                </div>
            `;
        });

    html += `
            </div>

        </div>

        <div class="analysis-block">

            <h4>
                Investment Goal
            </h4>

            <p>
                ${escapeHTML(
                    portfolio.goal
                )}
            </p>

        </div>

        <div class="analysis-block">

            <h4>
                Action Plan
            </h4>

            <ol>

                <li>
                    Diversify across asset classes.
                </li>

                <li>
                    Review the allocation periodically.
                </li>

                <li>
                    Rebalance when necessary.
                </li>

                <li>
                    Match investments to your time horizon.
                </li>

                <li>
                    Maintain emergency savings separately.
                </li>

            </ol>

        </div>
    `;

    result.innerHTML =
        html;

    renderPortfolioChart();
}

function renderPortfolioChart() {

    const container =
        $("portfolioChart");

    if (
        !container ||
        !state.portfolio
    ) {
        return;
    }

    const allocation =
        state.portfolio.allocation;

    const maximum =
        Math.max(
            ...allocation.map(
                item =>
                    item.percentage
            )
        );

    let html = `
        <div class="local-chart">

            <div class="chart-title">
                Portfolio Allocation
            </div>
    `;

    allocation.forEach(item => {

        const width =
            Math.max(
                5,

                item.percentage /
                maximum *
                100
            );

        html += `
            <div class="bar-row">

                <div class="bar-label">

                    <span>
                        ${escapeHTML(
                            item.asset
                        )}
                    </span>

                    <strong>
                        ${item.percentage}%
                    </strong>

                </div>

                <div class="bar-track">

                    <div
                        class="bar-fill"
                        style="width:${width}%"
                    ></div>

                </div>

                <div class="bar-value">
                    ${money(
                        item.amount
                    )}
                </div>

            </div>
        `;
    });

    html += `
        </div>
    `;

    container.innerHTML =
        html;
}

/* ============================================================
   RISK
   ============================================================ */

function calculateRiskScore(
    risk
) {

    if (risk === "conservative") {

        return {
            score: 3,
            rating: "Low to Moderate"
        };
    }

    if (risk === "aggressive") {

        return {
            score: 7,
            rating: "High"
        };
    }

    return {
        score: 5,
        rating: "Moderate"
    };
}

async function handleRisk(event) {

    event.preventDefault();

    const description =
        getValue(
            "portfolioDescription"
        );

    const investorRisk =
        getValue(
            "investorRisk"
        );

    const horizon =
        Number(
            getValue(
                "riskTimeHorizon"
            )
        );

    const marketContext =
        getValue(
            "marketContext"
        );

    if (
        !description ||
        !investorRisk ||
        horizon <= 0
    ) {

        showToast(
            "Please complete the required risk fields.",
            "⚠️"
        );

        return;
    }

    /* Backend first (same rule-based formulas); local
     * computation remains the fallback. */
    const serverResult = await requestServerAnalysis({
        type: "risk",
        description,
        investorRisk,
        horizon,
        marketContext
    });

    const calculated =
        (serverResult &&
            Number.isFinite(serverResult.score) &&
            serverResult.rating)
            ? {
                  score: serverResult.score,
                  rating: serverResult.rating
              }
            : calculateRiskScore(investorRisk);

    state.risk = {

        description,
        investorRisk,
        horizon,
        marketContext,

        score:
            calculated.score,

        rating:
            calculated.rating,

        createdAt:
            new Date().toISOString()
    };

    saveState();

    renderRisk();

    updateDashboardStats();

    updateReport();

    recordHistory(
        "risk",
        "Risk evaluation — " + capitalize(investorRisk),
        "Score " + calculated.score + " (" +
            calculated.rating + "), " + horizon + " year horizon"
    );

    showToast(
        "Risk evaluation completed.",
        "✓"
    );
}

function renderRisk() {

    const risk =
        state.risk;

    if (!risk) return;

    const result =
        $("riskResult");

    const status =
        $("riskStatus");

    if (status) {
        status.textContent =
            "Completed";
    }

    if (!result) return;

    result.classList.remove(
        "empty-result"
    );

    result.innerHTML = `

        <div class="analysis-summary">

            <div class="analysis-highlight">

                <span>
                    Risk Score
                </span>

                <strong>
                    ${risk.score}/10
                </strong>

            </div>

            <div class="analysis-highlight">

                <span>
                    Risk Rating
                </span>

                <strong>
                    ${escapeHTML(
                        risk.rating
                    )}
                </strong>

            </div>

            <div class="analysis-highlight">

                <span>
                    Time Horizon
                </span>

                <strong>
                    ${risk.horizon}
                    years
                </strong>

            </div>

        </div>

        <div class="analysis-block">

            <h4>
                Portfolio
            </h4>

            <p>
                ${escapeHTML(
                    risk.description
                )}
            </p>

        </div>

        <div class="analysis-block">

            <h4>
                Major Risk Factors
            </h4>

            <ul>

                <li>
                    Market volatility
                </li>

                <li>
                    Concentration risk
                </li>

                <li>
                    Liquidity risk
                </li>

                <li>
                    Inflation risk
                </li>

                <li>
                    Interest-rate risk
                </li>

            </ul>

        </div>

        <div class="analysis-block">

            <h4>
                Risk Management
            </h4>

            <ol>

                <li>
                    Diversify holdings.
                </li>

                <li>
                    Avoid excessive concentration.
                </li>

                <li>
                    Match investments to your horizon.
                </li>

                <li>
                    Review allocations periodically.
                </li>

                <li>
                    Maintain emergency savings.
                </li>

            </ol>

        </div>
    `;

    renderRiskChart();
}

function renderRiskChart() {

    const container =
        $("riskChart");

    if (
        !container ||
        !state.risk
    ) {
        return;
    }

    const score =
        state.risk.score;

    container.innerHTML = `

        <div class="risk-visual">

            <div class="risk-meter">

                <div
                    class="risk-meter-fill"
                    style="width:${score * 10}%"
                ></div>

            </div>

            <div class="risk-scale">

                <span>
                    Low
                </span>

                <span>
                    Moderate
                </span>

                <span>
                    High
                </span>

            </div>

            <div class="risk-score-large">
                ${score}/10
            </div>

            <div class="risk-rating-large">
                ${escapeHTML(
                    state.risk.rating
                )}
            </div>

        </div>
    `;
}
/* ============================================================
   PREDICTION
   ============================================================ */

function calculateProjection(
    initial,
    years,
    risk
) {
    const assumptions = {
        conservative: 0.05,
        moderate: 0.08,
        aggressive: 0.11
    };

    const expectedRate =
        assumptions[risk] ||
        assumptions.moderate;

    const conservativeRate =
        Math.max(
            0.02,
            expectedRate - 0.03
        );

    const optimisticRate =
        expectedRate + 0.03;

    const rows = [];

    let expectedValue =
        Number(initial) || 0;

    let conservativeValue =
        Number(initial) || 0;

    let optimisticValue =
        Number(initial) || 0;

    for (
        let year = 1;
        year <= years;
        year++
    ) {

        expectedValue *=
            1 + expectedRate;

        conservativeValue *=
            1 + conservativeRate;

        optimisticValue *=
            1 + optimisticRate;

        rows.push({

            year,

            contribution: 0,

            conservativeValue,

            endingValue:
                expectedValue,

            optimisticValue
        });
    }

    return rows;
}

async function handlePrediction(event) {

    event.preventDefault();

    const initial =
        Number(
            getValue(
                "predictionInitial"
            )
        );

    const risk =
        getValue(
            "predictionRisk"
        ) || "moderate";

    const years =
        Number(
            getValue(
                "predictionYears"
            )
        );

    if (
        initial <= 0 ||
        years <= 0
    ) {

        showToast(
            "Please enter a valid investment amount and time horizon.",
            "⚠️"
        );

        return;
    }

    const rows =
        calculateProjection(
            initial,
            years,
            risk
        );

    state.prediction = {

        initial,
        risk,
        years,
        rows,

        createdAt:
            new Date().toISOString()
    };

    saveState();

    renderPrediction();

    updateDashboardStats();

    updateReport();

    showToast(
        "Future projection completed.",
        "✓"
    );
}

function renderPrediction() {

    const prediction =
        state.prediction;

    if (!prediction) return;

    const result =
        $("predictionResult");

    const status =
        $("predictionStatus");

    if (status) {
        status.textContent =
            "Completed";
    }

    if (!result) return;

    const rows =
        prediction.rows;

    if (!rows.length) {
        return;
    }

    const finalRow =
        rows[rows.length - 1];

    result.classList.remove(
        "empty-result"
    );

    result.innerHTML = `

        <div class="analysis-summary">

            <div class="analysis-highlight">

                <span>
                    Initial Investment
                </span>

                <strong>
                    ${money(
                        prediction.initial
                    )}
                </strong>

            </div>

            <div class="analysis-highlight">

                <span>
                    Expected Value
                </span>

                <strong>
                    ${money(
                        finalRow.endingValue
                    )}
                </strong>

            </div>

            <div class="analysis-highlight">

                <span>
                    Time Horizon
                </span>

                <strong>
                    ${prediction.years}
                    years
                </strong>

            </div>

        </div>

        <div class="analysis-block">

            <h4>
                Projection Summary
            </h4>

            <p>
                Conservative:
                <strong>
                    ${money(
                        finalRow.conservativeValue
                    )}
                </strong>
            </p>

            <p>
                Expected:
                <strong>
                    ${money(
                        finalRow.endingValue
                    )}
                </strong>
            </p>

            <p>
                Optimistic:
                <strong>
                    ${money(
                        finalRow.optimisticValue
                    )}
                </strong>
            </p>

        </div>
    `;

    renderPredictionChart();

    renderPredictionTable();
}

/* ============================================================
   FIXED PREDICTION CHART
   ============================================================ */

function renderPredictionChart() {

    const container =
        $("predictionChart");

    if (
        !container ||
        !state.prediction ||
        !Array.isArray(
            state.prediction.rows
        )
    ) {
        return;
    }

    const rows =
        state.prediction.rows;

    if (!rows.length) {
        container.innerHTML = "";
        return;
    }

    const width = 900;
    const height = 400;

    const left = 70;
    const right = 30;
    const top = 45;
    const bottom = 55;

    const chartWidth =
        width -
        left -
        right;

    const chartHeight =
        height -
        top -
        bottom;

    const maximum =
        Math.max(
            ...rows.map(row =>
                Math.max(
                    Number(
                        row.conservativeValue
                    ) || 0,

                    Number(
                        row.endingValue
                    ) || 0,

                    Number(
                        row.optimisticValue
                    ) || 0
                )
            ),
            1
        );

    function getX(index) {

        if (rows.length === 1) {
            return left;
        }

        return (
            left +
            (
                index /
                (rows.length - 1)
            ) *
            chartWidth
        );
    }

    function getY(value) {

        return (
            top +
            chartHeight -
            (
                (
                    Number(value) || 0
                ) /
                maximum
            ) *
            chartHeight
        );
    }

    function createPath(
        valueGetter
    ) {

        return rows
            .map(
                (row, index) => {

                    const x =
                        getX(index);

                    const y =
                        getY(
                            valueGetter(
                                row
                            )
                        );

                    return `${
                        index === 0
                            ? "M"
                            : "L"
                    } ${x} ${y}`;
                }
            )
            .join(" ");
    }

    const conservativePath =
        createPath(
            row =>
                row.conservativeValue
        );

    const expectedPath =
        createPath(
            row =>
                row.endingValue
        );

    const optimisticPath =
        createPath(
            row =>
                row.optimisticValue
        );

    let svg = `

        <svg
            class="projection-svg"
            viewBox="
                0 0
                ${width}
                ${height}
            "
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Investment projection chart"
        >
    `;

    const gridCount = 5;

    for (
        let i = 0;
        i <= gridCount;
        i++
    ) {

        const y =
            top +
            (
                i /
                gridCount
            ) *
            chartHeight;

        const value =
            maximum -
            (
                i /
                gridCount
            ) *
            maximum;

        svg += `

            <line
                x1="${left}"
                y1="${y}"
                x2="${width - right}"
                y2="${y}"
                class="chart-grid-line"
            />

            <text
                x="${left - 12}"
                y="${y + 5}"
                text-anchor="end"
                class="chart-axis-label"
            >
                ${formatCompactMoney(
                    value
                )}
            </text>
        `;
    }

    rows.forEach(
        (row, index) => {

            if (
                index === 0 ||
                index ===
                    rows.length - 1 ||
                index %
                    Math.max(
                        1,
                        Math.ceil(
                            rows.length /
                            8
                        )
                    ) === 0
            ) {

                const x =
                    getX(index);

                svg += `

                    <text
                        x="${x}"
                        y="${height - 25}"
                        text-anchor="middle"
                        class="chart-axis-label"
                    >
                        Year ${row.year}
                    </text>
                `;
            }
        }
    );

    svg += `

        <path
            d="${conservativePath}"
            class="projection-line projection-conservative"
            fill="none"
        />

        <path
            d="${expectedPath}"
            class="projection-line projection-expected"
            fill="none"
        />

        <path
            d="${optimisticPath}"
            class="projection-line projection-optimistic"
            fill="none"
        />
    `;

    const finalIndex =
        rows.length - 1;

    const finalX =
        getX(finalIndex);

    svg += `

        <circle
            cx="${finalX}"
            cy="${getY(
                rows[
                    finalIndex
                ].conservativeValue
            )}"
            r="5"
            class="chart-point projection-conservative"
        />

        <circle
            cx="${finalX}"
            cy="${getY(
                rows[
                    finalIndex
                ].endingValue
            )}"
            r="6"
            class="chart-point projection-expected"
        />

        <circle
            cx="${finalX}"
            cy="${getY(
                rows[
                    finalIndex
                ].optimisticValue
            )}"
            r="5"
            class="chart-point projection-optimistic"
        />

        <text
            x="${left}"
            y="${top - 12}"
            class="chart-title-svg"
        >
            Estimated Portfolio Value
        </text>
    `;

    svg += `

        <g class="chart-legend">

            <rect
                x="${width - 300}"
                y="14"
                width="14"
                height="4"
                rx="2"
                class="projection-conservative"
                stroke="none"
            />

            <text
                x="${width - 280}"
                y="25"
                class="chart-legend-text"
            >
                Conservative
            </text>

            <rect
                x="${width - 195}"
                y="14"
                width="14"
                height="4"
                rx="2"
                class="projection-expected"
                stroke="none"
            />

            <text
                x="${width - 175}"
                y="25"
                class="chart-legend-text"
            >
                Expected
            </text>

            <rect
                x="${width - 100}"
                y="14"
                width="14"
                height="4"
                rx="2"
                class="projection-optimistic"
                stroke="none"
            />

            <text
                x="${width - 80}"
                y="25"
                class="chart-legend-text"
            >
                Optimistic
            </text>

        </g>
    `;

    svg += `
        </svg>
    `;

    container.innerHTML =
        svg;
}

/* ============================================================
   PREDICTION TABLE
   ============================================================ */

function renderPredictionTable() {

    const container =
        $("predictionTable");

    if (
        !container ||
        !state.prediction
    ) {
        return;
    }

    const rows =
        state.prediction.rows;

    let html = `

        <div class="table-wrapper">

            <table class="data-table">

                <thead>

                    <tr>

                        <th>
                            Year
                        </th>

                        <th>
                            Contribution
                        </th>

                        <th>
                            Conservative
                        </th>

                        <th>
                            Expected
                        </th>

                        <th>
                            Optimistic
                        </th>

                    </tr>

                </thead>

                <tbody>
    `;

    rows.forEach(row => {

        html += `

            <tr>

                <td>
                    ${row.year}
                </td>

                <td>
                    ${money(
                        row.contribution
                    )}
                </td>

                <td>
                    ${money(
                        row.conservativeValue
                    )}
                </td>

                <td>
                    ${money(
                        row.endingValue
                    )}
                </td>

                <td>
                    ${money(
                        row.optimisticValue
                    )}
                </td>

            </tr>
        `;
    });

    html += `

                </tbody>

            </table>

        </div>
    `;

    container.innerHTML =
        html;
}

/* ============================================================
   PORTFOLIO CONNECTIONS
   ============================================================ */

function connectPortfolioToRisk() {

    const portfolio =
        state.portfolio;

    if (!portfolio) return;

    const description =
        $("portfolioDescription");

    const risk =
        $("investorRisk");

    const horizon =
        $("riskTimeHorizon");

    if (description) {

        description.value =
            `${capitalize(
                portfolio.risk
            )} risk portfolio with a ` +
            `${money(
                portfolio.budget
            )} investment budget.`;
    }

    if (risk) {
        risk.value =
            portfolio.risk;
    }

    if (horizon) {
        horizon.value =
            portfolio.horizon;
    }
}

function connectPortfolioToPrediction() {

    const portfolio =
        state.portfolio;

    if (!portfolio) return;

    const initial =
        $("predictionInitial");

    const risk =
        $("predictionRisk");

    const years =
        $("predictionYears");

    if (initial) {
        initial.value =
            portfolio.budget;
    }

    if (risk) {
        risk.value =
            portfolio.risk;
    }

    if (years) {
        years.value =
            portfolio.horizon;
    }
}

/* ============================================================
   DASHBOARD STATISTICS
   ============================================================ */

function updateDashboardStats() {

    const portfolio =
        state.portfolio;

    const risk =
        state.risk;

    const prediction =
        state.prediction;

    const totalInvestment =
        $("totalInvestment");

    const riskLevel =
        $("dashboardRisk");

    const projectedValue =
        $("projectedValue");

    const analysesCompleted =
        $("analysesCompleted");

    if (totalInvestment) {

        totalInvestment.textContent =
            portfolio
                ? money(
                    portfolio.budget
                )
                : "$0.00";
    }

    if (riskLevel) {

        riskLevel.textContent =
            risk
                ? risk.rating
                : "Not evaluated";
    }

    if (projectedValue) {

        if (
            prediction &&
            prediction.rows &&
            prediction.rows.length
        ) {

            const finalRow =
                prediction.rows[
                    prediction.rows.length - 1
                ];

            projectedValue.textContent =
                money(
                    finalRow.endingValue
                );

        } else {

            projectedValue.textContent =
                "$0.00";
        }
    }

    if (analysesCompleted) {

        let count = 0;

        if (state.portfolio) count++;

        if (state.risk) count++;

        if (state.screener) count++;

        if (state.prediction) count++;

        analysesCompleted.textContent =
            count;
    }
}

/* ============================================================
   ANALYTICS CHAT
   ============================================================ */

function addChatMessage(
    role,
    content,
    save = true
) {

    const messages =
        $("chatMessages");

    if (!messages) return;

    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.className =
        `chat-message ${role}`;

    const bubble =
        document.createElement(
            "div"
        );

    bubble.className =
        "chat-bubble";

    bubble.textContent =
        content;

    wrapper.appendChild(
        bubble
    );

    messages.appendChild(
        wrapper
    );

    messages.scrollTop =
        messages.scrollHeight;

    if (save) {

        state.chat.push({

            role,

            content,

            timestamp:
                new Date()
                    .toISOString()
        });

        saveState();
    }
}

/* ============================================================
   TYPING INDICATOR
   ============================================================ */

function showTypingIndicator() {

    const messages =
        $("chatMessages");

    if (!messages) return;

    if ($("typingIndicator")) {
        return;
    }

    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.id =
        "typingIndicator";

    wrapper.className =
        "chat-message assistant";

    wrapper.innerHTML = `

        <div class="chat-bubble typing">

            <span></span>
            <span></span>
            <span></span>

        </div>
    `;

    messages.appendChild(
        wrapper
    );

    messages.scrollTop =
        messages.scrollHeight;
}

function hideTypingIndicator() {

    const indicator =
        $("typingIndicator");

    if (indicator) {
        indicator.remove();
    }
}

/* ============================================================
   OLLAMA CHAT CONNECTION
   ============================================================ */

/*
   IMPORTANT:

   This function sends the question to YOUR Node.js server.

   It does NOT call Ollama directly.

   Your Node.js server must provide:

       POST http://localhost:4000/api/chat

   Example request:

       {
           "message": "What is artificial intelligence?"
       }

   Expected response:

       {
           "answer": "Artificial intelligence..."
       }

   The backend then sends the request to Ollama.
*/

async function askQuestion(
    question
) {

    try {

        const response =
            await fetch(
                `${API_URL}/api/chat`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            message:
                                question
                        })
                }
            );

        let data;

        try {

            data =
                await response.json();

        } catch (error) {

            throw new Error(
                "The server returned an invalid response."
            );
        }

        if (!response.ok) {

            throw new Error(
                data.error ||
                data.message ||
                "Unable to get an answer."
            );
        }

        if (
            !data ||
            !data.answer
        ) {

            throw new Error(
                "The server did not return an answer."
            );
        }

        return String(
            data.answer
        );

    } catch (error) {

        console.error(
            "Chat request failed:",
            error
        );

        /*
           This message is only displayed when the backend
           cannot be reached.

           It does NOT restrict what questions can be asked.
        */

        return (
            "I couldn't connect to the AI server. " +
            "Please make sure the analytics server is running."
        );
    }
}

/* ============================================================
   CHAT FORM
   ============================================================ */

async function handleChat(
    event
) {

    if (event) {
        event.preventDefault();
    }

    const input =
        $("chatInput");

    if (!input) return;

    const question =
        input.value.trim();

    if (!question) {
        return;
    }

    addChatMessage(
        "user",
        question
    );

    input.value = "";

    showTypingIndicator();

    try {

        const answer =
            await askQuestion(
                question
            );

        hideTypingIndicator();

        addChatMessage(
            "assistant",
            answer
        );

    } catch (error) {

        hideTypingIndicator();

        console.error(
            "Chat handling error:",
            error
        );

        addChatMessage(
            "assistant",
            "Something went wrong while processing your question."
        );
    }
}

function clearChat() {

    state.chat = [];

    saveState();

    const messages =
        $("chatMessages");

    if (!messages) return;

    messages.innerHTML = "";

    addChatMessage(
        "assistant",
        "Hello! Ask me anything — investments, technology, programming, education, general knowledge, or other topics."
    );
}

function restoreChat() {

    const messages =
        $("chatMessages");

    if (!messages) return;

    messages.innerHTML = "";

    if (
        !Array.isArray(
            state.chat
        ) ||
        !state.chat.length
    ) {

        addChatMessage(
            "assistant",
            "Hello! Ask me anything — investments, technology, programming, education, general knowledge, or other topics.",
            false
        );

        return;
    }

    state.chat.forEach(
        message => {

            if (
                message &&
                (
                    message.role ===
                        "user" ||
                    message.role ===
                        "assistant"
                )
            ) {

                addChatMessage(
                    message.role,
                    message.content,
                    false
                );
            }
        }
    );
}
/* ============================================================
   FUTURE PROJECTION
   ============================================================ */

function calculateProjection(
    initial,
    monthlyContribution,
    years,
    risk
) {

    const rows = [];

    let conservativeValue =
        initial;

    let expectedValue =
        initial;

    let optimisticValue =
        initial;


    let conservativeRate =
        0.04;

    let expectedRate =
        0.07;

    let optimisticRate =
        0.10;


    if (
        risk ===
        "conservative"
    ) {

        conservativeRate =
            0.025;

        expectedRate =
            0.05;

        optimisticRate =
            0.075;

    }


    if (
        risk ===
        "aggressive"
    ) {

        conservativeRate =
            0.035;

        expectedRate =
            0.09;

        optimisticRate =
            0.14;

    }


    for (
        let year = 1;
        year <= years;
        year++
    ) {

        for (
            let month = 0;
            month < 12;
            month++
        ) {

            conservativeValue =
                conservativeValue *
                (
                    1 +
                    conservativeRate /
                    12
                ) +
                monthlyContribution;


            expectedValue =
                expectedValue *
                (
                    1 +
                    expectedRate /
                    12
                ) +
                monthlyContribution;


            optimisticValue =
                optimisticValue *
                (
                    1 +
                    optimisticRate /
                    12
                ) +
                monthlyContribution;

        }


        rows.push({

            year,

            contribution:
                monthlyContribution * 12,

            conservativeValue,

            endingValue:
                expectedValue,

            optimisticValue

        });

    }


    return rows;

}


/* ============================================================
   PREDICTION FORM
   ============================================================ */

function handlePrediction(
    event
) {

    event.preventDefault();


    const initial =
        Number(
            getValue(
                "predictionInitial"
            )
        );


    const monthlyContribution =
        Number(
            getValue(
                "predictionContribution"
            )
        ) || 0;


    const years =
        Number(
            getValue(
                "predictionYears"
            )
        );


    const risk =
        getValue(
            "predictionRisk"
        );


    if (

        initial <= 0 ||

        years <= 0 ||

        !risk

    ) {

        showToast(
            "Please complete the prediction fields.",
            "⚠️"
        );

        return;

    }


    const rows =
        calculateProjection(

            initial,

            monthlyContribution,

            years,

            risk

        );


    state.prediction = {

        initial,

        monthlyContribution,

        years,

        risk,

        rows,

        createdAt:
            new Date().toISOString()

    };


    saveState();


    renderPrediction();

    updateDashboardStats();

    updateReport();


    showToast(
        "Future projection completed.",
        "✓"
    );

}


/* ============================================================
   RENDER PREDICTION
   ============================================================ */

function renderPrediction() {

    if (!state.prediction) {
        return;
    }


    const result =
        $("predictionResult");


    const status =
        $("predictionStatus");


    if (status) {

        status.textContent =
            "Completed";

    }


    if (result) {

        result.classList.remove(
            "empty-result"
        );


        const rows =
            state.prediction.rows;


        const finalRow =
            rows[
                rows.length - 1
            ];


        result.innerHTML = `

            <div class="analysis-summary">

                <div class="analysis-highlight">

                    <span>
                        Initial Investment
                    </span>

                    <strong>
                        ${money(
                            state.prediction.initial
                        )}
                    </strong>

                </div>


                <div class="analysis-highlight">

                    <span>
                        Expected Value
                    </span>

                    <strong>
                        ${money(
                            finalRow.endingValue
                        )}
                    </strong>

                </div>


                <div class="analysis-highlight">

                    <span>
                        Projection Period
                    </span>

                    <strong>
                        ${state.prediction.years}
                        years
                    </strong>

                </div>

            </div>


            <div class="analysis-block">

                <h4>
                    Projection Summary
                </h4>

                <p>
                    The projection is an illustrative
                    mathematical estimate based on assumed
                    annual returns. Actual investment returns
                    can be significantly different.
                </p>

            </div>

        `;

    }


    renderPredictionChart();

    renderPredictionTable();

}


/* ============================================================
   PREDICTION CHART
   ============================================================ */

function renderPredictionChart() {

    const container =
        $("predictionChart");


    if (
        !container ||
        !state.prediction ||
        !state.prediction.rows ||
        !state.prediction.rows.length
    ) {

        return;

    }


    const rows =
        state.prediction.rows;


    const width = 900;

    const height = 430;

    const left = 70;

    const right = 30;

    const top = 50;

    const bottom = 55;


    const chartWidth =
        width -
        left -
        right;


    const chartHeight =
        height -
        top -
        bottom;


    const maximum =
        Math.max(
            ...rows.flatMap(
                row => [

                    row.conservativeValue,

                    row.endingValue,

                    row.optimisticValue

                ]
            )
        );


    function getX(index) {

        if (
            rows.length === 1
        ) {

            return left;

        }


        return (

            left +

            (
                index /
                (rows.length - 1)
            ) *
            chartWidth

        );

    }


    function getY(value) {

        if (
            maximum === 0
        ) {

            return (
                top +
                chartHeight
            );

        }


        return (

            top +

            chartHeight -

            (
                value /
                maximum
            ) *
            chartHeight

        );

    }


    function createPath(
        valueGetter
    ) {

        return rows
            .map(
                (
                    row,
                    index
                ) => {

                    const x =
                        getX(index);


                    const y =
                        getY(
                            valueGetter(
                                row
                            )
                        );


                    return `${
                        index === 0
                            ? "M"
                            : "L"
                    } ${x} ${y}`;

                }
            )
            .join(" ");

    }


    const conservativePath =
        createPath(
            row =>
                row.conservativeValue
        );


    const expectedPath =
        createPath(
            row =>
                row.endingValue
        );


    const optimisticPath =
        createPath(
            row =>
                row.optimisticValue
        );


    let svg = `

        <svg
            class="projection-svg"
            viewBox="0 0 ${width} ${height}"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Investment projection chart"
        >

    `;


    const gridCount = 5;


    for (
        let i = 0;
        i <= gridCount;
        i++
    ) {

        const y =

            top +

            (
                i /
                gridCount
            ) *
            chartHeight;


        const value =

            maximum -

            (
                i /
                gridCount
            ) *
            maximum;


        svg += `

            <line
                x1="${left}"
                y1="${y}"
                x2="${width - right}"
                y2="${y}"
                class="chart-grid-line"
            />


            <text
                x="${left - 12}"
                y="${y + 5}"
                text-anchor="end"
                class="chart-axis-label"
            >
                ${formatCompactMoney(
                    value
                )}
            </text>

        `;

    }


    rows.forEach(
        (
            row,
            index
        ) => {

            if (

                index === 0 ||

                index ===
                    rows.length - 1 ||

                index %
                    Math.ceil(
                        rows.length / 8
                    ) === 0

            ) {

                const x =
                    getX(index);


                svg += `

                    <text
                        x="${x}"
                        y="${height - 25}"
                        text-anchor="middle"
                        class="chart-axis-label"
                    >
                        Year ${row.year}
                    </text>

                `;

            }

        }
    );


    svg += `

        <path
            d="${conservativePath}"
            class="projection-line projection-conservative"
            fill="none"
        />


        <path
            d="${expectedPath}"
            class="projection-line projection-expected"
            fill="none"
        />


        <path
            d="${optimisticPath}"
            class="projection-line projection-optimistic"
            fill="none"
        />

    `;


    const finalIndex =
        rows.length - 1;


    const finalX =
        getX(finalIndex);


    svg += `

        <circle
            cx="${finalX}"
            cy="${getY(
                rows[finalIndex]
                    .conservativeValue
            )}"
            r="5"
            class="chart-point projection-conservative"
        />


        <circle
            cx="${finalX}"
            cy="${getY(
                rows[finalIndex]
                    .endingValue
            )}"
            r="6"
            class="chart-point projection-expected"
        />


        <circle
            cx="${finalX}"
            cy="${getY(
                rows[finalIndex]
                    .optimisticValue
            )}"
            r="5"
            class="chart-point projection-optimistic"
        />


        <text
            x="${left}"
            y="${top - 12}"
            class="chart-title-svg"
        >
            Estimated Portfolio Value
        </text>

    `;


    svg += `

        <g class="chart-legend">

            <text
                x="${width - 280}"
                y="25"
                class="chart-legend-text"
            >
                Conservative
            </text>


            <text
                x="${width - 175}"
                y="25"
                class="chart-legend-text"
            >
                Expected
            </text>


            <text
                x="${width - 80}"
                y="25"
                class="chart-legend-text"
            >
                Optimistic
            </text>

        </g>

    `;


    svg += `
        </svg>
    `;


    container.innerHTML =
        svg;

}


/* ============================================================
   PREDICTION TABLE
   ============================================================ */

function renderPredictionTable() {

    const container =
        $("predictionTable");


    if (

        !container ||

        !state.prediction

    ) {

        return;

    }


    const rows =
        state.prediction.rows;


    let html = `

        <div class="table-wrapper">

            <table class="data-table">

                <thead>

                    <tr>

                        <th>
                            Year
                        </th>

                        <th>
                            Contribution
                        </th>

                        <th>
                            Conservative
                        </th>

                        <th>
                            Expected
                        </th>

                        <th>
                            Optimistic
                        </th>

                    </tr>

                </thead>


                <tbody>

    `;


    rows.forEach(
        row => {

            html += `

                <tr>

                    <td>
                        ${row.year}
                    </td>


                    <td>
                        ${money(
                            row.contribution
                        )}
                    </td>


                    <td>
                        ${money(
                            row.conservativeValue
                        )}
                    </td>


                    <td>
                        ${money(
                            row.endingValue
                        )}
                    </td>


                    <td>
                        ${money(
                            row.optimisticValue
                        )}
                    </td>

                </tr>

            `;

        }
    );


    html += `

                </tbody>

            </table>

        </div>

    `;


    container.innerHTML =
        html;

}


/* ============================================================
   PORTFOLIO -> RISK
   ============================================================ */

function connectPortfolioToRisk() {

    const portfolio =
        state.portfolio;


    if (!portfolio) {
        return;
    }


    const description =
        $("portfolioDescription");


    const risk =
        $("investorRisk");


    const horizon =
        $("riskTimeHorizon");


    if (description) {

        description.value =

            `${capitalize(
                portfolio.risk
            )} risk portfolio with a ` +

            `${money(
                portfolio.budget
            )} investment budget.`;

    }


    if (risk) {

        risk.value =
            portfolio.risk;

    }


    if (horizon) {

        horizon.value =
            portfolio.horizon;

    }

}


/* ============================================================
   PORTFOLIO -> PREDICTION
   ============================================================ */

function connectPortfolioToPrediction() {

    const portfolio =
        state.portfolio;


    if (!portfolio) {
        return;
    }


    const initial =
        $("predictionInitial");


    const risk =
        $("predictionRisk");


    const years =
        $("predictionYears");


    if (initial) {

        initial.value =
            portfolio.budget;

    }


    if (risk) {

        risk.value =
            portfolio.risk;

    }


    if (years) {

        years.value =
            portfolio.horizon;

    }

}


/* ============================================================
   DASHBOARD STATISTICS
   ============================================================ */

function updateDashboardStats() {

    const portfolio =
        state.portfolio;


    const risk =
        state.risk;


    const prediction =
        state.prediction;


    const totalInvestment =
        $("totalInvestment");


    const riskLevel =
        $("dashboardRisk");


    const projectedValue =
        $("projectedValue");


    const analysesCompleted =
        $("analysesCompleted");


    if (totalInvestment) {

        totalInvestment.textContent =

            portfolio
                ? money(
                    portfolio.budget
                )
                : "$0.00";

    }


    if (riskLevel) {

        riskLevel.textContent =

            risk
                ? risk.rating
                : "Not evaluated";

    }


    if (projectedValue) {

        if (

            prediction &&

            prediction.rows &&

            prediction.rows.length

        ) {

            const finalRow =

                prediction.rows[
                    prediction.rows.length - 1
                ];


            projectedValue.textContent =
                money(
                    finalRow.endingValue
                );

        } else {

            projectedValue.textContent =
                "$0.00";

        }

    }


    if (analysesCompleted) {

        let count = 0;


        if (state.portfolio) {
            count++;
        }


        if (state.risk) {
            count++;
        }


        if (state.screener) {
            count++;
        }


        if (state.prediction) {
            count++;
        }


        analysesCompleted.textContent =
            count;

    }

}


/* ============================================================
   OLLAMA CHAT
   ============================================================ */

/*
   IMPORTANT:

   The browser does NOT call Ollama directly.

   It calls:

       POST http://localhost:4000/api/chat

   Your Node/Express server should then call:

       Ollama
       model: llama3.2

   This allows the chat to accept GENERAL QUESTIONS.

   Examples:

       What is portfolio risk?

       What is artificial intelligence?

       Explain JavaScript.

       What is a database?

       Explain blockchain.

       What is photosynthesis?

       Tell me about Python.

       What is machine learning?

       Explain cloud computing.

       Who was Albert Einstein?

       What is the capital of France?

       etc.
*/


async function askQuestion(
    question
) {

    const cleanQuestion =
        String(
            question || ""
        ).trim();


    if (!cleanQuestion) {

        throw new Error(
            "Question cannot be empty."
        );

    }


    try {

        const response =
            await fetch(

                CHAT_API_URL,

                {

                    method:
                        "POST",


                    headers: {

                        "Content-Type":
                            "application/json"

                    },


                    body:
                        JSON.stringify({

                            message:
                                cleanQuestion

                        })

                }

            );


        let data;


        try {

            data =
                await response.json();

        } catch (jsonError) {

            throw new Error(
                "The chat server returned an invalid response."
            );

        }


        if (!response.ok) {

            throw new Error(

                data.error ||

                data.message ||

                `Chat server error: ${response.status}`

            );

        }


        const answer =

            data.answer ||

            data.response ||

            data.message;


        if (!answer) {

            throw new Error(
                "The AI server did not return an answer."
            );

        }


        return String(
            answer
        );


    } catch (error) {

        console.error(
            "Ollama chat connection error:",
            error
        );


        if (
            error instanceof
            TypeError
        ) {

            return (
                "I cannot connect to the chat server. " +
                "Please make sure the analytics server " +
                "is running and that Ollama is available."
            );

        }


        return (

            "I could not get an answer from the local AI. " +

            error.message

        );

    }

}


/* ============================================================
   ADD CHAT MESSAGE
   ============================================================ */

function addChatMessage(

    role,

    content,

    save = true

) {

    const messages =
        $("chatMessages");


    if (!messages) {
        return;
    }


    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        `chat-message ${role}`;


    const bubble =
        document.createElement(
            "div"
        );


    bubble.className =
        "chat-bubble";


    bubble.textContent =
        content;


    wrapper.appendChild(
        bubble
    );


    messages.appendChild(
        wrapper
    );


    messages.scrollTop =
        messages.scrollHeight;


    if (save) {

        state.chat.push({

            role,

            content,

            timestamp:
                new Date().toISOString()

        });


        saveState();

    }

}


/* ============================================================
   TYPING INDICATOR
   ============================================================ */

function showTypingIndicator() {

    const messages =
        $("chatMessages");


    if (!messages) {
        return;
    }


    if (
        $("typingIndicator")
    ) {

        return;

    }


    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.id =
        "typingIndicator";


    wrapper.className =
        "chat-message assistant";


    wrapper.innerHTML = `

        <div class="chat-bubble typing">

            <span></span>

            <span></span>

            <span></span>

        </div>

    `;


    messages.appendChild(
        wrapper
    );


    messages.scrollTop =
        messages.scrollHeight;

}


function hideTypingIndicator() {

    const indicator =
        $("typingIndicator");


    if (indicator) {

        indicator.remove();

    }

}


/* ============================================================
   HANDLE CHAT
   ============================================================ */

async function handleChat(
    event
) {

    if (event) {

        event.preventDefault();

    }


    const input =
        $("chatInput");


    if (!input) {
        return;
    }


    const question =
        input.value.trim();


    if (!question) {

        return;

    }


    addChatMessage(

        "user",

        question

    );


    input.value =
        "";


    input.disabled =
        true;


    const sendButton =
        $("chatSend");


    if (sendButton) {

        sendButton.disabled =
            true;

    }


    showTypingIndicator();


    try {

        const answer =
            await askQuestion(
                question
            );


        hideTypingIndicator();


        addChatMessage(

            "assistant",

            answer

        );


    } catch (error) {

        hideTypingIndicator();


        addChatMessage(

            "assistant",

            "Sorry, I could not get an answer. " +
            error.message

        );

    } finally {

        input.disabled =
            false;


        if (sendButton) {

            sendButton.disabled =
                false;

        }


        input.focus();

    }

}


/* ============================================================
   CLEAR CHAT
   ============================================================ */

function clearChat() {

    state.chat = [];

    saveState();


    const messages =
        $("chatMessages");


    if (!messages) {
        return;
    }


    messages.innerHTML =
        "";


    addChatMessage(

        "assistant",

        "Hello! Ask me anything. I can answer questions about investments, technology, programming, education, science, general knowledge, and other topics."

    );

}


/* ============================================================
   RESTORE CHAT
   ============================================================ */

function restoreChat() {

    const messages =
        $("chatMessages");


    if (!messages) {
        return;
    }


    messages.innerHTML =
        "";


    if (

        !Array.isArray(
            state.chat
        ) ||

        !state.chat.length

    ) {

        addChatMessage(

            "assistant",

            "Hello! Ask me anything. I can answer questions about investments, technology, programming, education, science, general knowledge, and other topics.",

            false

        );


        return;

    }


    state.chat.forEach(
        message => {

            if (

                message &&

                (

                    message.role ===
                    "user" ||

                    message.role ===
                    "assistant"

                )

            ) {

                addChatMessage(

                    message.role,

                    message.content,

                    false

                );

            }

        }
    );

}


/* ============================================================
   CHAT CONNECTION TEST
   ============================================================ */

async function testChatConnection() {

    try {

        const response =
            await fetch(

                CHAT_API_URL,

                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            message:
                                "Hello"

                        })

                }

            );


        if (!response.ok) {

            return false;

        }


        const data =
            await response.json();


        return Boolean(

            data.answer ||

            data.response ||

            data.message

        );


    } catch (error) {

        console.error(
            "Chat connection test failed:",
            error
        );

        return false;

    }

}


/* ============================================================
   INITIALIZE CHAT
   ============================================================ */

function initChat() {

    const form =
        $("chatForm");


    if (form) {

        form.addEventListener(

            "submit",

            handleChat

        );

    }


    const sendButton =
        $("chatSend");


    if (

        sendButton &&

        !form

    ) {

        sendButton.addEventListener(

            "click",

            handleChat

        );

    }


    const clearButton =
        $("clearChat");


    if (clearButton) {

        clearButton.addEventListener(

            "click",

            clearChat

        );

    }


    const input =
        $("chatInput");


    if (input) {

        input.addEventListener(

            "keydown",

            event => {

                if (

                    event.key ===
                    "Enter" &&

                    !event.shiftKey

                ) {

                    event.preventDefault();


                    handleChat(
                        event
                    );

                }

            }

        );

    }


    restoreChat();

}
/* ============================================================
   MARKET SCREENER
   ============================================================ */

const screenerCategories = [
    {
        name: "Large Cap Stocks",
        aliases: ["us equities", "equities", "stocks", "large cap stocks"],
        description:
            "Established companies with relatively large market capitalizations.",
        risk: "moderate"
    },
    {
        name: "Technology",
        aliases: ["technology", "tech", "us equities"],
        description:
            "Technology-oriented companies and technology-related investments.",
        risk: "high"
    },
    {
        name: "Healthcare",
        aliases: ["healthcare", "health care"],
        description:
            "Companies operating in healthcare, pharmaceuticals, and medical services.",
        risk: "moderate"
    },
    {
        name: "Consumer Goods",
        aliases: ["consumer goods", "consumer", "us equities"],
        description:
            "Companies providing consumer products and everyday goods.",
        risk: "moderate"
    },
    {
        name: "Government Bonds",
        aliases: ["bonds", "government bonds", "fixed income"],
        description:
            "Debt securities issued by governments and government-related entities.",
        risk: "conservative"
    },
    {
        name: "International Markets",
        aliases: ["international equities", "emerging markets", "international markets"],
        description:
            "Investment opportunities outside the domestic market.",
        risk: "high"
    },
    {
        name: "Real Estate",
        aliases: ["reits", "real estate", "property"],
        description:
            "Real-estate-related investments and property markets.",
        risk: "moderate"
    },
    {
        name: "ETFs",
        aliases: ["etfs", "etf", "exchange traded funds"],
        description:
            "Diversified baskets of securities traded on exchanges, covering many markets.",
        risk: "moderate"
    },
    {
        name: "Commodities",
        aliases: ["commodities", "gold", "raw materials"],
        description:
            "Physical assets such as energy, metals and agricultural products.",
        risk: "high"
    },
    {
        name: "Crypto",
        aliases: ["crypto", "cryptocurrency", "digital assets"],
        description:
            "Highly volatile digital assets; suitable only for aggressive risk profiles.",
        risk: "high"
    },
    {
        name: "Cash Equivalents",
        aliases: ["cash equivalents", "cash", "money market"],
        description:
            "Highly liquid instruments intended for capital preservation.",
        risk: "conservative"
    }
];

async function handleScreener(event) {
    event.preventDefault();

    const risk =
        getValue("screenerRisk");

    const checkboxes =
        document.querySelectorAll(
            "#screenerForm input[type='checkbox']:checked"
        );

    const selected = Array.from(
        checkboxes
    ).map(
        checkbox =>
            checkbox.value ||
            checkbox.dataset.category ||
            checkbox.nextElementSibling?.textContent?.trim() ||
            ""
    ).filter(Boolean);

    if (!risk) {
        showToast(
            "Please select a risk level.",
            "⚠️"
        );

        return;
    }

    /* Backend first (same rule-based formulas); local
     * computation remains the fallback. */
    const serverResult = await requestServerAnalysis({
        type: "screener",
        risk,
        selected
    });

    state.screener = {
        selected,
        assetClasses: selected,
        risk,
        results:
            (serverResult &&
                Array.isArray(serverResult.results) &&
                serverResult.results.length)
                ? serverResult.results
                : getScreenerResults(selected, risk),
        createdAt:
            new Date().toISOString()
    };

    saveState();

    renderScreener();
    updateDashboardStats();
    updateReport();

    recordHistory(
        "screener",
        "Market screening — " +
            (selected.length
                ? selected.join(", ")
                : "all categories"),
        capitalize(risk) + " risk profile, " +
            getScreenerResults(selected, risk).length +
            " categories matched"
    );

    showToast(
        "Market screening completed.",
        "✓"
    );
}

function getScreenerResults(
    selected,
    risk
) {
    /*
     * Match the checkbox values from the form
     * (e.g. "US equities", "REITs", "bonds")
     * against the category names and aliases.
     */
    function matchesSelection(item, value) {
        const v = value.toLowerCase().trim();

        if (item.name.toLowerCase() === v) {
            return true;
        }

        return (item.aliases || []).some(
            alias =>
                alias === v ||
                v.includes(alias) ||
                alias.includes(v)
        );
    }

    let results;

    if (selected.length) {
        results = screenerCategories.filter(
            item =>
                selected.some(
                    value => matchesSelection(item, value)
                )
        );
    } else {
        /* No asset classes selected: fall back to
           categories compatible with the risk profile. */
        const compatible =
            risk === "aggressive"
                ? ["conservative", "moderate", "high"]
                : risk === "moderate"
                    ? ["conservative", "moderate"]
                    : ["conservative"];

        results = screenerCategories.filter(
            item => compatible.includes(item.risk)
        );
    }

    return results;
}

function renderScreener() {
    const container =
        $("screenerResult");

    const status =
        $("screenerStatus");

    if (!container) return;

    if (status) {
        status.textContent =
            "Completed";
    }

    if (!state.screener) {
        container.innerHTML = `
            <div class="empty-result">
                <h3>No screening results</h3>
                <p>
                    Select your preferences and run
                    the market screener.
                </p>
            </div>
        `;

        return;
    }

    container.classList.remove(
        "empty-result"
    );

    const results =
        state.screener.results || [];

    let html = `
        <div class="analysis-summary">

            <div class="analysis-highlight">
                <span>Risk Level</span>
                <strong>
                    ${capitalize(
                        state.screener.risk
                    )}
                </strong>
            </div>

            <div class="analysis-highlight">
                <span>Categories</span>
                <strong>
                    ${results.length}
                </strong>
            </div>

        </div>

        <div class="analysis-block">

            <h4>Screening Results</h4>

            <div class="screener-results">
    `;

    results.forEach(item => {
        html += `
            <div class="screener-card">

                <div class="screener-card-header">
                    <strong>
                        ${escapeHTML(
                            item.name
                        )}
                    </strong>

                    <span>
                        ${capitalize(
                            item.risk
                        )}
                    </span>
                </div>

                <p>
                    ${escapeHTML(
                        item.description
                    )}
                </p>

            </div>
        `;
    });

    html += `
            </div>

        </div>
    `;

    container.innerHTML =
        html;
}

/* ============================================================
   FUTURE PROJECTION
   ============================================================ */

function getAnnualReturnRates(risk) {
    if (risk === "conservative") {
        return {
            conservative: 0.04,
            expected: 0.06,
            optimistic: 0.08
        };
    }

    if (risk === "aggressive") {
        return {
            conservative: 0.05,
            expected: 0.09,
            optimistic: 0.13
        };
    }

    return {
        conservative: 0.045,
        expected: 0.075,
        optimistic: 0.105
    };
}

function calculateProjection(
    initial,
    years,
    risk,
    annualContribution = 0
) {
    const rates =
        getAnnualReturnRates(risk);

    const rows = [];

    let conservativeValue =
        initial;

    let expectedValue =
        initial;

    let optimisticValue =
        initial;

    for (
        let year = 1;
        year <= years;
        year++
    ) {
        conservativeValue =
            (
                conservativeValue +
                annualContribution
            ) *
            (1 + rates.conservative);

        expectedValue =
            (
                expectedValue +
                annualContribution
            ) *
            (1 + rates.expected);

        optimisticValue =
            (
                optimisticValue +
                annualContribution
            ) *
            (1 + rates.optimistic);

        rows.push({
            year,
            contribution:
                annualContribution,
            conservativeValue,
            endingValue:
                expectedValue,
            optimisticValue
        });
    }

    return rows;
}

async function handlePrediction(event) {
    event.preventDefault();

    const initial =
        Number(
            getValue("predictionInitial")
        );

    const risk =
        getValue("predictionRisk");

    const years =
        Number(
            getValue("predictionYears")
        );

    const contribution =
        Number(
            getValue(
                "predictionContribution"
            )
        ) || 0;

    if (
        initial <= 0 ||
        !risk ||
        years <= 0
    ) {
        showToast(
            "Please complete the required projection fields.",
            "⚠️"
        );

        return;
    }

    /* Backend first (same rule-based formulas); local
     * computation remains the fallback. */
    const serverResult = await requestServerAnalysis({
        type: "prediction",
        initial,
        risk,
        years,
        annualContribution: contribution
    });

    const rows =
        (serverResult && Array.isArray(serverResult.rows) &&
            serverResult.rows.length)
            ? serverResult.rows
            : calculateProjection(
                  initial,
                  years,
                  risk,
                  contribution
              );

    state.prediction = {
        initial,
        risk,
        years,
        annualContribution:
            contribution,
        rows,
        createdAt:
            new Date().toISOString()
    };

    saveState();

    renderPrediction();
    updateDashboardStats();
    updateReport();

    recordHistory(
        "prediction",
        "Future projection — " + money(initial),
        capitalize(risk) + " profile, " + years +
            " years, " + money(annualContribution) + " annual contribution"
    );

    showToast(
        "Future projection completed.",
        "✓"
    );
}

function renderPrediction() {
    /* The summary container in analytics-chatboy.html is
       #predictionSummary (there is no #predictionResult). */
    const container =
        $("predictionSummary");

    const status =
        $("predictionStatus");

    if (status) {
        status.textContent =
            state.prediction
                ? "Completed"
                : "Ready";
    }

    if (!container) return;

    if (!state.prediction) {
        container.innerHTML = `
            <div class="empty-result">
                <h3>No projection available</h3>
                <p>
                    Enter your investment details
                    to generate a projection.
                </p>
            </div>
        `;

        return;
    }

    const rows =
        state.prediction.rows;

    const finalRow =
        rows[rows.length - 1];

    container.classList.remove(
        "empty-result"
    );

    container.innerHTML = `
        <div class="analysis-summary">

            <div class="analysis-highlight">
                <span>Initial Investment</span>
                <strong>
                    ${money(
                        state.prediction.initial
                    )}
                </strong>
            </div>

            <div class="analysis-highlight">
                <span>Expected Value</span>
                <strong>
                    ${money(
                        finalRow.endingValue
                    )}
                </strong>
            </div>

            <div class="analysis-highlight">
                <span>Projection Period</span>
                <strong>
                    ${state.prediction.years}
                    years
                </strong>
            </div>

        </div>

        <div class="analysis-block">

            <h4>Projection Summary</h4>

            <p>
                Conservative:
                <strong>
                    ${money(
                        finalRow.conservativeValue
                    )}
                </strong>
            </p>

            <p>
                Expected:
                <strong>
                    ${money(
                        finalRow.endingValue
                    )}
                </strong>
            </p>

            <p>
                Optimistic:
                <strong>
                    ${money(
                        finalRow.optimisticValue
                    )}
                </strong>
            </p>

        </div>
    `;

    renderPredictionChart();
    renderPredictionTable();
}

/* ============================================================
   PREDICTION CHART
   ============================================================ */

function renderPredictionChart() {
    const container =
        $("predictionChart");

    if (
        !container ||
        !state.prediction ||
        !state.prediction.rows.length
    ) {
        return;
    }

    const rows =
        state.prediction.rows;

    const width = 900;
    const height = 420;

    const left = 75;
    const right = 25;
    const top = 45;
    const bottom = 55;

    const chartWidth =
        width - left - right;

    const chartHeight =
        height - top - bottom;

    const values = [];

    rows.forEach(row => {
        values.push(
            row.conservativeValue,
            row.endingValue,
            row.optimisticValue
        );
    });

    const maximum =
        Math.max(...values, 1);

    function getX(index) {
        if (rows.length === 1) {
            return left;
        }

        return (
            left +
            (index /
                (rows.length - 1)) *
                chartWidth
        );
    }

    function getY(value) {
        return (
            top +
            chartHeight -
            (value / maximum) *
                chartHeight
        );
    }

    function createPath(
        valueGetter
    ) {
        return rows
            .map(
                (row, index) => {
                    const x =
                        getX(index);

                    const y =
                        getY(
                            valueGetter(
                                row
                            )
                        );

                    return `${
                        index === 0
                            ? "M"
                            : "L"
                    } ${x} ${y}`;
                }
            )
            .join(" ");
    }

    const conservativePath =
        createPath(
            row =>
                row.conservativeValue
        );

    const expectedPath =
        createPath(
            row =>
                row.endingValue
        );

    const optimisticPath =
        createPath(
            row =>
                row.optimisticValue
        );

    let svg = `
        <svg
            class="projection-svg"
            viewBox="
                0 0
                ${width}
                ${height}
            "
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Investment projection chart"
        >
    `;

    const gridCount = 5;

    for (
        let i = 0;
        i <= gridCount;
        i++
    ) {
        const y =
            top +
            (i / gridCount) *
                chartHeight;

        const value =
            maximum -
            (i / gridCount) *
                maximum;

        svg += `
            <line
                x1="${left}"
                y1="${y}"
                x2="${width - right}"
                y2="${y}"
                class="chart-grid-line"
            />

            <text
                x="${left - 12}"
                y="${y + 5}"
                text-anchor="end"
                class="chart-axis-label"
            >
                ${formatCompactMoney(
                    value
                )}
            </text>
        `;
    }

    rows.forEach(
        (row, index) => {
            const interval =
                Math.max(
                    1,
                    Math.ceil(
                        rows.length / 8
                    )
                );

            if (
                index === 0 ||
                index ===
                    rows.length - 1 ||
                index % interval === 0
            ) {
                const x =
                    getX(index);

                svg += `
                    <text
                        x="${x}"
                        y="${height - 25}"
                        text-anchor="middle"
                        class="chart-axis-label"
                    >
                        Year ${row.year}
                    </text>
                `;
            }
        }
    );

    svg += `
        <path
            d="${conservativePath}"
            class="projection-line projection-conservative"
            fill="none"
        />

        <path
            d="${expectedPath}"
            class="projection-line projection-expected"
            fill="none"
        />

        <path
            d="${optimisticPath}"
            class="projection-line projection-optimistic"
            fill="none"
        />
    `;

    const finalIndex =
        rows.length - 1;

    const finalX =
        getX(finalIndex);

    svg += `
        <circle
            cx="${finalX}"
            cy="${getY(
                rows[finalIndex]
                    .conservativeValue
            )}"
            r="5"
            class="chart-point projection-conservative"
        />

        <circle
            cx="${finalX}"
            cy="${getY(
                rows[finalIndex]
                    .endingValue
            )}"
            r="6"
            class="chart-point projection-expected"
        />

        <circle
            cx="${finalX}"
            cy="${getY(
                rows[finalIndex]
                    .optimisticValue
            )}"
            r="5"
            class="chart-point projection-optimistic"
        />

        <text
            x="${left}"
            y="${top - 12}"
            class="chart-title-svg"
        >
            Estimated Portfolio Value
        </text>

        <g class="chart-legend">

            <rect
                x="${width - 300}"
                y="14"
                width="14"
                height="4"
                rx="2"
                class="projection-conservative"
                stroke="none"
            />

            <text
                x="${width - 280}"
                y="25"
                class="chart-legend-text"
            >
                Conservative
            </text>

            <rect
                x="${width - 195}"
                y="14"
                width="14"
                height="4"
                rx="2"
                class="projection-expected"
                stroke="none"
            />

            <text
                x="${width - 175}"
                y="25"
                class="chart-legend-text"
            >
                Expected
            </text>

            <rect
                x="${width - 100}"
                y="14"
                width="14"
                height="4"
                rx="2"
                class="projection-optimistic"
                stroke="none"
            />

            <text
                x="${width - 80}"
                y="25"
                class="chart-legend-text"
            >
                Optimistic
            </text>

        </g>
    `;

    svg += `</svg>`;

    container.innerHTML =
        svg;
}

function renderPredictionTable() {
    /* Fill the existing #predictionTableBody tbody
       instead of nesting a table inside #predictionTable. */
    const container =
        $("predictionTableBody");

    if (
        !container ||
        !state.prediction
    ) {
        return;
    }

    const rows =
        state.prediction.rows;

    let html = "";

    rows.forEach(row => {
        html += `
            <tr>

                <td>
                    ${row.year}
                </td>

                <td>
                    ${money(
                        row.contribution
                    )}
                </td>

                <td>
                    ${money(
                        row.conservativeValue
                    )}
                </td>

                <td>
                    ${money(
                        row.endingValue
                    )}
                </td>

                <td>
                    ${money(
                        row.optimisticValue
                    )}
                </td>

            </tr>
        `;
    });

    html += "";

    container.innerHTML =
        html;
}

/* ============================================================
   PORTFOLIO CONNECTIONS
   ============================================================ */

function connectPortfolioToRisk() {
    const portfolio =
        state.portfolio;

    if (!portfolio) return;

    const description =
        $("portfolioDescription");

    const risk =
        $("investorRisk");

    const horizon =
        $("riskTimeHorizon");

    if (description) {
        description.value =
            `${capitalize(
                portfolio.risk
            )} risk portfolio with a ` +
            `${money(
                portfolio.budget
            )} investment budget.`;
    }

    if (risk) {
        risk.value =
            portfolio.risk;
    }

    if (horizon) {
        horizon.value =
            portfolio.horizon;
    }
}

function connectPortfolioToPrediction() {
    const portfolio =
        state.portfolio;

    if (!portfolio) return;

    const initial =
        $("predictionInitial");

    const risk =
        $("predictionRisk");

    const years =
        $("predictionYears");

    if (initial) {
        initial.value =
            portfolio.budget;
    }

    if (risk) {
        risk.value =
            portfolio.risk;
    }

    if (years) {
        years.value =
            portfolio.horizon;
    }
}

/* ============================================================
   RENDER ALL CHARTS
   ============================================================ */

function renderAllCharts() {
    renderPortfolioChart();
    renderRiskChart();
    renderPredictionChart();
}

/* ============================================================
   RESTORE SAVED DATA
   ============================================================ */

function restoreSavedForms() {
    if (state.portfolio) {
        const portfolio =
            state.portfolio;

        setValue(
            "budget",
            portfolio.budget
        );

        setValue(
            "portfolioRisk",
            portfolio.risk
        );

        setValue(
            "timeHorizon",
            portfolio.horizon
        );

        setValue(
            "investmentGoal",
            portfolio.goal
        );

        setValue(
            "existingHoldings",
            portfolio.holdings
        );

        setValue(
            "excludedSectors",
            portfolio.excluded
        );
    }

    if (state.risk) {
        const risk =
            state.risk;

        setValue(
            "portfolioDescription",
            risk.description
        );

        setValue(
            "investorRisk",
            risk.investorRisk
        );

        setValue(
            "riskTimeHorizon",
            risk.horizon
        );

        setValue(
            "marketContext",
            risk.marketContext
        );
    }

    if (state.prediction) {
        const prediction =
            state.prediction;

        setValue(
            "predictionInitial",
            prediction.initial
        );

        setValue(
            "predictionRisk",
            prediction.risk
        );

        setValue(
            "predictionYears",
            prediction.years
        );

        setValue(
            "predictionContribution",
            prediction.annualContribution
        );
    }
}

/* ============================================================
   ANALYSIS HISTORY
   Every completed analysis is recorded so previous runs stay
   visible in the History section. The app always opens fresh
   on the Dashboard.
   ============================================================ */

function recordHistory(type, summary, detail) {
    if (!Array.isArray(state.history)) {
        state.history = [];
    }

    state.history.unshift({
        type,
        summary,
        detail: detail || "",
        createdAt:
            new Date().toISOString()
    });

    /* Keep only the 20 most recent runs. */
    if (state.history.length > 20) {
        state.history.length = 20;
    }

    saveState();

    renderHistory();
}

function renderHistory() {
    const container =
        $("historyList");

    if (!container) return;

    const items =
        Array.isArray(state.history)
            ? state.history
            : [];

    if (!items.length) {
        container.innerHTML = `
            <div class="empty-result">
                <div class="empty-icon">🕘</div>
                <p>
                    No analyses recorded yet.
                    Run a portfolio, risk, screener
                    or projection analysis and it
                    will appear here.
                </p>
            </div>
        `;

        return;
    }

    const icons = {
        portfolio: "💼",
        risk: "⚠️",
        screener: "🔎",
        prediction: "📈",
        chat: "💬"
    };

    container.innerHTML = items
        .map(item => `
            <div class="history-item">

                <div class="history-icon">
                    ${icons[item.type] || "📊"}
                </div>

                <div class="history-body">

                    <strong>
                        ${escapeHTML(item.summary)}
                    </strong>

                    ${item.detail
                        ? `<p>${escapeHTML(item.detail)}</p>`
                        : ""}

                    <small>
                        ${new Date(
                            item.createdAt
                        ).toLocaleString()}
                    </small>

                </div>

            </div>
        `)
        .join("");
}

function clearHistory() {
    state.history = [];

    saveState();

    renderHistory();

    showToast(
        "Analysis history cleared.",
        "🗑️"
    );
}

/* ============================================================
   RESTORE ANALYSIS RESULTS
   ============================================================ */

function restoreResults() {
    if (state.portfolio) {
        renderPortfolio();
    }

    if (state.risk) {
        renderRisk();
    }

    if (state.screener) {
        renderScreener();
    }

    if (state.prediction) {
        renderPrediction();
    }

    renderHistory();

    /*
     * The app always opens fresh on the
     * Dashboard; previous runs are shown
     * in the History section instead.
     */
    state.lastSection = "dashboard";

    updateDashboardStats();
    updateReport();
}

/* ============================================================
   WINDOW RESIZE
   ============================================================ */

let resizeTimer;

window.addEventListener(
    "resize",
    () => {
        clearTimeout(
            resizeTimer
        );

        resizeTimer =
            setTimeout(() => {
                renderAllCharts();
            }, 150);
    }
);
/* ============================================================
   OLLAMA / LOCAL AI CHAT
   ============================================================ */

const OLLAMA_MODEL = "llama3.2";

/*
 * The browser does NOT connect directly to Ollama.
 *
 * Browser
 *    ↓
 * http://localhost:4000/api/chat
 *    ↓
 * Node / Express server
 *    ↓
 * Ollama
 *    ↓
 * llama3.2
 */

/*
 * LOCAL RULE-BASED ANSWER ENGINE
 * No Groq, no OpenAI, no external API. Runs fully in the browser.
 */

/*
 * Find the most recent investment topic mentioned by the user in the
 * conversation history, so follow-ups like "Why is it important?" can
 * be answered about that topic instead of falling to generic text.
 */
const LOCAL_TOPICS = [
    { key: "diversif", name: "Diversification",
      synonyms: ["\\bdiversif\\w*", "\\basset allocation\\b", "\\bspreading your money\\b", "\\bdiversified\\b"],
      definition: "Diversification means spreading your money across asset classes (equities, bonds, cash, international markets) so no single holding can hurt you badly.",
      why: "Diversification is important because it reduces the impact any single investment can have on your overall portfolio. When one asset falls, others may hold or gain value, smoothing your returns and lowering the chance of a severe loss. It is one of the few free lunches in investing - you reduce risk without necessarily giving up return.",
      how: "Diversification works through correlation: assets that do not move together offset each other's swings. You combine equities, bonds, cash, real estate and international markets in proportions matched to your risk tolerance and time horizon, then rebalance periodically so no single position grows too dominant.",
      example: "Example: instead of putting all Rs 10,00,000 into one tech stock, you split it - say 40% in an index ETF, 25% in bonds, 15% in international funds, 10% in gold/REITs and 10% in cash. If tech drops 30%, only part of your portfolio is hit, and the bonds and gold cushion the loss.",
      benefits: "Benefits of diversification:\n\n1. Lower overall portfolio volatility and smaller drawdowns.\n2. No single company, sector or country can wipe you out.\n3. Smoother returns make it easier to stay invested and avoid panic selling.\n4. You still capture the long-term growth of the market as a whole.",
      types: "The main types of diversification are:\n\n1. Asset-class diversification - spreading across equities, bonds, cash and commodities.\n2. Sector diversification - avoiding concentration in one industry (e.g. all tech).\n3. Geographic diversification - mixing domestic and international markets.\n4. Time diversification - investing gradually over time (e.g. SIPs/DCA) instead of one lump sum.\n5. Style/size diversification - blending large-cap, mid-cap, growth and value holdings.",
      risks: "The main risks of diversification are:\n\n1. Over-diversification - spreading so thin that fees and complexity rise while returns just track the average.\n2. Diworsification - adding unrelated assets that add risk instead of reducing it.\n3. Correlation risk - in a crisis, correlations rise and assets that were supposed to offset each other fall together.\n4. Cash drag - an over-cautious mix can badly lag inflation and long-term goals." },
    { key: "bond", name: "Bonds",
      synonyms: ["\\bbonds?\\b", "\\bfixed[- ]income\\b", "\\bdebentures?\\b"],
      definition: "Bonds are loans to governments or companies that pay interest over time and return the principal at maturity.",
      why: "Bonds are important because they provide predictable income and stability, and they often hold value when equities fall, cushioning a portfolio in downturns.",
      how: "Bonds work by you lending money to an issuer, which pays you regular interest (the coupon) and repays the principal on maturity. Their prices move inversely with interest rates.",
      example: "Example: buying a 10-year government bond paying 6% interest - you receive 6% each year and your principal back after 10 years.",
      benefits: "Benefits of bonds:\n\n1. Predictable, steady income.\n2. Lower volatility than stocks.\n3. Capital preservation for near-term goals.\n4. Often rise in value when equities fall.",
      types: "The main types of bonds are:\n\n1. Government bonds - issued by the sovereign; safest, lowest yield.\n2. Corporate bonds - issued by companies; higher yield, higher credit risk.\n3. Municipal bonds - issued by local governments, often tax-advantaged.\n4. Treasury bills - short-term (under 1 year), very liquid.\n5. Zero-coupon bonds - sold at a discount, pay everything at maturity.\n6. Inflation-linked bonds - principal adjusts with inflation (e.g. TIPS).",
      risks: "The main risks of bonds are:\n\n1. Interest-rate risk - when rates rise, existing bond prices fall (longest maturities move the most).\n2. Credit/default risk - the issuer may be downgraded or fail to pay interest or principal.\n3. Inflation risk - rising prices erode the real value of fixed coupon payments.\n4. Liquidity risk - some bonds are hard to sell quickly at a fair price.\n\nGovernment bonds carry mostly interest-rate and inflation risk, while corporate bonds add credit risk in proportion to their yield." },
    { key: "etf", name: "ETFs",
      synonyms: ["\\betfs?\\b", "\\bindex funds?\\b", "\\bmutual funds?\\b"],
      definition: "An ETF (Exchange-Traded Fund) is a basket of securities that trades like a single stock.",
      why: "ETFs are important because they give instant diversification, low fees and easy access to whole markets or sectors in a single purchase.",
      how: "ETFs work by pooling investors' money into a fund that tracks an index or basket; shares of that fund trade on an exchange throughout the day at market prices.",
      example: "Example: buying one share of a Nifty 50 or S&P 500 ETF gives you fractional ownership of the 50 (or 500) largest companies in that index at once.",
      benefits: "Benefits of ETFs:\n\n1. Instant diversification from a single purchase.\n2. Low expense ratios compared to active funds.\n3. Liquidity - they trade like stocks any time the market is open.\n4. Transparency in holdings.",
      types: "The main types of ETFs are:\n\n1. Index ETFs - track a broad index like the Nifty 50 or S&P 500.\n2. Sector/industry ETFs - focus on one sector such as technology or healthcare.\n3. Bond ETFs - hold fixed-income securities for income and stability.\n4. International ETFs - expose you to foreign or emerging markets.\n5. Commodity ETFs - track gold, silver or other commodities.\n6. Thematic ETFs - target trends like clean energy or AI.",
      risks: "The main risks of ETFs are:\n\n1. Market risk - the whole index or sector the ETF tracks can fall.\n2. Tracking error - the ETF may not perfectly match its index due to fees and rebalancing.\n3. Liquidity risk - thinly traded ETFs can have wide bid-ask spreads.\n4. Concentration risk - sector or thematic ETFs carry far less diversification than broad index ETFs." },
    { key: "stock", name: "Stocks (Equities)",
      synonyms: ["\\bstocks?\\b", "\\bequit(?:y|ies)\\b", "\\bshares?\\b"],
      definition: "A stock (equity) is a share of ownership in a company. As an owner you benefit from the company's growth through price appreciation and, often, dividends.",
      why: "Stocks are important because historically they have delivered the highest long-term returns of the major asset classes, helping your money outpace inflation and grow over long horizons.",
      how: "Stock investing works by buying shares of companies - directly or through funds - whose value rises and falls with earnings, growth expectations and market sentiment. Returns come from price appreciation plus dividends.",
      example: "Example: buying 10 shares of a company at $50 each is a $500 ownership stake; if the share price rises to $65, the stake is worth $650, plus any dividends paid along the way.",
      benefits: "Benefits of stocks:\n\n1. Highest long-term growth potential of the major asset classes.\n2. Dividend income on top of price gains.\n3. High liquidity - easy to buy and sell.\n4. A real ownership stake in businesses.",
      types: "The main types of stocks are:\n\n1. Common stock - standard ownership with voting rights.\n2. Preferred stock - fixed dividends, priority over common holders, usually no voting rights.\n3. Growth stocks - fast-growing companies reinvesting profits; higher volatility.\n4. Value stocks - priced below perceived worth; steadier, often dividend-paying.\n5. Blue-chip stocks - large, established, financially sound companies.\n6. Small-cap/penny stocks - speculative with wide price swings.",
      risks: "Stock risks include market downturns, company-specific failures, short-term volatility and permanent loss if a company declines." },
    { key: "reit", name: "REITs",
      synonyms: ["\\breits?\\b", "\\breal estate investment trusts?\\b"],
      definition: "REITs (Real Estate Investment Trusts) let you invest in property portfolios that trade like stocks.",
      why: "REITs are important because they give you real-estate exposure and dividend income without buying property directly, adding diversification to a portfolio.",
      how: "REITs work by owning or financing income-producing property; they must distribute most of their income as dividends, so you earn rental income through your shares.",
      example: "Example: buying units of a listed REIT gives you a fractional stake in office buildings, warehouses or apartments and a share of the rent they collect, paid out as dividends.",
      benefits: "Benefits of REITs:\n\n1. Dividend income from rent.\n2. Real-estate exposure without buying property.\n3. Liquidity - listed REITs trade like stocks.\n4. Diversification beyond stocks and bonds.",
      types: "The main types of REITs are:\n\n1. Equity REITs - own and manage income property.\n2. Mortgage REITs - lend against real estate and earn interest.\n3. Hybrid REITs - do both.\n4. Sector REITs - focus on offices, retail, warehouses, data centres or healthcare.",
      risks: "The main risks of REITs are:\n\n1. Interest-rate sensitivity - rising rates can pull REIT prices down.\n2. Property-market downturns hitting rents and values.\n3. Concentration in one property sector or region.\n4. Leverage - borrowed money amplifies both gains and losses." },
    { key: "portfolio", name: "Portfolio management",
      synonyms: ["\\bportfolio(?!\\s+risk)\\b", "\\bholdings?\\b", "\\basset allocation\\b", "\\bmy investments\\b"],
      definition: "A portfolio is the full collection of your investments - stocks, bonds, funds, cash and other assets - managed as one system rather than as separate bets.",
      why: "Managing investments as a portfolio matters because what counts is how the pieces behave together: the total risk, return and liquidity of the mix, not any single holding.",
      how: "Portfolio management works by setting an asset allocation matched to your goals and risk tolerance, diversifying within each asset class, and rebalancing periodically back to target weights.",
      example: "Example: a Rs 10,00,000 portfolio might hold 60% equity index funds, 30% bonds and 10% gold/cash; after equities rally to 70%, you rebalance back to 60% by selling equities and buying bonds.",
      benefits: "Benefits of managing investments as a portfolio:\n\n1. Risk is measured and controlled at the total level.\n2. Different assets offset each other's weak periods.\n3. Rebalancing enforces buy-low, sell-high discipline.\n4. A clear overview keeps decisions aligned with your goals.",
      types: "The main components of an investment portfolio are:\n\n1. Equities (stocks) - the growth engine.\n2. Fixed income (bonds) - stability and income.\n3. Cash equivalents - liquidity and safety.\n4. Real assets - real estate/REITs, gold, commodities.\n5. Funds - ETFs and mutual funds bundling the above.\n6. Alternatives - crypto and private assets, kept to a small slice.",
      risks: "Portfolio-level risks include concentration in one asset, correlations rising in a crisis, and allocation drift when you don't rebalance." },
    { key: "compound", name: "Compound growth",
      definition: "Compound growth means your returns start earning returns, so your money grows exponentially over time.",
      why: "Compound growth is important because time in the market is the strongest driver of long-term wealth - the earlier you start, the steeper the curve. At 7% per year, money roughly doubles every 10 years.",
      how: "Compounding works by reinvesting your earnings so that future gains are calculated on a growing base - principal plus all previous returns.",
      example: "Example: investing Rs 1,00,000 at 7% per year grows to about Rs 2,00,000 in 10 years, Rs 4,00,000 in 20 and Rs 7,60,000 in 30 - without adding a single rupee beyond the returns.",
      benefits: "Benefits of compound growth:\n\n1. Exponential rather than linear wealth building.\n2. Rewards starting early more than investing large amounts late.\n3. Works automatically once returns are reinvested.",
      types: "The main types of compounding in investing are:\n\n1. Simple compounding - interest on the original principal only (fixed deposits).\n2. Reinvested compounding - dividends and gains reinvested so the base keeps growing.\n3. SIP/DCA compounding - regular contributions each earn returns on an ever-larger base.\n4. Negative compounding - fees and inflation compound against you, which is why low costs matter.",
      risks: "The main risks around compound growth are:\n\n1. Time risk - starting late removes the years compounding needs to work.\n2. Interruption risk - withdrawing money or panic-selling mid-downturn resets the compounding base.\n3. Cost drag - fees and taxes compound too, quietly shrinking the curve.\n4. Expectation risk - assuming a fixed return every year ignores volatility along the way." },
    { key: "emerging", name: "Emerging markets",
      definition: "Emerging markets are the stock markets of developing economies such as Brazil, Indonesia, Vietnam, India and Mexico - economies growing faster than developed ones, but with less mature regulation and infrastructure.",
      why: "Emerging markets are important because they offer exposure to faster economic growth and a rising middle class, and they diversify a portfolio beyond developed economies like the US and Europe.",
      how: "Investing in emerging markets works through dedicated emerging-market funds or ETFs, country-specific ETFs, or ADRs/GDRs of individual companies listed on your home exchange.",
      example: "Example: a broad emerging-markets ETF gives you a stake in hundreds of companies across Brazil, Indonesia, Vietnam and other developing economies in one purchase, instead of picking single countries.",
      benefits: "Benefits of emerging markets:\n\n1. Higher long-term growth potential than developed markets.\n2. Demographic tailwinds from young, growing populations.\n3. Diversification away from developed-market concentration.\n4. Valuations are often lower than developed-market peers.",
      types: "Ways to classify emerging-market investments:\n\n1. Broad emerging-markets funds - diversified across many developing economies.\n2. Country-specific funds - single markets like India, Brazil or Vietnam.\n3. Regional funds - Asia ex-Japan, Latin America, frontier markets.\n4. ADRs/GDRs - individual foreign companies listed on your home exchange.",
      risks: "The main risks of emerging markets are:\n\n1. Currency risk - a falling local currency erodes returns in your home currency.\n2. Political and regulatory risk - unstable rules, capital controls or sudden policy shifts.\n3. Liquidity risk - shallower markets make it harder to exit at a fair price.\n4. Higher volatility - emerging-market swings are typically sharper than developed-market ones." },
    { key: "risk", name: "Investment & portfolio risk",
      synonyms: ["\\binvestment risk\\b", "\\bportfolio risk\\b", "\\brisk tolerance\\b", "\\brisk profile\\b", "\\bvolatilit\\w*"],
      definition: "Investment risk is the possibility that an investment loses value or performs worse than expected. Portfolio risk is how that risk adds up across your whole mix of holdings.",
      definitionVariants: [
        { label: "Portfolio risk", match: "\\bportfolio risk\\b",
          definition: "Portfolio risk is the risk of your entire investment mix - the chance that the combined portfolio loses value, driven by asset allocation, time horizon and concentration.",
          types: "The main types of portfolio risk are:\n\n1. Market (systematic) risk - the whole market falls and your whole mix falls with it; cannot be fully diversified away.\n2. Concentration risk - too much of the mix sits in one stock, sector, country or asset class.\n3. Correlation risk - in a crisis, assets meant to offset each other fall together.\n4. Interest-rate risk - rate changes move bond-heavy mixes down.\n5. Inflation risk - the real value of the whole mix erodes over time.\n6. Allocation drift risk - without rebalancing, the mix drifts riskier than intended.",
          vs: { "Investment risk": "Investment risk is the broader concept - the chance that any single investment loses value or underperforms. Portfolio risk is how those risks add up across all your holdings, taking into account how the pieces correlate with each other." } },
        { label: "Investment risk", match: "\\binvestment risk\\b",
          definition: "Investment risk is the possibility that an investment's actual return differs from - or falls short of - the expected return, up to and including losing some or all of the money invested.",
          vs: { "Portfolio risk": "Portfolio risk is the combined risk of all your holdings together. Investment risk belongs to each individual investment; portfolio risk aggregates it - and thanks to diversification, portfolio risk can be lower than the average risk of the individual investments." } }
      ],
      why: "Understanding risk is important because it determines which asset mix you can actually hold through a downturn without selling at the bottom.",
      how: "Risk management works by matching your allocation to your horizon and tolerance, diversifying across uncorrelated assets and reviewing exposure regularly.",
      example: "Example: an all-stock portfolio might swing 30% in a year, while adding 40% bonds might cut that swing to roughly 15% with modestly lower long-term returns.",
      benefits: "Benefits of managing risk:\n\n1. Smaller drawdowns are easier to recover from.\n2. You avoid panic selling at market bottoms.\n3. Your portfolio matches your real financial needs.",
      types: "The main types of investment risk are:\n\n1. Market risk - the whole market falls and takes your holdings with it; cannot be fully diversified away.\n2. Credit risk - a bond issuer defaults or is downgraded and cannot pay interest or principal.\n3. Liquidity risk - you cannot sell quickly at a fair price when you need the money.\n4. Inflation risk - rising prices quietly erode the real value of your returns.\n5. Interest-rate risk - rate changes move bond prices down and hurt rate-sensitive stocks.\n6. Concentration risk - too much of your portfolio sits in one stock, sector or country.\n\nDiversification directly reduces credit, liquidity and concentration risk, while market and inflation risk are managed through asset allocation and growth assets.",
      risks: "The main ways portfolio risk hurts you are drawdowns during market falls, a bond issuer defaulting, being unable to sell at a fair price when needed, inflation eroding real returns, and concentration amplifying any single failure." }
];

function getLocalTopicFromHistory(history) {
    const entries = Array.isArray(history) ? history : [];

    /*
     * Walk backwards through the user's own questions first; if none
     * names a known topic, fall back to any entry (the assistant's
     * answer also names the topic it explained).
     */
    for (const entry of [...entries].reverse()) {
        if (entry.role !== "user") continue;
        const found = findTopicInText(entry.content);
        if (found) return found;
    }

    for (const entry of [...entries].reverse()) {
        const found = findTopicInText(entry.content);
        if (found) return found;
    }

    return resolveActiveTopic(null);
}

/*
 * Detect the intent of the CURRENT question and answer it for the
 * resolved topic. Returns null when the question is not a recognised
 * contextual follow-up, so normal topic matching can still run.
 */
/*
 * QUESTION INTENT CLASSIFIER
 * Detects WHAT the user wants to know (a definition? the reason it
 * matters? how it works? an example? the benefits?) rather than just
 * matching topic keywords. Used by the local answer engine so that
 * "What is diversification?" yields the definition while
 * "Why is diversification important?" yields the reasoning — even
 * though both name the same topic.
 */
function detectQuestionIntent(text) {
    const t = String(text || "").toLowerCase().trim();

    if (!t) return null;

    /* Comparison intent: "compare X and Y", "X vs Y",
     * "difference between X and Y".
     */
    if (
        /\bcompare\b|\bcompar[ia]son\b|\bversus\b|\bvs\.?\b|\bdifference between\b/.test(t)
    ) {
        return "compare";
    }

    /* Explicit intent words, checked first: they override question shape. */
    /* Type/list intent: "What are its types?", "its kinds", "categories".
     * Must be checked BEFORE the definition intent, otherwise
     * "What are its types?" (which matches "what ... are") is
     * mis-classified as a definition request and the previous
     * definition is simply repeated.
     */
    if (
        /\b(types?|kinds?|categories?|classifications?|varieties?)\b/.test(t) ||
        /\btypes? of (it|this|that|them)\b/.test(t)
    ) {
        return "types";
    }

    if (/\b(examples?|for instance|e\.g\.|such as|show me)\b/.test(t)) {
        return "example";
    }

    if (/\b(benefits?|advantages?|perks?|upsides?|pros)\b|\bwhy should i\b/.test(t)) {
        return "benefits";
    }

    /*
     * "What is/are X?" -> definition — UNLESS the object is a
     * pronoun/possessive followed by a category noun, in which case
     * that noun decides the intent: "What are its risks?" -> risks,
     * "What is its importance?" -> why. Without this, questions like
     * "What is investment risk?" would be mis-read as a risks
     * request because the topic word itself contains "risk".
     */
    if (/^(what|who)\b.*\b(is|are)\b/.test(t)) {
        const pronounNoun = t.match(
            /\b(?:is|are)\s+(?:the\s+)?(?:its?|it|this|that|these|those|their|them)\s+([a-z]+)\b/
        );

        if (pronounNoun) {
            const noun = pronounNoun[1];

            if (/^(risks?|dangers?|downsides?|drawbacks?)/.test(noun)) {
                return "risks";
            }

            if (/^(benefits?|advantages?|pros|upsides?)/.test(noun)) {
                return "benefits";
            }

            if (/^(types?|kinds?|categories?)/.test(noun)) {
                return "types";
            }

            if (/^(examples?|instances?)/.test(noun)) {
                return "example";
            }
        }

        return "definition";
    }

    if (/\b(risks?|downsides?|drawbacks?|cons|dangers?|negatives?)\b/.test(t)) {
        return "risks";
    }

    /*
     * Reason/purpose intent: "Why is X important?", "Does it matter?"
     */
    if (
        /^\s*why\b/.test(t) ||
        /\bwhy\b/.test(t) ||
        /\b(importance|important|matters?|point of|purpose of|reason)\b/.test(t)
    ) {
        return "why";
    }

    /* Mechanism intent: "How does X work?", "How do I ...?" */
    if (
        /^\s*how\b/.test(t) ||
        /\bhow (does|do|did|can|would|should)\b/.test(t) ||
        /\bhow it works\b/.test(t) ||
        /\bhow to\b/.test(t) ||
        /\b(works?|working|mechanics)\b/.test(t)
    ) {
        return "how";
    }

    /* Definition intent: "Define X", "What does X mean?"
     * ("What is/are X?" is already handled above.)
     */
    if (
        /^\s*(define|definition of|meaning of)\b/.test(t) ||
        /\bwhat does\b.*\bmean\b/.test(t)
    ) {
        return "definition";
    }

    return null;
}

/*
 * PERSISTENT SESSION CONTEXT
 * Tracks the topic (and definition variant, e.g. "portfolio risk" vs
 * "investment risk") used most recently, so pronoun follow-ups and
 * distinctions between related subtopics work across the whole chat
 * session without any per-question prompt or manual rule.
 */
let sessionContext = { lastTopicKey: null, lastVariantLabel: null };

/*
 * CENTRALIZED CONVERSATION CONTEXT
 * One place owns the active topic of the chat. Every question that
 * names a topic updates it; every pronoun follow-up ("it", "they",
 * "their", "this", "that", ...) resolves against it, with the message
 * history as the source of truth and this store as the fallback when
 * the recent history no longer names the topic.
 */
const conversationContext = {
    currentTopicKey: null,
    currentEntity: null,
    previousTopicKey: null,
    previousQuestion: "",
    previousAnswer: ""
};

/*
 * Register a topic as the ACTIVE one. Explicitly named topics always
 * replace the current context ("What are bonds?" then "What is
 * investment risk?" switches the active topic to investment risk).
 */
function rememberTopicInContext(topic) {
    if (!topic) return;

    if (conversationContext.currentTopicKey === topic.key) {
        conversationContext.currentEntity = topic;
        return;
    }

    conversationContext.previousTopicKey =
        conversationContext.currentTopicKey;
    conversationContext.currentTopicKey = topic.key;
    conversationContext.currentEntity = topic;
}

/*
 * Resolve the ACTIVE topic for a follow-up: the most recent topic the
 * USER named in the history, else (for assistant-only tails) any
 * recent topic, else the remembered active entity.
 */
function resolveActiveTopic(history) {
    const entries = Array.isArray(history) ? history : [];

    for (const entry of [...entries].reverse()) {
        if (!entry || entry.role !== "user") continue;
        const found = findTopicInText(entry.content);
        if (found) return found;
    }

    for (const entry of [...entries].reverse()) {
        if (!entry) continue;
        const found = findTopicInText(entry.content);
        if (found) return found;
    }

    /*
     * The remembered entity is only a fallback when there IS a
     * conversation: with history off/empty every question must stand
     * on its own.
     */
    return entries.length ? (conversationContext.currentEntity || null) : null;
}

/*
 * Pronouns and implicit references that can stand for the active
 * topic, and phrases that must never be treated as one.
 */
const PRONOUN_REFERENCE_RE =
    /\b(it|its|it's|they|their|theirs|them|this|that|these|those)\b/i;

const PRONOUN_STOP_RE =
    /\b(that is|that way|in that case|it depends|as it were)\b/i;

function isPronounReference(text) {
    const t = String(text || "").toLowerCase().trim();

    if (!t || t.split(/\s+/).length > 25) return false;
    if (findTopicInText(t)) return false;
    if (PRONOUN_STOP_RE.test(t)) return false;

    return PRONOUN_REFERENCE_RE.test(t);
}

/*
 * QUESTION NORMALIZATION
 * Resolve a pronoun/implicit-reference question to the active topic
 * and return the question with pronouns substituted by the topic
 * name, so keyword matching downstream sees "bonds" instead of
 * "they". Returns null when the question names its own topic or no
 * active topic exists, in which case the existing engine handles it
 * unchanged.
 */
function resolveContextualQuestion(question, history) {
    if (!isPronounReference(question)) return null;

    const topic = resolveActiveTopic(history);

    if (!topic) return null;

    const name = String(topic.name || "").toLowerCase();

    const resolved = String(question).replace(
        /\b(it's|its|it|this|that|they|them|their|theirs|these|those)\b/gi,
        name
    );

    /* Track the entity for elaboration / variant logic. */
    sessionContext.lastTopicKey = topic.key;
    rememberTopicInContext(topic);

    return { topic: topic, question: resolved };
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getDefinitionFor(topic, question) {
    const variants = topic.definitionVariants;

    if (!variants || !variants.length) {
        sessionContext.lastTopicKey = topic.key;
        return topic.definition || null;
    }

    const t = String(question || "").toLowerCase();

    let chosen = null;

    for (const variant of variants) {
        if (new RegExp(variant.match, "i").test(t)) {
            chosen = variant;
            break;
        }
    }

    if (!chosen) {
        sessionContext.lastTopicKey = topic.key;
        return topic.definition || null;
    }

    let answer = chosen.definition;

    /*
     * If the previous turn defined a DIFFERENT variant of the same
     * topic (e.g. "What is portfolio risk?" followed by "What is
     * investment risk?"), explain the distinction automatically.
     */
    const previousLabel = sessionContext.lastVariantLabel;

    if (
        previousLabel &&
        sessionContext.lastTopicKey === topic.key &&
        previousLabel !== chosen.label &&
        chosen.vs &&
        chosen.vs[previousLabel]
    ) {
        answer +=
            "\n\nDifference from " + previousLabel + ": " +
            chosen.vs[previousLabel];
    }

    sessionContext.lastTopicKey = topic.key;
    sessionContext.lastVariantLabel = chosen.label;

    return answer;
}

function firstSentence(text) {
    const flat = String(text || "")
        .replace(/\n+/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();

    const parts = flat.split(/(?<=[.!?])\s+/);

    return parts[0] || flat;
}

function firstPoints(text, count) {
    const lines = String(text || "")
        .split(/\n/)
        .map(line => line.trim())
        .filter(line => /^(\d+[.)]|[-•*])\s/.test(line));

    return lines
        .slice(0, count || 1)
        .map(line => line.replace(/^(\d+[.)]|[-•*])\s*/, ""));
}

/*
 * Collect the topics most relevant to a comparison: the ones named
 * in the CURRENT question first, then the most recent topics from
 * the conversation ("compare them" after discussing ETFs and
 * bonds), deduplicated, up to two.
 */
function getRecentTopicsForCompare(question, history) {
    const entries = Array.isArray(history) ? history : [];
    const found = [];

    const consider = text => {
        const topic = findTopicInText(text);
        if (topic && !found.includes(topic)) found.push(topic);
    };

    consider(question);

    for (const entry of [...entries].reverse()) {
        if (found.length >= 2) break;
        consider(entry && entry.content);
    }

    return found;
}

function buildCompareAnswer(topicA, topicB) {
    const pointsA = firstPoints(topicA.benefits, 1);
    const pointsB = firstPoints(topicB.benefits, 1);

    return (
        "Comparing " + topicA.name + " and " + topicB.name + ":\n\n" +
        "1. What they are\n" +
        "   • " + topicA.name + ": " + firstSentence(topicA.definition) + "\n" +
        "   • " + topicB.name + ": " + firstSentence(topicB.definition) + "\n\n" +
        "2. Key strength\n" +
        "   • " + topicA.name + ": " + (pointsA[0] || "see its benefits") + "\n" +
        "   • " + topicB.name + ": " + (pointsB[0] || "see its benefits") + "\n\n" +
        "3. Main risk to weigh\n" +
        "   • " + topicA.name + ": " + firstSentence(topicA.risks || topicA.definition) + "\n" +
        "   • " + topicB.name + ": " + firstSentence(topicB.risks || topicB.definition) + "\n\n" +
        "Which fits you depends on your " + chatSettings.riskLevel +
        " risk profile and " + chatSettings.horizon +
        " horizon. Ask \"types of " + topicA.name + "\" or \"examples of " +
        topicB.name + "\" to go deeper on either one."
    );
}

function getCompareAnswerFor(question, history) {
    const topics = getRecentTopicsForCompare(question, history);

    if (topics.length >= 2) {
        return buildCompareAnswer(topics[0], topics[1]);
    }

    if (topics.length === 1) {
        return (
            "Right now the conversation covers " + topics[0].name +
            ". Name one more investment topic to compare it with — " +
            "for example: \"compare " + topics[0].name.toLowerCase() +
            " and bonds\" — and I'll break down the differences."
        );
    }

    return null;
}

function isCompareRequest(text) {
    const t = String(text || "").toLowerCase();

    if (!t) return false;

    return /\bcompare\b|\bcompar[ia]son\b|\bversus\b|\bvs\.?\b|\bdifference between\b/.test(t);
}

/*
 * Find a known investment topic named in free text (earliest match
 * wins, so "diversification and ETFs" resolves to diversification).
 * Each topic's synonyms (stocks/equities, bonds/fixed income,
 * ETF/fund, investment risk/portfolio risk, ...) participate in the
 * match; when two patterns start at the same position the LONGER
 * match wins, so "investment risk" beats a bare "investment".
 */
function findTopicInText(text) {
    const t =
        " " + String(text || "").toLowerCase() + " ";

    let best = null;
    let bestIndex = Infinity;
    let bestLength = 0;

    for (const topic of LOCAL_TOPICS) {
        const sources = ["\\b" + escapeRegExp(topic.key) + "\\b"]
            .concat(topic.synonyms || []);

        for (const source of sources) {
            let regex;

            try {
                regex = new RegExp(source, "g");
            } catch (error) {
                continue;
            }

            let match;

            while ((match = regex.exec(t)) !== null) {
                const index = match.index;
                const length = match[0].length;

                if (
                    index < bestIndex ||
                    (index === bestIndex && length > bestLength)
                ) {
                    best = topic;
                    bestIndex = index;
                    bestLength = length;
                }

                if (match.index === regex.lastIndex) {
                    regex.lastIndex++;
                }
            }
        }
    }

    return best;
}

/*
 * VARIANT-AWARE SECTIONS
 * When the previous definition was served for a specific variant of
 * the topic ("portfolio risk" vs "investment risk"), section answers
 * ("What are its types?") prefer that variant's own section, so the
 * follow-up stays about the variant the user is actually discussing.
 */
function getVariantSection(topic, intent) {
    if (
        !topic ||
        !topic.definitionVariants ||
        !topic.definitionVariants.length
    ) {
        return null;
    }

    if (sessionContext.lastTopicKey !== topic.key) return null;

    const label = sessionContext.lastVariantLabel;

    if (!label) return null;

    const variant = topic.definitionVariants.find(
        v => v.label === label
    );

    return variant ? (variant[intent] || null) : null;
}

/*
 * INTENT-AWARE ANSWER ROUTING
 * Resolves (topic, intent) and returns the matching answer text, or
 * null when either is missing. The topic may be named in the question
 * itself ("Why is diversification important?") or carried over from
 * the conversation ("Why is it important?").
 */
function getTopicIntentAnswer(question, history) {
    const intent =
        detectQuestionIntent(question);

    if (!intent) return null;

    let topic = findTopicInText(question);

    /*
     * Link to previous context ONLY when the question is clearly a
     * follow-up ("Why is it important?", "What about the second
     * point?"). Independent questions are never given the previous
     * topic automatically.
     */
    if (!topic && isContextualFollowUp(question)) {
        topic = getLocalTopicFromHistory(history);
    }

    if (!topic) return null;

    /*
     * Track the most recent topic so pronoun follow-ups and
     * definition-variant distinctions keep working session-wide.
     */
    sessionContext.lastTopicKey = topic.key;
    rememberTopicInContext(topic);

    /*
     * "compare" needs TWO topics and is resolved by
     * getCompareAnswerFor — never against a single topic.
     */
    if (intent === "compare") {
        return null;
    }

    if (intent === "definition") {
        return getDefinitionFor(topic, question);
    }

    if (intent === "risks" && !topic.risks) return null;

    /* Variant-aware: answer for the variant being discussed. */
    return getVariantSection(topic, intent) || topic[intent] || null;
}

/*
 * ELABORATION REQUESTS ("elaborate", "expand", "tell me more", the
 * 📖 More detail button): must EXPAND the previous answer with new
 * information, not repeat it.
 */
const ELABORATION_PATTERNS = [
    /^(elaborate|expand|go deeper|deepen|continue|more detail|in more detail|more info|more information)\b/,
    /^(please\s+)?(explain|describe)\b.*(more|further|detail)/,
    /\bin detail\b/,
    /\bexplain (it|that|this|more)\b/,
    /\bexplain (your|the|that) previous answer\b/,
    /\bmore (detail|details|info|information) (on|about) (it|this|that|them)\b/,
    /^(tell|say|go) me?\b.*\bmore\b/,
    /^(tell me more|go on|keep going|what else|anything else)\b/
];

function isElaborationRequest(text) {
    const normalized =
        String(text || "").toLowerCase().trim();

    if (!normalized || normalized.split(/\s+/).length > 30) {
        return false;
    }

    return ELABORATION_PATTERNS
        .some(pattern => pattern.test(normalized));
}

/*
 * Build an elaboration of the previous answer. The elaboration is
 * TOPIC-LOCKED: it only expands content that was already part of the
 * previous conversation (previous question + previous answer). It
 * must NEVER introduce a new topic (bonds, compound growth, etc.)
 * that was not mentioned in the previous exchange.
 */
function getElaborationAnswer(prevQuestion, prevAnswer) {
    const prevQuestionText =
        String(prevQuestion || "");
    const prev =
        String(prevAnswer || "");

    if (!prev.trim()) {
        return null;
    }

    let topic =
        findTopicInText(prevQuestionText + " " + prev);

    if (!topic && conversationContext.currentEntity) {
        topic = conversationContext.currentEntity;
    }

    /*
     * Known topic: reuse the stored topic sections the previous
     * answer did NOT already contain, so the user gets new
     * information about the SAME topic instead of the same text.
     */
    if (topic) {
        const newSections = [];

        for (const field of
            ["definition", "how", "example", "benefits", "why"]
        ) {
            const section = topic[field];

            /*
             * When the previous answer came from a definition
             * variant (e.g. "portfolio risk" vs "investment
             * risk"), the concept of the default definition was
             * already explained — skip it to avoid a repeat.
             */
            if (
                field === "definition" &&
                sessionContext.lastTopicKey === topic.key &&
                sessionContext.lastVariantLabel
            ) {
                continue;
            }

            /*
             * Skip sections already covered by the previous
             * answer (fingerprint on the first 80 chars).
             */
            if (
                section &&
                !prev.includes(section.slice(0, 80))
            ) {
                newSections.push(section);
            }
        }

        if (newSections.length) {
            return (
                "Going deeper on " + topic.name + ":\n\n" +
                newSections.join("\n\n")
            );
        }

        /*
         * All stored sections were already shown: stay locked to the
         * SAME topic and go deeper on it structurally, without
         * dragging in unrelated topics.
         */
        return (
            "Going deeper on " + topic.name + ":\n\n" +
            "• How it applies to you: match your " + topic.name +
            " decision to your risk tolerance and time horizon — " +
            chatSettings.riskLevel + " profile, " + chatSettings.horizon +
            " horizon.\n" +
            "• Costs and taxes: the practical results of " + topic.name +
            " depend heavily on the fees, taxes and wrappers you use, " +
            "so compare the total cost before acting.\n" +
            "• The main trade-off: whatever makes " + topic.name +
            " attractive also carries its key risk — weigh both sides " +
            "before committing money.\n\n" +
            "Want me to elaborate a specific point (e.g. \"point 1\") " +
            "or answer a new question about " + topic.name + "?"
        );
    }

    /*
     * Previous answer not tied to a known topic: expand ONLY the
     * content of the previous answer itself. Every angle below
     * refers back to that answer — no new investment topics are
     * introduced.
     */
    const flattened = prev
        .replace(/\n+/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();

    const sentences = flattened
        .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
        .map(sentence => sentence.trim())
        .filter(Boolean);

    const keySentence = sentences[0] || prev.slice(0, 120);

    return (
        "Expanding on the previous answer:\n\n" +
        "• In short, it says: " + keySentence + "\n" +
        "• How to use it: apply this to your own situation — your " +
        "risk tolerance (currently \"" + chatSettings.riskLevel +
        "\") and time horizon (\"" + chatSettings.horizon +
        "\") decide how much of it applies to you.\n" +
        "• What to watch: the practical trade-offs behind this answer " +
        "are costs, taxes and timing — the details in the previous " +
        "answer assume normal market conditions.\n" +
        "• Next step: pick one specific part of the answer above and " +
        "ask me to elaborate that (e.g. \"elaborate point 1\") for a " +
        "closer look."
    );
}

function getFollowUpAnswer(question, history) {
    /*
     * Previous context is used only for clearly-phrased follow-ups.
     * Independent questions get no topic carried over.
     */
    if (!isContextualFollowUp(question)) {
        return null;
    }

    const intent = detectQuestionIntent(question);

    if (!intent) return null;

    if (intent === "compare") {
        return getCompareAnswerFor(question, history);
    }

    const topic = getLocalTopicFromHistory(history);

    if (!topic) return null;

    sessionContext.lastTopicKey = topic.key;
    rememberTopicInContext(topic);

    if (intent === "definition") {
        return getDefinitionFor(topic, question);
    }

    /*
     * "Risks" intent is answered only when the topic defines it;
     * otherwise fall through so normal topic matching can run.
     */
    if (intent === "risks" && !topic.risks) return null;

    /* Variant-aware: answer for the variant being discussed. */
    return getVariantSection(topic, intent) || topic[intent] || null;
}

function getLocalAnswer(question, history = []) {
    let text =
        String(question || "").toLowerCase();

    const has = (...words) =>
        words.some(word => text.includes(word));

    if (!text) {
        return "Please enter a question.";
    }

    /*
     * CONTEXT RESOLUTION LAYER: resolve pronouns and implicit
     * references ("it", "they", "their", "this", ...) to the
     * active topic BEFORE any keyword matching. When a resolvable
     * context exists, try the intent-aware follow-up engine first,
     * then continue with the pronouns substituted by the topic name.
     */
    const resolvedContext =
        resolveContextualQuestion(question, history);

    if (resolvedContext) {
        const contextualAnswer =
            getFollowUpAnswer(question, history);

        if (contextualAnswer) {
            return contextualAnswer;
        }

        question = resolvedContext.question;
        text = question.toLowerCase();
    }

    if (has("hello", "hi ", "hey")) {
        return "Hello! Ask me about portfolio diversification, risk, bonds, ETFs, compound growth or future projections.";
    }
    /*
     * Elaboration requests ("elaborate", "expand", "tell me more")
     * build on the PREVIOUS answer instead of restarting the topic.
     */
    if (isElaborationRequest(text)) {
        const entries = Array.isArray(history) ? history : [];
        const prevUser = [...entries].reverse().find(e => e && e.role === "user");
        const prevAssistant = [...entries].reverse().find(e => e && e.role === "assistant");
        const elaborated = getElaborationAnswer(
            prevUser ? prevUser.content : "",
            prevAssistant ? prevAssistant.content : ""
        );
        if (elaborated) {
            return elaborated;
        }
    }

    /*
     * INTENT-AWARE ROUTING (checked before keyword matching):
     * "What is diversification?" -> definition,
     * "Why is diversification important?" -> reasoning,
     * "How does compounding work?" -> mechanism,
     * whether the topic is named here or in the previous turn.
     */
    const intentAnswer =
        getTopicIntentAnswer(question, history);

    if (intentAnswer) {
        return intentAnswer;
    }

    if (has("diversif")) {
        return "Diversification means spreading your money across asset classes (equities, bonds, cash, international markets) so no single holding can hurt you badly. Use the Portfolio Builder in this dashboard to get a suggested allocation based on your risk tolerance.";
    }

    if (has("risk", "volatil")) {
        return "Portfolio risk is the chance that your investments lose value. It depends on asset mix, time horizon and concentration. Use the Risk Evaluator section to score your portfolio from 1-10 and see major risk factors like market volatility, liquidity and inflation risk.";
    }

    if (has("bond")) {
        return "Bonds are loans to governments or companies. Benefits: predictable income, lower volatility than stocks, and they often hold value when equities fall. Trade-offs: interest-rate risk and inflation eroding real returns.";
    }

    if (has("etf", "index fund")) {
        return "An ETF (Exchange-Traded Fund) is a basket of securities that trades like a single stock. Benefits: instant diversification, low fees and easy access to whole markets or sectors.";
    }

    if (has("compound", "growth")) {
        return "Compound growth means your returns start earning returns. At 7% per year, money roughly doubles every 10 years. Time in the market is the strongest driver - the earlier you start, the steeper the curve. Try the Future Projection section to see an illustrative curve.";
    }

    if (has("projection", "future", "predict")) {
        return "Future projections are illustrative, not guarantees. They combine your starting amount, contributions, horizon and an assumed return. The Future Projection section shows conservative, expected and optimistic scenarios side by side.";
    }

    if (has("stock", "equit")) {
        return "Equities represent ownership in companies. Historically they offer the highest long-term returns of the major asset classes, but with meaningful short-term volatility. They suit longer horizons and higher risk tolerance.";
    }

    if (has("reit", "real estate")) {
        return "REITs (Real Estate Investment Trusts) let you invest in property portfolios that trade like stocks. They provide income through dividends and add diversification, but are sensitive to interest rates.";
    }

    if (has("crypto", "bitcoin")) {
        return "Crypto is a highly volatile speculative asset class. If you choose to hold it, keep it to a small slice of your portfolio that you could afford to lose.";
    }

    if (has("rebalance")) {
        return "Rebalancing means periodically restoring your allocation to its target weights - selling what grew too big and buying what shrank. Many investors do this once a year.";
    }

    if (has("budget", "emergency")) {
        return "Before investing, keep an emergency fund (3-6 months of expenses) in cash. Then invest money you will not need for your full time horizon.";
    }

    if (has("inflation")) {
        return "Inflation reduces purchasing power over time. Long-term investors usually counter it with growth assets like equities, and review whether returns beat the inflation rate.";
    }

    if (has("screener", "screen", "categor")) {
        return "The Market Screener section lets you select asset classes, sectors and themes, then shows a rule-based breakdown of each category's risk profile and characteristics.";
    }

    /* Types / kinds / categories of investments and asset classes */
    if (has("types of investment", "type of investment", "investment types", "types of invest", "kinds of investment", "investment options", "what can i invest", "asset class")) {
        return "The main types of investments are:\n\n" +
            "1. Stocks (Equities) - ownership shares in companies; highest long-term growth potential but volatile.\n" +
            "2. Bonds - loans to governments/companies; steady income, lower risk than stocks.\n" +
            "3. Mutual Funds & ETFs - baskets of securities; instant diversification and low fees.\n" +
            "4. Real Estate & REITs - property exposure with dividend income.\n" +
            "5. Commodities & Gold - inflation hedges, no income but store of value.\n" +
            "6. Cash Equivalents - savings, money-market funds, T-bills; very safe, low return.\n" +
            "7. Crypto - highly volatile, speculative; keep it to a small slice.\n" +
            "8. Alternatives - private equity, hedge funds, crowdfunding.\n\n" +
            "Most investors combine several of these based on their risk tolerance and time horizon. Try the Portfolio Builder or Market Screener sections to see how each fits a plan.";
    }

    /*
     * Contextual follow-ups ("Why is it important?", "Give me an
     * example", ...) about the previous topic get a fresh answer for
     * the CURRENT intent - never the generic fallback below.
     */
    const followUp = getFollowUpAnswer(question, history);
    if (followUp) {
        return followUp;
    }

    /* Generic question patterns -> give a structured, helpful answer instead of a refusal */
    if (has("how ", "what ", "why ", "when ", "which ", "should i", "explain", "difference")) {
        return "Here's how I'd think about that:\n\n" +
            "• If it's about WHERE to invest - start with broad, diversified assets (index ETFs) and match the mix to your risk tolerance and time horizon.\n" +
            "• If it's about HOW MUCH risk - the key drivers are your time horizon, income stability and how you'd react to a 20% drop.\n" +
            "• If it's about WHEN - time in the market beats timing it; compound growth makes early, consistent investing the strongest lever.\n\n" +
            "For a concrete answer, tell me more (e.g. your budget, horizon or goal) and I'll be specific. You can also run the Portfolio Builder, Risk Evaluator or Future Projection sections in the sidebar.";
    }

    /* Final fallback: still helpful, never a flat refusal */
    return "Great question. In general:\n\n" +
        "• Start with an emergency fund (3-6 months of expenses) in cash.\n" +
        "• Core: low-cost, diversified ETFs or index funds across stocks and bonds.\n" +
        "• Match your stock/bond split to your time horizon - longer horizon allows more stocks.\n" +
        "• Rebalance once a year and keep costs low; costs compound too.\n" +
        "• Speculative assets (crypto, single hot stocks) only in small slices you can afford to lose.\n\n" +
        "Ask me to go deeper on any of these - stocks, bonds, ETFs, diversification, risk, compound growth, projections, inflation or rebalancing - or use the sidebar sections for a full analysis.";
}

/* ============================================================
   INVESTMENT TOPIC GUARD
   The chat should only answer investment / finance questions.
   ============================================================ */

const INVESTMENT_KEYWORDS = [
    // asset classes & products
    "stock", "stocks", "share", "shares", "equity", "equities",
    "bond", "bonds", "etf", "etfs", "mutual fund", "index fund",
    "reit", "reits", "commodit", "gold", "silver", "crypto",
    "bitcoin", "btc", "ethereum", "eth", "satoshi", "token",
    "option", "options", "futures", "forex", "currency trading",
    "cash equivalent", "money market", "treasury", "t-bill",
    "hedge fund", "private equity", "crowdfunding",
    // portfolio concepts
    "portfolio", "diversif", "allocation", "asset allocation",
    "rebalanc", "position", "holding", "holdings", "exposure",
    "hedge", "hedging", "dollar cost", "dca", "lump sum",
    // risk & metrics
    "risk", "volatil", "beta", "sharpe", "drawdown", "var ",
    "standard deviation", "correlation", "diversification risk",
    "risk tolerance", "risk profile", "risk score",
    // returns & growth
    "return", "returns", "roi", "cagr", "compound", "compounding",
    "interest", "dividend", "dividends", "yield", "capital gain",
    "capital gains", "profit", "loss", "appreciation",
    // analysis & strategy
    "invest", "investor", "investing", "investment", "investments",
    "trading", "trade", "trader", "bull", "bear", "bullish",
    "bearish", "market", "markets", "screener", "screening",
    "valuation", "p/e", "pe ratio", "earnings", "fundamental",
    "technical analysis", "chart pattern", "momentum",
    "value investing", "growth investing", "index",
    "budget", "saving", "savings", "emergency fund", "net worth",
    "retirement", "401k", "401(k)", "ira", "roth", "pension",
    "financial goal", "financial plan", "wealth", "passive income",
    "inflation", "recession", "interest rate", "fed", "tax",
    "taxes", "tax-advantaged", "liquidity", "margin", "leverage",
    "broker", "brokerage", "diversified", "allocation strategy"
];

function isInvestmentRelated(text) {
    const normalized =
        " " + String(text || "").toLowerCase() + " ";

    return INVESTMENT_KEYWORDS
        .some(keyword => normalized.includes(keyword));
}

/*
 * True when the message is a short follow-up that only makes sense
 * in the context of the previous conversation, e.g. "Why is it
 * important?", "Tell me more", "What about bonds?". These carry no
 * topic of their own, so the guard re-checks them against recent
 * history instead of refusing them outright. Longer, self-contained
 * questions are never treated as follow-ups.
 */
const FOLLOW_UP_PATTERNS = [
    /^(why|how|what)( i|'s| is| are| do| does|'d| would| can| about)?\s+(it|its|this|that|they|them|their|these|those|he|she)\b/,
    /^(elaborate|expand|clarify|repeat|continue|go on|more)\b/,
    /^(tell|say|explain|describe)\b.*\b(more|further|detail|it|that|this|them)\b/,
    /^(it|this|that|they|those|these)\b/,
    /^(and|also|again|then)\b/,
    /^(is|are|was|were|can|could|would|should|do|does|did)\s+(it|this|that|they|them|there)\b/,
    /^(what|which)\s+(about|else|next|of (it|that|this|them))\b/,
    /^(please|kindly|thanks?|thank you)\b/,
    /^(give|show)( me)?\s+(an?|some|one|examples?|more)\b/,
    /^(examples?|advantages?|disadvantages?|benefits?|pros|cons)\b/,
    /^(what|which)\s+(are|is)\s+(the\s+)?(benefits?|advantages?|disadvantages?|pros|cons|risks?|examples?)/,
    /\b(benefits?|advantages?|drawbacks?|pros|cons|examples?)\s+of\s+(it|this|that|them)\b/,
    /\b(in more detail|more detail|more about it|explain (it|that|this|more)|why is it|why are they)\b/
];

function isContextualFollowUp(text) {
    const normalized =
        String(text || "").toLowerCase().trim();

    if (!normalized || normalized.split(/\s+/).length > 25) {
        return false;
    }

    return FOLLOW_UP_PATTERNS
        .some(pattern => pattern.test(normalized));
}

/* ============================================================
 * FORMAT FOLLOW-UPS (additive feature)
 *
 * "Give the answer in bullet form/points" -> reformat the
 * PREVIOUS answer into bullet points (same content, not a new
 * answer). "In short" -> condense the previous answer.
 *
 * These requests carry no topic of their own, so they only apply
 * when the question is purely formatting language AND a previous
 * assistant answer exists in the conversation context.
 * ============================================================ */

const BULLET_FORMAT_PATTERNS = [
    /\bbullets?\b/,
    /\bbullet ?points?\b/,
    /\bin (bullet|point|list|numbered|tabular) (form|format|wise|style)\b/,
    /\bas points?\b/,
    /\bpoint ?wise\b/,
    /\bin points?\b/,
    /\blist (form|format)\b/,
    /\bnumbered (form|format|list|points?)\b/,
    /\bsteps? (form|format|wise)\b/,
    /^(give|show|present|write|answer|reply|respond|format|convert)\b.*(\bbullets?\b|\bpoints?\b|\blist\b)/
];

const SHORTEN_PATTERNS = [
    /\bin short\b/,
    /\bshort(er)? (form|answer|version|summary|reply)\b/,
    /\bbriefly\b/,
    /\bsummari[sz]e\b/,
    /\bsummary\b/,
    /\btl;?dr\b/,
    /\bto the point\b/,
    /\bkeep it short\b/,
    /\bconcise(ly)?\b/,
    /\bshort me\b/
];

function matchesAnyPattern(text, patterns) {
    const normalized =
        String(text || "").toLowerCase().trim();

    if (!normalized) {
        return false;
    }

    return patterns
        .some(pattern => pattern.test(normalized));
}

function isBulletFormatRequest(text) {
    const normalized =
        String(text || "").toLowerCase().trim();

    if (!normalized || normalized.split(/\s+/).length > 15) {
        return false;
    }

    return matchesAnyPattern(normalized, BULLET_FORMAT_PATTERNS);
}

function isShortenRequest(text) {
    const normalized =
        String(text || "").toLowerCase().trim();

    if (!normalized || normalized.split(/\s+/).length > 15) {
        return false;
    }

    return matchesAnyPattern(normalized, SHORTEN_PATTERNS);
}

/*
 * Reformat an existing answer into bullet points WITHOUT changing
 * its content: existing markers/numbering are stripped, the text is
 * split into sentences, and every sentence becomes one bullet.
 */
function reformatAsBullets(previousAnswer) {
    /* Strip previous format headers so re-bulleting a bulleted or
     * summarized answer never nests the wrapper text. */
    const source = String(previousAnswer || "")
        .replace(/^Here it is in bullet points:\s*/i, "")
        .replace(/^In short:\s*/i, "")
        .trim();

    if (!source) {
        return null;
    }

    /*
     * If the answer is already in bullet form, present it as-is —
     * the content must not change.
     */
    const rawLines = source
        .split(/\n/)
        .map(line => line.trim())
        .filter(Boolean);

    const markerLines = rawLines
        .filter(line => /^([-•*]|\d+[.)])\s/.test(line));

    if (markerLines.length >= 2) {
        return (
            "Here it is in bullet points:\n\n" +
            markerLines.join("\n")
        );
    }

    /*
     * Prose answer: flatten, strip any stray markers, then split
     * into sentences. Each sentence becomes one bullet — no content
     * is added, removed or reworded.
     */
    const flattened = source
        .replace(/^(\s*)([-•*]|\d+[.)])\s+/gm, "$1")
        .replace(/\n+/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();

    const sentences = flattened
        .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
        .map(sentence => sentence.trim())
        .filter(Boolean);

    if (!sentences.length) {
        return null;
    }

    return (
        "Here it is in bullet points:\n\n" +
        sentences.map(sentence => "• " + sentence).join("\n")
    );
}

/*
 * Condense the previous answer to its first 1-2 key points WITHOUT
 * generating new content.
 */
function shortenPreviousAnswer(previousAnswer) {
    /* Strip previous format headers so summarizing a bulleted or
     * summarized answer summarizes the CONTENT, not the wrapper. */
    const source = String(previousAnswer || "")
        .replace(/^Here it is in bullet points:\s*/i, "")
        .replace(/^In short:\s*/i, "")
        .trim();

    if (!source) {
        return null;
    }

    /*
     * Bulleted answer: take the first two bullets only.
     */
    const bulletLines = source
        .split(/\n/)
        .map(line => line.trim())
        .filter(line => /^([-•*]|\d+[.)])\s/.test(line));

    if (bulletLines.length >= 2) {
        return (
            "In short: " +
            bulletLines
                .slice(0, 2)
                .map(line => line.replace(/^([-•*]|\d+[.)])\s+/, ""))
                .join(" ")
        );
    }

    /*
     * Prose answer: first two sentences only.
     */
    const flattened = source
        .replace(/^([-•*]|\d+[.)])\s+/gm, "")
        .replace(/\n+/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();

    const sentences = flattened
        .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
        .map(sentence => sentence.trim())
        .filter(Boolean);

    if (!sentences.length) {
        return null;
    }

    return (
        "In short: " +
        sentences.slice(0, 2).join(" ")
    );
}

/* ============================================================
 * POINT REFERENCES ("elaborate point 1", "explain point 2",
 * "the first point", "this point") AND mixed messages that
 * QUOTE a previous point ("1. Predictable, steady income.
 * elaborate it"). These must resolve against the points of the
 * PREVIOUS answer, not be treated as standalone questions.
 * ============================================================ */

const POINT_NUMBER_WORDS = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
    seven: 7, eight: 8, nine: 9, ten: 10,
    first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
    "1st": 1, "2nd": 2, "3rd": 3, "4th": 4, "5th": 5
};

function resolvePointNumber(value) {
    const v = String(value || "").toLowerCase().trim();

    if (/^\d+$/.test(v)) {
        return parseInt(v, 10) || 0;
    }

    return POINT_NUMBER_WORDS[v] || 0;
}

const POINT_REFERENCE_PATTERNS = [
    /\b(?:point|points|item|items|option|number|bullet|bullets)\s*(?:#|no\.?|number)?\s*\d{1,2}\b/,
    /\b(?:point|item|option|bullet)\s+(?:one|two|three|four|five|first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)\b/,
    /\b(?:first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)\s+(?:point|item|option|bullet|one)\b/,
    /\b(?:this|that|the)\s+points?\b/,
    /^(?:elaborate|explain|describe|expand|clarify|detail|tell me more)\b[\s\S]*\bpoint\b/
];

function isPointReferenceRequest(text) {
    const normalized =
        String(text || "").toLowerCase().trim();

    if (!normalized || normalized.split(/\s+/).length > 30) {
        return false;
    }

    return POINT_REFERENCE_PATTERNS
        .some(pattern => pattern.test(normalized));
}

/*
 * Split the PREVIOUS answer into its numbered/bulleted points.
 * Returns an array of point texts (markers stripped), in order.
 */
function extractPreviousAnswerPoints(previousAnswer) {
    const source =
        String(previousAnswer || "").trim();

    if (!source) {
        return [];
    }

    const points = [];

    for (const rawLine of source.split(/\n/)) {
        const line = rawLine.trim();

        if (!line) {
            continue;
        }

        const markerMatch =
            line.match(/^([-•*]|\d{1,2}[.)])\s*(.+)/);

        if (markerMatch && markerMatch[2]) {
            points.push(markerMatch[2].trim());
        } else if (points.length) {
            /* Continuation line belongs to the previous point. */
            points[points.length - 1] += " " + line;
        }
    }

    return points.filter(Boolean);
}

/*
 * Find which point (1-based) the text refers to, e.g.
 * "elaborate point 1" -> 1, "explain the second point" -> 2.
 */
function getPointIndex(text) {
    const t =
        String(text || "").toLowerCase();

    let match = t.match(
        /\b(?:points?|items?|options?|numbers?|bullets?)\s*(?:#|no\.?|number)?\s*(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)\b/
    );

    if (!match) {
        match = t.match(
            /\b(one|two|three|four|five|six|seven|eight|nine|ten|first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)\s+(?:point|points|item|option|bullet|one)\b/
        );
    }

    if (match) {
        return resolvePointNumber(match[1]);
    }

    /*
     * "elaborate this point" / "explain that point": no number is
     * given, so the referenced point defaults to the FIRST point of
     * the previous answer.
     */
    if (/\b(?:this|that|the)\s+points?\b/.test(t)) {
        return 1;
    }

    return 0;
}

/*
 * Detect a message that LEADS with a quoted point reference,
 * e.g. "1. Predictable, steady income. elaborate it" or
 * "Point 2: lower volatility — explain it". Returns the point
 * number and the rest of the message, or null.
 */
function extractPointReference(text) {
    const normalized =
        String(text || "").trim();

    if (!normalized || normalized.split(/\s+/).length > 40) {
        return null;
    }

    const match = normalized.match(
        /^(?:point\s*|item\s*|option\s*|number\s*)?#?\s*(\d{1,2}|one|two|three|four|five|first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)\s*[.):,\-]?\s+([\s\S]+)$/i
    );

    if (!match) {
        return null;
    }

    const index = resolvePointNumber(match[1]);

    return index ? { index, rest: match[2].trim() } : null;
}

/*
 * True when the TAIL of a mixed message (the part after a quoted
 * point) is itself a follow-up request, e.g. "...steady income.
 * elaborate it" or "...lower volatility. give it in bullets".
 */
function isFollowUpTailText(text) {
    const normalized =
        String(text || "").toLowerCase().trim();

    if (!normalized) {
        return false;
    }

    const sentences = normalized.split(/(?<=[.!?])\s+/);
    const tail = sentences[sentences.length - 1].trim();

    if (!tail) {
        return false;
    }

    return (
        isElaborationRequest(tail) ||
        isPointReferenceRequest(tail) ||
        isContextualFollowUp(tail) ||
        isBulletFormatRequest(tail) ||
        isShortenRequest(tail)
    );
}

/*
 * Answer a point reference: quote the requested point from the
 * previous answer and expand ONLY that point.
 */
function buildPointReferenceAnswer(pointIndex, previousAnswer, previousQuestion) {
    const points =
        extractPreviousAnswerPoints(previousAnswer);

    if (!points.length || !pointIndex) {
        return null;
    }

    if (pointIndex > points.length) {
        return (
            "The previous answer has " + points.length +
            " point(s). Tell me which one to elaborate — " +
            "for example \"elaborate point 1\"."
        );
    }

    const point = points[pointIndex - 1];

    const topic = findTopicInText(
        String(previousQuestion || "") + " " +
        String(previousAnswer || "") + " " + point
    );

    const contextName = topic ? topic.name : "this topic";

    return (
        "Point " + pointIndex + ": " + point + "\n\n" +
        "More on this, in the context of " + contextName + ":\n\n" +
        "• What it means: this is one of the practical reasons " +
        (topic ? "people use " + topic.name : "investors care about this") +
        " — it works consistently over time, not just in ideal market conditions.\n" +
        "• How it plays out: in practice you capture it by staying " +
        "invested according to your plan, matching the choice to your " +
        "risk tolerance and time horizon.\n" +
        "• Trade-off to keep in mind: no single point from the list is " +
        "guaranteed — it depends on the instrument, costs, taxes and " +
        "market conditions, so weigh it against the corresponding risk.\n\n" +
        "Ask me to elaborate another point (e.g. \"point 2\") or to go " +
        "deeper on " + contextName + "."
    );
}

const INVESTMENT_REFUSAL =
    "I can only help with investment-related questions.";

const DETAILED_SUFFIX =
    "\n\nPlease give an in-depth explanation: go beyond the basics, use " +
    "concrete examples and numbers where useful, break the answer into " +
    "short sections, and mention the main risks and trade-offs.";

const SHORT_SUFFIX =
    "\n\nPlease keep the answer brief: 2-3 sentences maximum, no sections " +
    "or lists, just the key point.";

/*
 * Investment preferences (risk level / horizon) from the Settings
 * page, included with every question so answers match the profile.
 */
function getPreferenceSuffix() {
    const riskLabels = {
        conservative: "conservative (capital preservation first)",
        moderate: "moderate (balanced risk and return)",
        aggressive: "aggressive (higher risk, higher potential return)"
    };

    const risk =
        riskLabels[chatSettings.riskLevel] ||
        riskLabels.moderate;

    return (
        "\n\nPersonalization: tailor the answer to a " + risk +
        " investor with a " + chatSettings.horizon +
        " investment horizon."
    );
}

/*
 * Number of previous chat messages (user + assistant) sent as
 * conversation context with each new question.
 */
const CHAT_HISTORY_LIMIT = 6;

function getChatHistory() {
    const chat =
        Array.isArray(state.chat)
            ? state.chat
            : [];

    return chat
        .slice(-CHAT_HISTORY_LIMIT)
        .filter(
            msg =>
                msg &&
                typeof msg.content === "string" &&
                (msg.role === "user" || msg.role === "assistant")
        )
        .map(msg => ({
            role: msg.role,
            content: msg.content.slice(0, 2000)
        }));
}

async function askQuestion(question, options = {}) {
    const cleanQuestion =
        String(question || "").trim();

    if (!cleanQuestion) {
        return "Please enter a question.";
    }

    /*
     * Response Detail from Settings (default Medium).
     * The 📖 More detail button can still force the detailed
     * suffix regardless of the setting.
     */
    const detailed =
        options.detailed === true ||
        chatSettings.responseDetail === "detailed";

    const short =
        !detailed &&
        options.detailed !== true &&
        chatSettings.responseDetail === "short";

    /*
     * Follow-up Context from Settings: when OFF, no previous
     * conversation is sent, so every question is answered on
     * its own and follow-ups cannot lean on prior topics.
     */
    const history =
        chatSettings.followUpContext
            ? (Array.isArray(options.history)
                ? options.history
                : getChatHistory())
            : [];

    /*
     * Investment-only guard: politely refuse anything that is
     * clearly not an investment/finance question, before it ever
     * reaches the AI server or the local answer engine.
     *
     * The question alone is checked first. Short follow-ups such as
     * "Why is it important?" or "Tell me more" carry no topic words,
     * so only those are re-checked against the recent conversation
     * to see whether they refer to an earlier investment topic.
     * Full-history text is never blended into the question itself —
     * that would let stray investment keywords from old answers make
     * every later off-topic question pass the guard.
     *
     * A refusal only blocks the current message; the conversation,
     * its history and the input stay fully active afterwards.
     */
    /*
     * A message may also LEAD with a quoted point from the previous
     * answer ("1. Predictable, steady income. elaborate it") — the
     * leading number/point text is stripped before classifying the
     * rest as a follow-up.
     */
    const pointReference =
        extractPointReference(cleanQuestion);

    const questionIsFollowUp =
        history.length > 0 &&
        (
            isContextualFollowUp(cleanQuestion) ||
            isBulletFormatRequest(cleanQuestion) ||
            isShortenRequest(cleanQuestion) ||
            isElaborationRequest(cleanQuestion) ||
            isPointReferenceRequest(cleanQuestion) ||
            (pointReference && isFollowUpTailText(pointReference.rest))
        );

    /*
     * STRICT investment-only guard (always on): any question that is
     * not investment-related is refused.
     */
    if (
        !isInvestmentRelated(cleanQuestion) &&
        !(
            questionIsFollowUp &&
            history.some(entry => isInvestmentRelated(entry.content))
        )
    ) {
        /*
         * Refuse this message only. Nothing is reset: state.chat,
         * the rendered messages and the elaboration context are all
         * left untouched, so the user can immediately continue with
         * an investment question.
         */
        return INVESTMENT_REFUSAL;
    }

    /*
     * CONTEXT-AWARE FOLLOW-UP HANDLING:
     * Elaborate / explain more / tell me more / in detail / in short /
     * summarize / give in bullet points / give an example — all of
     * these are resolved HERE, against the immediately previous
     * conversation context, BEFORE anything reaches the chat server
     * (which has no conversation context of its own and would return
     * a generic answer).
     *
     * Only PURE follow-ups (no investment topic named in the question
     * itself) are handled this way. Questions that also name a topic
     * (e.g. "In short, what is diversification?") fall through to the
     * normal pipeline so intent detection stays intact.
     */
    const previousAssistant = [...history]
        .reverse()
        .find(
            entry =>
                entry &&
                entry.role === "assistant" &&
                typeof entry.content === "string"
        );

    const previousUserEntry = [...history]
        .reverse()
        .find(
            entry =>
                entry &&
                entry.role === "user" &&
                typeof entry.content === "string"
        );

    const previousAnswer = previousAssistant
        ? previousAssistant.content
        : "";

    const previousQuestion = previousUserEntry
        ? previousUserEntry.content
        : "";

    conversationContext.previousQuestion = previousQuestion;
    conversationContext.previousAnswer = previousAnswer;

    /*
     * A question that names a topic updates the active context even
     * when the answer comes from outside the local intent engine
     * (server / keyword path), so pronoun follow-ups can never
     * resolve to a stale earlier topic.
     */
    const namedTopic = findTopicInText(cleanQuestion);

    if (namedTopic) {
        rememberTopicInContext(namedTopic);
    }

    /*
     * Pure follow-up = the question carries no investment topic of
     * its own (topic resolution, NOT the keyword list — e.g. "bull"
     * inside "bullet" must not make "Give in bullet point" look like
     * a topical question).
     */
    /*
     * Pure follow-up = the question carries no investment topic of
     * its own. For mixed messages that quote a previous point, the
     * QUOTED POINT TEXT is ignored for topic resolution — the topic
     * comes from the previous conversation, exactly like "it" or
     * "that" would.
     */
    const followUpText =
        pointReference ? pointReference.rest : cleanQuestion;

    const isPureFollowUp =
        questionIsFollowUp &&
        !findTopicInText(followUpText);

    /*
     * "Elaborate point 1" / "Explain point 2" / "The first point" /
     * "1. Predictable, steady income. elaborate it": expand ONLY the
     * referenced point of the PREVIOUS answer.
     */
    if (isPureFollowUp) {
        const pointIndex =
            (pointReference && pointReference.index) ||
            getPointIndex(followUpText);

        if (
            pointIndex &&
            (
                isPointReferenceRequest(cleanQuestion) ||
                (pointReference && isFollowUpTailText(pointReference.rest))
            )
        ) {
            const pointAnswer = buildPointReferenceAnswer(
                pointIndex,
                previousAnswer,
                previousQuestion
            );

            if (pointAnswer) {
                return pointAnswer;
            }
        }
    }

    /*
     * "Give it in bullet points/form": reformat the PREVIOUS answer
     * ONLY — same content, no new topics or generic advice.
     */
    if (isPureFollowUp && isBulletFormatRequest(cleanQuestion)) {
        const reformatted =
            reformatAsBullets(previousAnswer);

        if (reformatted) {
            return reformatted;
        }

        return (
            "Ask an investment question first — then I can " +
            "reformat that answer in bullet points."
        );
    }

    /*
     * "In short" / "summarize": condense the PREVIOUS answer.
     */
    if (isPureFollowUp && isShortenRequest(cleanQuestion)) {
        const shortened =
            shortenPreviousAnswer(previousAnswer);

        if (shortened) {
            return shortened;
        }

        return (
            "Ask an investment question first — then I can " +
            "summarize that answer."
        );
    }

    /*
     * "Elaborate it" / "Explain more" / "Tell me more" / "In detail":
     * expand the previous answer with new information about the same
     * topic.
     */
    if (isPureFollowUp && isElaborationRequest(cleanQuestion)) {
        const elaborated =
            getElaborationAnswer(previousQuestion, previousAnswer);

        if (elaborated) {
            return elaborated;
        }
    }

    /*
     * All other pure follow-ups ("Why is it important?", "Give an
     * example", ...) are answered by the local engine, which resolves
     * the topic and intent from the conversation context. They must
     * not be sent to the chat server — it has no context and would
     * answer generically.
     */
    if (isPureFollowUp) {
        return getLocalAnswer(cleanQuestion, history);
    }

    /*
     * Build the message sent to the answer engine. Conversation
     * context is included so follow-up questions make sense, and
     * an elaboration instruction is appended when the user asks
     * for more detail.
     */
    let message = cleanQuestion;

    if (history.length) {
        const contextBlock = history
            .map(entry => entry.role + ": " + entry.content)
            .join("\n");

        const isFollowUp = questionIsFollowUp;

        message =
            "Recent conversation for context (do not repeat it, use it only " +
            "if relevant):\n" +
            contextBlock +
            "\n\n" +
            (isFollowUp
                ? "The new question is a short follow-up. Resolve \"it\"/\"this\"/\"that\" " +
                  "to the most recent investment topic from the context above.\n"
                : "") +
            "Answer the new question directly and specifically — do not repeat, " +
            "restate or rephrase the previous answer.\n\nNew question: " +
            cleanQuestion;
    }

    if (detailed) {
        message += DETAILED_SUFFIX;
    } else if (short) {
        message += SHORT_SUFFIX;
    }

    message += getPreferenceSuffix();

    /*
     * Try the local Node.js chat server
     * (Ollama) first, then fall back to
     * the built-in rule-based answers.
     */
    try {
        const response = await fetch(
            `${API_URL}/api/chat`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    message,
                    history,
                    detailed
                })
            }
        );

        const data = await response.json();

        if (response.ok && data && data.answer) {
            return String(data.answer);
        }
    } catch (error) {
        console.warn(
            "Chat server unavailable, using local answers.",
            error
        );
    }

    /*
     * Local fallback answer. Note: getPreferenceSuffix() is NOT
     * appended here — internal instructions like "Personalization:
     * tailor the answer..." must never be shown to the user.
     */
    const localAnswer =
        getLocalAnswer(cleanQuestion, history);

    if (detailed) {
        return (
            localAnswer +
            "\n\nMore detail: " +
            "consider how this fits your risk tolerance, time horizon, " +
            "liquidity needs and overall diversification. The rules above " +
            "are general guidelines, not personalized advice."
        );
    }

    return localAnswer;
}

/* ============================================================
   CHAT MESSAGE RENDERING
   ============================================================ */

function addChatMessage(
    role,
    content,
    save = true
) {
    const messages =
        $("chatMessages");

    if (!messages) {
        return;
    }

    const wrapper =
        document.createElement("div");

    wrapper.className =
        `chat-message ${role}`;

    const bubble =
        document.createElement("div");

    bubble.className =
        "chat-bubble";

    /*
     * textContent is intentional.
     * It prevents AI responses from injecting HTML.
     */
    bubble.textContent =
        String(content || "");

    wrapper.appendChild(
        bubble
    );

    messages.appendChild(
        wrapper
    );

    messages.scrollTop =
        messages.scrollHeight;

    if (save) {
        state.chat.push({
            role:
                role === "user"
                    ? "user"
                    : "assistant",

            content:
                String(content || ""),

            timestamp:
                new Date().toISOString()
        });

        saveState();
    }
}


/* ============================================================
   TYPING INDICATOR
   ============================================================ */

function showTypingIndicator() {
    const messages =
        $("chatMessages");

    if (!messages) {
        return;
    }

    if ($("typingIndicator")) {
        return;
    }

    const wrapper =
        document.createElement("div");

    wrapper.id =
        "typingIndicator";

    wrapper.className =
        "chat-message assistant";

    wrapper.innerHTML = `
        <div class="chat-bubble typing">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;

    messages.appendChild(
        wrapper
    );

    messages.scrollTop =
        messages.scrollHeight;
}


function hideTypingIndicator() {
    const indicator =
        $("typingIndicator");

    if (indicator) {
        indicator.remove();
    }
}


/* ============================================================
   CHAT FORM
   ============================================================ */

let chatRequestRunning = false;

/*
 * Last question/answer in the Analytics Chat, used by the
 * "Explain in more detail" elaboration action.
 */
let chatLastQuestion = "";
let chatLastAnswer = "";

async function handleChat(
    event,
    options = {}
) {
    if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
    }

    /*
     * Prevent two requests from being sent
     * at exactly the same time.
     */
    if (chatRequestRunning) {
        return;
    }

    /*
     * The elaboration action supplies its own question, so it
     * works without touching the text input.
     */
    const explicitQuestion =
        typeof options.question === "string"
            ? options.question.trim()
            : "";

    const input =
        $("chatInput");

    if (!explicitQuestion && !input) {
        console.error(
            "chatInput element not found."
        );

        return;
    }

    const question =
        explicitQuestion || input.value.trim();

    if (!question) {
        return;
    }

    /*
     * Display user's question immediately.
     */
    addChatMessage(
        "user",
        question
    );

    if (input && !explicitQuestion) {
        input.value = "";
    }

    if (input) {
        input.disabled = true;
    }

    chatRequestRunning = true;

    showTypingIndicator();

    try {
        const answer =
            await askQuestion(
                question,
                options
            );

        hideTypingIndicator();

        addChatMessage(
            "assistant",
            answer
        );

        chatLastQuestion =
            question;

        chatLastAnswer =
            answer;

    } catch (error) {
        hideTypingIndicator();

        console.error(
            "Chat handling error:",
            error
        );

        addChatMessage(
            "assistant",
            "Something went wrong while processing your question."
        );

    } finally {
        chatRequestRunning = false;

        if (input) {
            input.disabled = false;

            input.focus();
        }
    }
}


/* ============================================================
   CHAT CLEAR
   ============================================================ */

function clearChat() {
    const messageCount =
        Array.isArray(state.chat)
            ? state.chat.length
            : 0;

    state.chat = [];

    saveState();

    /*
     * Reset the elaboration context — there is no previous
     * answer to explain once the chat is cleared.
     */
    chatLastQuestion = "";

    chatLastAnswer = "";

    const messages =
        $("chatMessages");

    if (!messages) {
        showToast(
            "Chat cleared.",
            "🧹"
        );

        return;
    }

    messages.innerHTML = "";

    addChatMessage(
        "assistant",
        "👋 Chat cleared — starting fresh! I'm your investment assistant. Ask me about portfolios, diversification, risk, asset classes like stocks, bonds, ETFs and REITs, global markets or future projections. Please keep questions investment-related — and try the 📖 More detail button for deeper explanations.",
        false
    );

    /*
     * Make the clear action explicit: say what was removed
     * and that it is gone for good.
     */
    showToast(
        messageCount > 0
            ? `🧹 Chat cleared — ${messageCount} ${
                  messageCount === 1 ? "message" : "messages"
              } removed. Previous messages are not recoverable.`
            : "🧹 Chat cleared.",
        "🧹"
    );
}


/* ============================================================
   RESTORE CHAT
   ============================================================ */

function restoreChat() {
    const messages =
        $("chatMessages");

    if (!messages) {
        return;
    }

    /*
     * Chat always opens fresh. Any conversation saved from a
     * previous session is moved into the History section
     * (one entry per question/answer pair) instead of being
     * re-rendered inside the chat window.
     */
    if (Array.isArray(state.chat) && state.chat.length) {
        for (let i = 0; i < state.chat.length; i++) {
            const msg = state.chat[i];

            if (!msg || !msg.content) continue;

            if (msg.role === "user") {
                const answer = state.chat[i + 1];
                recordHistory(
                    "chat",
                    msg.content,
                    answer && answer.content
                        ? answer.content
                        : ""
                );
                i++; // skip the paired answer
            }
        }

        state.chat = [];
        saveState();
    }

    messages.innerHTML = "";

    addChatMessage(
        "assistant",
        "👋 Welcome back! I'm your investment assistant. Ask me about portfolios, diversification, risk, asset classes like stocks, bonds, ETFs and REITs, global markets or future projections. Please keep questions investment-related — and try the 📖 More detail button for deeper explanations.",
        false
    );
}


/* ============================================================
   CHAT FORM INITIALIZATION
   ============================================================ */

function initChat() {
    const chatForm =
        $("chatForm");

    if (chatForm) {
        chatForm.addEventListener(
            "submit",
            handleChat
        );
    }

    /*
     * Some dashboards use a button instead
     * of a form submit.
     */
    const sendButton =
        $("sendChatBtn");

    if (
        sendButton &&
        !chatForm
    ) {
        sendButton.addEventListener(
            "click",
            handleChat
        );
    }

    /*
     * Quick-question (suggestion) buttons.
     * Fill the input with the preset question
     * and submit the chat form.
     */
    const suggestionButtons =
        document.querySelectorAll(
            ".suggestion-btn"
        );

    suggestionButtons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const presetQuestion =
                    button.dataset.question;

                if (!presetQuestion) {
                    return;
                }

                const chatInput =
                    $("chatInput");

                if (chatInput) {
                    chatInput.value =
                        presetQuestion;
                }

                const currentForm =
                    $("chatForm");

                if (currentForm) {
                    currentForm.requestSubmit();
                } else {
                    handleChat();
                }
            }
        );
    });

    const clearButton =
        $("clearChatBtn");

    if (clearButton) {
        clearButton.addEventListener(
            "click",
            () => {

                /*
                 * Confirm before clearing — clearing the chat
                 * permanently removes the conversation.
                 */
                if (
                    Array.isArray(state.chat) &&
                    state.chat.length &&
                    !confirm(
                        "Clear the chat? All messages in this conversation " +
                        "will be removed permanently."
                    )
                ) {
                    showToast(
                        "Chat clear cancelled.",
                        "↩️"
                    );

                    return;
                }

                clearChat();
            }
        );
    }

    /*
     * "Explain in more detail" — re-asks the last investment
     * question with the elaboration flag, keeping full
     * conversation context so the follow-up makes sense.
     */
    const moreDetailButton =
        $("chatMoreDetailBtn");

    if (moreDetailButton) {
        moreDetailButton.addEventListener(
            "click",
            () => {
                if (chatRequestRunning) {
                    return;
                }

                if (!chatLastQuestion) {
                    showToast(
                        "Ask an investment question first, then request more detail.",
                        "📖"
                    );

                    return;
                }

                const followUp =
                    "Please explain your previous answer in more detail.";

                addChatMessage(
                    "user",
                    followUp
                );

                handleChat(
                    null,
                    {
                        question: followUp,
                        detailed: true
                    }
                );
            }
        );
    }

    const input =
        $("chatInput");

    if (input) {

        /*
         * Enter = send
         * Shift + Enter = new line
         */
        input.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter" &&
                    !event.shiftKey
                ) {
                    event.preventDefault();

                    if (
                        chatForm
                    ) {
                        chatForm.requestSubmit();
                    } else {
                        handleChat(event);
                    }
                }
            }
        );
    }
}


/* ============================================================
   REPORT BUTTONS
   ============================================================ */

function initReportButtons() {
    const clearHistoryButton =
        $("clearHistoryBtn");

    if (clearHistoryButton) {
        clearHistoryButton.addEventListener(
            "click",
            clearHistory
        );
    }

    const downloadButton =
        $("downloadReport");

    if (downloadButton) {
        downloadButton.addEventListener(
            "click",
            downloadReport
        );
    }

    const exportButton =
        $("exportReport");

    if (
        exportButton &&
        exportButton !== downloadButton
    ) {
        exportButton.addEventListener(
            "click",
            downloadReport
        );
    }
}


/* ============================================================
   FRESH START / CLEAR SAVED DATA
   ============================================================ */

function resetFormsToDefaults() {
    document
        .querySelectorAll(
            "#portfolioForm, #riskForm, #screenerForm, #predictionForm"
        )
        .forEach(form => {
            if (form && typeof form.reset === "function") {
                form.reset();
            }
        });

    /* Reset the result panels and status badges. */
    const empties = [
        ["portfolioResult", "Enter your portfolio details to generate an allocation."],
        ["riskResult", "Submit the form to evaluate your portfolio risk."],
        ["screenerResult", "Select asset classes and run the screener."],
        ["predictionSummary", "Enter projection details to generate the future analysis."]
    ];

    empties.forEach(([id, message]) => {
        const el = $(id);

        if (el) {
            el.classList.add("empty-result");
            el.innerHTML = `
                <div class="empty-result">
                    <p>${message}</p>
                </div>
            `;
        }
    });

    ["portfolioStatus", "riskStatus", "screenerStatus", "predictionStatus"]
        .forEach(id => {
            const el = $(id);

            if (el) {
                el.textContent = "Ready";
            }
        });

    /* Clear the projection chart and table. */
    const chart = $("predictionChart");

    if (chart) {
        chart.innerHTML = `
            <div class="chart-placeholder">
                <span>📈</span>
                <p>Generate an analysis to display
                the future projection graph.</p>
            </div>
        `;
    }

    const tableBody = $("predictionTableBody");

    if (tableBody) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="table-empty">
                    No projection generated yet.
                </td>
            </tr>
        `;
    }

    updateDashboardStats();
    updateReport();
}

function clearAllSavedData() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.error("Clear data error:", error);
    }

    state = JSON.parse(
        JSON.stringify(defaultState)
    );

    resetFormsToDefaults();

    renderHistory();

    hideConfirmModal();

    showToast(
        "Saved data cleared.",
        "🗑️"
    );
}

function showConfirmModal() {
    const modal = $("confirmModal");

    if (modal) {
        modal.classList.add("show");
        modal.setAttribute(
            "aria-hidden",
            "false"
        );
    }
}

function hideConfirmModal() {
    const modal = $("confirmModal");

    if (modal) {
        modal.classList.remove("show");
        modal.setAttribute(
            "aria-hidden",
            "true"
        );
    }
}

function initClearDataButton() {
    const clearButton =
        $("clearDataBtn");

    if (clearButton) {
        clearButton.addEventListener(
            "click",
            showConfirmModal
        );
    }

    const confirmButton =
        $("confirmClearBtn");

    if (confirmButton) {
        confirmButton.addEventListener(
            "click",
            clearAllSavedData
        );
    }

    const cancelButton =
        $("cancelClearBtn");

    if (cancelButton) {
        cancelButton.addEventListener(
            "click",
            hideConfirmModal
        );
    }

    const modal = $("confirmModal");

    if (modal) {
        modal.addEventListener(
            "click",
            event => {
                if (event.target === modal) {
                    hideConfirmModal();
                }
            }
        );
    }
}

/* ============================================================
   DASHBOARD INITIALIZATION
   ============================================================ */

function initializeDashboard() {

    console.log(
        "Initializing Investment Analytics Dashboard..."
    );

    initTheme();

    initNavigation();

    initForms();

    initChat();

    initChatSettings();

    setupQuickActions();

    initReportButtons();

    initClearDataButton();

    checkBackendHealth();

    /*
     * Open fresh: previous search/form data is
     * NOT restored into the sections. Past runs
     * remain visible only in the History section.
     */
    renderHistory();

    resetFormsToDefaults();

    restoreChat();

    /*
     * Always open on the Dashboard.
     */
    showSection("dashboard");

    /*
     * Reconnect portfolio-derived fields.
     */
    if (state.portfolio) {
        connectPortfolioToRisk();
        connectPortfolioToPrediction();
    }

    /*
     * Draw charts after the page has rendered.
     */
    setTimeout(
        () => {
            renderAllCharts();
        },
        0
    );

    console.log(
        "Dashboard initialized successfully."
    );
}


/* ============================================================
   DOM READY
   ============================================================ */

if (
    document.readyState ===
    "loading"
) {
    document.addEventListener(
        "DOMContentLoaded",
        initializeDashboard
    );
} else {
    initializeDashboard();
}

/* ============================================================
   MISSING INIT FUNCTIONS
   These were referenced by initializeDashboard() but never
   defined, which crashed startup before initChat() could run
   and left the chat form without a submit handler.
   ============================================================ */

function initForms() {
    const formHandlers = [
        ["portfolioForm", handlePortfolio],
        ["riskForm", handleRisk],
        ["screenerForm", handleScreener],
        ["predictionForm", handlePrediction],
    ];

    formHandlers.forEach(([formId, handler]) => {
        const form = $(formId);

        if (form && typeof handler === "function") {
            form.addEventListener("submit", handler);
        }
    });
}

function setupQuickActions() {
    document
        .querySelectorAll(".quick-action-card[data-section]")
        .forEach(card => {
            card.addEventListener("click", () => {
                showSection(card.dataset.section);
            });
        });
}

function buildReportText() {
    const lines = [];
    const divider = "====================";

    lines.push("INVESTAI INVESTMENT REPORT");
    lines.push("Generated: " + new Date().toLocaleString());
    lines.push("");

    lines.push(divider);
    lines.push("PORTFOLIO");
    lines.push(divider);

    if (state.portfolio) {
        lines.push(
            "Budget: " + money(state.portfolio.budget)
        );
        lines.push(
            "Risk Tolerance: " + capitalize(state.portfolio.risk)
        );
        lines.push(
            "Time Horizon: " + state.portfolio.horizon + " years"
        );
        lines.push("Goal: " + (state.portfolio.goal || "N/A"));
    } else {
        lines.push("No portfolio analysis yet.");
    }

    lines.push("");

    lines.push(divider);
    lines.push("RISK EVALUATION");
    lines.push(divider);

    if (state.risk) {
        lines.push(
            "Investor Risk Tolerance: " + capitalize(state.risk.investorRisk)
        );
        lines.push("Horizon: " + state.risk.horizon + " years");
        lines.push("Description: " + (state.risk.description || "N/A"));
    } else {
        lines.push("No risk evaluation yet.");
    }

    lines.push("");

    lines.push(divider);
    lines.push("SCREENER");
    lines.push(divider);

    if (state.screener) {
        lines.push(
            "Asset Classes: " +
                (state.screener.assetClasses || []).join(", ")
        );
        lines.push(
            "Risk Tolerance: " + capitalize(state.screener.risk)
        );
    } else {
        lines.push("No screening analysis yet.");
    }

    lines.push("");

    lines.push(divider);
    lines.push("FUTURE PROJECTION");
    lines.push(divider);

    if (state.prediction) {
        lines.push(
            "Initial: " + money(state.prediction.initial)
        );
        lines.push(
            "Annual Contribution: " +
                money(state.prediction.annualContribution || 0)
        );
        lines.push("Years: " + state.prediction.years);
        lines.push(
            "Risk Profile: " + capitalize(state.prediction.risk)
        );
    } else {
        lines.push("No future projection yet.");
    }

    lines.push("");
    lines.push(
        "Disclaimer: Educational analysis only. Not personalized " +
            "financial advice."
    );

    return lines.join("\n");
}

function downloadReport() {
    try {
        const text = buildReportText();

        const blob = new Blob([text], {
            type: "text/plain;charset=utf-8"
        });

        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");

        link.href = url;

        link.download =
            "investai-report-" +
            new Date().toISOString().slice(0, 10) +
            ".txt";

        document.body.appendChild(link);

        link.click();

        link.remove();

        URL.revokeObjectURL(url);

        showToast("Report downloaded.", "📥");
    } catch (error) {
        console.error("Report download failed:", error);

        showToast("Could not download the report.", "⚠️");
    }
}

function updateReport() {
    try {
        const preview = $("reportPreview");

        if (preview) {
            preview.textContent = buildReportText();
        }

        const statuses = [
            ["reportPortfolioStatus", state.portfolio,
                "Portfolio analyzed" + (state.portfolio
                    ? " (" + money(state.portfolio.budget) + ", " +
                      capitalize(state.portfolio.risk) + ")"
                    : "")],
            ["reportRiskStatus", state.risk,
                state.risk
                    ? "Risk evaluated (" +
                      capitalize(state.risk.investorRisk) + ")"
                    : null],
            ["reportScreenerStatus", state.screener,
                state.screener
                    ? "Screening complete (" +
                      (state.screener.assetClasses || []).length +
                      " asset classes)"
                    : null],
            ["reportPredictionStatus", state.prediction,
                state.prediction
                    ? "Projection generated (" +
                      state.prediction.years + " years)"
                    : null]
        ];

        statuses.forEach(([id, data, message]) => {
            const element = $(id);

            if (!element) return;

            element.textContent =
                message ||
                element.textContent; /* keep default when no data */
        });
    } catch (error) {
        console.error("Report update failed:", error);
    }
}

/* ============================================================
   HELP CHAT WIDGET
   ============================================================ */

(function () {
    const helpButton = document.getElementById("helpChatButton");
    const helpPanel = document.getElementById("helpChatPanel");
    const closeButton = document.getElementById("closeHelpChat");
    const messagesBox = document.getElementById("helpChatMessages");
    const helpForm = document.getElementById("helpChatForm");
    const helpInput = document.getElementById("helpChatInput");

    if (!helpButton || !helpPanel || !messagesBox) {
        return;
    }

    const helpAnswers = {
        "How does portfolio analysis work?":
            "Open the Portfolio Builder, enter your budget, risk tolerance, time horizon and goal, then click Build Portfolio. The app creates a suggested allocation across asset classes and shows it as a chart.",

        "What does my risk score mean?":
            "The Risk Evaluator gives a score from 0 (lowest risk) to 100 (highest risk) with a rating such as Conservative, Moderate or Aggressive. It compares your described portfolio with your stated risk tolerance and time horizon.",

        "How does the future projection graph work?":
            "The Future Projection applies an assumed annual growth rate based on your risk profile (conservative ~4%, moderate ~6%, aggressive ~8%) to your initial investment and yearly contributions, year by year. It is illustrative only, not a guarantee.",

        "How can I export my report?":
            "Click the Export Report button in the top bar, or open the Reports section and click Download Report. Your portfolio, risk, screener and projection results are saved into one text file."
    };

    function addHelpMessage(text, isUser) {
        const message = document.createElement("div");
        message.className = isUser
            ? "chat-message user"
            : "chat-message assistant";
        message.textContent = text;
        messagesBox.appendChild(message);
        messagesBox.scrollTop = messagesBox.scrollHeight;
    }

    function answerQuestion(question) {
        addHelpMessage(question, true);

        setTimeout(() => {
            const answer = helpAnswers[question];

            if (answer) {
                addHelpMessage(answer, false);
                return;
            }

            if (
                typeof isInvestmentRelated === "function" &&
                !isInvestmentRelated(question)
            ) {
                addHelpMessage(
                    "That's outside the dashboard docs, but the Analytics " +
                        "Chat section (💬 in the sidebar) can answer general " +
                        "questions. For dashboard help, try one of the quick " +
                        "buttons below.",
                    false
                );
                return;
            }

            addHelpMessage(
                "I can help with: portfolio analysis, the risk score, " +
                    "the future projection graph, and exporting reports. " +
                    "Try one of the quick buttons below.",
                false
            );
        }, 250);
    }

    helpButton.addEventListener("click", () => {
        helpPanel.classList.toggle("open");
        helpPanel.setAttribute(
            "aria-hidden",
            helpPanel.classList.contains("open") ? "false" : "true"
        );

        if (helpPanel.classList.contains("open") && helpInput) {
            helpInput.focus();
        }
    });

    if (closeButton) {
        closeButton.addEventListener("click", () => {
            helpPanel.classList.remove("open");
            helpPanel.setAttribute("aria-hidden", "true");
        });
    }

    document
        .querySelectorAll("[data-help-question]")
        .forEach(button => {
            button.addEventListener("click", () => {
                answerQuestion(button.dataset.helpQuestion);
            });
        });

    if (helpForm && helpInput) {
        helpForm.addEventListener("submit", event => {
            event.preventDefault();

            const question = helpInput.value.trim();

            if (!question) {
                return;
            }

            answerQuestion(question);
            helpInput.value = "";
        });
    }
})();
