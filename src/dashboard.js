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

const API_URL = "http://localhost:4000";

const STORAGE_KEY =
    "investment_dashboard_local_v5";

const THEME_KEY =
    "investment_dashboard_theme";

/*
   Chat is intentionally NOT restricted to investment questions.

   The backend/Ollama model can answer:
   - Investment questions
   - Programming questions
   - Technology questions
   - Education questions
   - General knowledge
   - Normal conversation
   - Other general questions
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
   FORMATTING
   ============================================================ */

function money(value) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
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

    if (amount >= 1000000000) {
        return `$${(
            amount / 1000000000
        ).toFixed(1)}B`;
    }

    if (amount >= 1000000) {
        return `$${(
            amount / 1000000
        ).toFixed(1)}M`;
    }

    if (amount >= 1000) {
        return `$${(
            amount / 1000
        ).toFixed(1)}K`;
    }

    return `$${Math.round(amount)}`;
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

    prediction:
        "predictionSection",

    chat:
        "chatSection",

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

    prediction: [
        "Future Projection",
        "Visualize illustrative investment growth."
    ],

    chat: [
        "Analytics Chat",
        "Ask questions about investments, technology, education, programming, general knowledge, and more."
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

    setTimeout(
        renderAllCharts,
        100
    );
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

function handlePortfolio(event) {

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

    const allocation =
        getPortfolioAllocation(
            risk
        );

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

function handleRisk(event) {

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

    const calculated =
        calculateRiskScore(
            investorRisk
        );

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

function handlePrediction(event) {

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
            "I couldn't connect to the local AI server. " +
            "Please make sure the Node.js server is running " +
            "on port 4000 and Ollama is running."
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

                "Please make sure your Node.js server " +

                "is running on http://localhost:4000 " +

                "and that Ollama is running."

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

function handleScreener(event) {
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

    state.screener = {
        selected,
        assetClasses: selected,
        risk,
        results: getScreenerResults(
            selected,
            risk
        ),
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

function handlePrediction(event) {
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

    const rows =
        calculateProjection(
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
        prediction: "📈"
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

function getLocalAnswer(question) {
    const text =
        String(question || "").toLowerCase();

    const has = (...words) =>
        words.some(word => text.includes(word));

    if (!text) {
        return "Please enter a question.";
    }

    if (has("hello", "hi ", "hey")) {
        return "Hello! Ask me about portfolio diversification, risk, bonds, ETFs, compound growth or future projections.";
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

    return "I'm a local rule-based assistant, so I know investment topics best. Try asking about diversification, portfolio risk, bonds, ETFs, compound growth, future projections, inflation or rebalancing. You can also use the sections in the sidebar for full analysis.";
}

async function askQuestion(question) {
    const cleanQuestion =
        String(question || "").trim();

    if (!cleanQuestion) {
        return "Please enter a question.";
    }

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
                    message: cleanQuestion
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

    return getLocalAnswer(cleanQuestion);
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

async function handleChat(event) {
    if (event) {
        event.preventDefault();
    }

    /*
     * Prevent two requests from being sent
     * at exactly the same time.
     */
    if (chatRequestRunning) {
        return;
    }

    const input =
        $("chatInput");

    if (!input) {
        console.error(
            "chatInput element not found."
        );

        return;
    }

    const question =
        input.value.trim();

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

    input.value = "";

    input.disabled = true;

    chatRequestRunning = true;

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

    } finally {
        chatRequestRunning = false;

        input.disabled = false;

        input.focus();
    }
}


/* ============================================================
   CHAT CLEAR
   ============================================================ */

function clearChat() {
    state.chat = [];

    saveState();

    const messages =
        $("chatMessages");

    if (!messages) {
        return;
    }

    messages.innerHTML = "";

    addChatMessage(
        "assistant",
        "Hello! Ask me anything. I can discuss investments, finance, programming, technology, education, science, mathematics, general knowledge, and many other topics.",
        false
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

    messages.innerHTML = "";

    if (
        !Array.isArray(state.chat) ||
        state.chat.length === 0
    ) {
        addChatMessage(
            "assistant",
            "Hello! Ask me anything. I can discuss investments, finance, programming, technology, education, science, mathematics, general knowledge, and many other topics.",
            false
        );

        return;
    }

    state.chat.forEach(
        message => {
            if (
                !message ||
                !message.content
            ) {
                return;
            }

            const role =
                message.role === "user"
                    ? "user"
                    : "assistant";

            addChatMessage(
                role,
                message.content,
                false
            );
        }
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
            clearChat
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

    setupQuickActions();

    initReportButtons();

    initClearDataButton();

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
        100
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
