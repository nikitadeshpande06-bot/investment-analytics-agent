/* ============================================================
   GLOBAL MARKETS & WATCHLIST — local, rule-based, no API
   ============================================================ */

(function () {
    "use strict";

    /* ---------- helpers (shared pattern with dashboard.js) ---------- */

    function $(id) {
        return document.getElementById(id);
    }

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function showToast(message, icon) {
        var toastMessage = $("toastMessage");
        var toastIcon = $("toastIcon");
        var toast = $("toast");

        if (!toast) return;

        if (toastMessage) toastMessage.textContent = message;
        if (toastIcon) toastIcon.textContent = icon || "✓";

        toast.classList.add("show");
        setTimeout(function () {
            toast.classList.remove("show");
        }, 3000);
    }

    /* ============================================================
       MARKET CARD SEARCH (Global Markets section)
       ============================================================ */

    function initMarketSearch() {
        var search = $("marketsSearch");
        var grid = $("marketsGrid");
        var noResults = $("marketsNoResults");

        if (!search || !grid) return;

        var cards = Array.prototype.slice.call(
            grid.querySelectorAll(".market-card")
        );

        var activeRegion = "";

        function applyFilter() {
            var query = search.value.trim().toLowerCase();
            var visibleCount = 0;

            cards.forEach(function (card) {
                var haystack = (
                    card.textContent + " " +
                    (card.dataset.keywords || "") + " " +
                    (card.dataset.region || "")
                ).toLowerCase();

                var matchesQuery = !query || haystack.indexOf(query) !== -1;
                var matchesRegion = !activeRegion ||
                    (card.dataset.region || "") === activeRegion;
                var matches = matchesQuery && matchesRegion;

                card.style.display = matches ? "" : "none";
                if (matches) visibleCount += 1;
            });

            if (noResults) {
                noResults.hidden = visibleCount > 0;
            }
        }

        search.addEventListener("input", applyFilter);

        /* Region filter chips (GM redesign) */
        var chips = document.querySelectorAll(".gm-chip");
        Array.prototype.forEach.call(chips, function (chip) {
            chip.addEventListener("click", function () {
                Array.prototype.forEach.call(chips, function (other) {
                    other.classList.remove("is-active");
                });
                chip.classList.add("is-active");
                activeRegion = chip.dataset.regionFilter || "";
                applyFilter();
            });
        });
    }

    /* ============================================================
       WATCHLIST — saved in localStorage
       ============================================================ */

    var WATCHLIST_KEY = "investai_global_watchlist_v1";

    function loadWatchlist() {
        try {
            var raw = localStorage.getItem(WATCHLIST_KEY);
            var parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }

    function saveWatchlist(entries) {
        try {
            localStorage.setItem(WATCHLIST_KEY, JSON.stringify(entries));
        } catch (error) {
            /* storage unavailable — ignore */
        }
    }

    function renderWatchlist() {
        var tbody = $("watchlistTableBody");
        if (!tbody) return;

        var entries = loadWatchlist();

        if (!entries.length) {
            tbody.innerHTML =
                '<tr><td colspan="6" class="table-empty">' +
                "Your watchlist is empty. Add a stock above." +
                "</td></tr>";
            return;
        }

        tbody.innerHTML = entries.map(function (entry, index) {
            var price = entry.price
                ? escapeHtml(entry.price)
                : "—";

            return "<tr>" +
                "<td><strong>" + escapeHtml(entry.symbol) + "</strong></td>" +
                "<td>" + escapeHtml(entry.country || "—") + "</td>" +
                "<td>" + escapeHtml(entry.sector || "—") + "</td>" +
                "<td>" + price + "</td>" +
                "<td>" + escapeHtml(entry.note || "—") + "</td>" +
                '<td><button class="secondary-btn watchlist-remove" data-index="' +
                index + '" type="button">✕</button></td>' +
                "</tr>";
        }).join("");

        tbody.querySelectorAll(".watchlist-remove").forEach(function (button) {
            button.addEventListener("click", function () {
                var entriesNow = loadWatchlist();
                entriesNow.splice(Number(button.dataset.index), 1);
                saveWatchlist(entriesNow);
                renderWatchlist();
                showToast("Removed from watchlist", "🗑️");
            });
        });
    }

    function initWatchlistForm() {
        var form = $("watchlistForm");
        if (!form) return;

        form.addEventListener("submit", function (event) {
            event.preventDefault();

            var symbol = $("watchlistSymbol");
            var country = $("watchlistCountry");
            var sector = $("watchlistSector");
            var price = $("watchlistPrice");
            var note = $("watchlistNote");

            var entry = {
                symbol: symbol ? symbol.value.trim().toUpperCase() : "",
                country: country ? country.value : "",
                sector: sector ? sector.value.trim() : "",
                price: price ? price.value : "",
                note: note ? note.value.trim() : ""
            };

            if (!entry.symbol) return;

            var entries = loadWatchlist();

            var exists = entries.some(function (item) {
                return item.symbol === entry.symbol;
            });

            if (exists) {
                showToast(entry.symbol + " is already in your watchlist", "⚠️");
                return;
            }

            entries.push(entry);
            saveWatchlist(entries);
            renderWatchlist();
            form.reset();
            showToast(entry.symbol + " added to watchlist", "⭐");
        });

        var clearButton = $("clearWatchlistBtn");
        if (clearButton) {
            clearButton.addEventListener("click", function () {
                saveWatchlist([]);
                renderWatchlist();
                showToast("Watchlist cleared", "🗑️");
            });
        }
    }

    /* ============================================================
       WELL-KNOWN GLOBAL COMPANIES (sample reference data)
       ============================================================ */

    var SAMPLE_COMPANIES = [
        { company: "Apple", symbol: "AAPL", country: "US", sector: "Technology" },
        { company: "Microsoft", symbol: "MSFT", country: "US", sector: "Technology" },
        { company: "Reliance Industries", symbol: "RELIANCE.NS", country: "India", sector: "Energy" },
        { company: "Tata Consultancy Services", symbol: "TCS.NS", country: "India", sector: "Technology" },
        { company: "HDFC Bank", symbol: "HDFCBANK.NS", country: "India", sector: "Banking" },
        { company: "Toyota", symbol: "7203.T", country: "Japan", sector: "Automotive" },
        { company: "Sony", symbol: "6758.T", country: "Japan", sector: "Technology" },
        { company: "Shell", symbol: "SHEL.L", country: "UK", sector: "Energy" },
        { company: "Unilever", symbol: "ULVR.L", country: "UK", sector: "Consumer" },
        { company: "SAP", symbol: "SAP.DE", country: "Germany", sector: "Technology" },
        { company: "Siemens", symbol: "SIE.DE", country: "Germany", sector: "Industrials" },
        { company: "LVMH", symbol: "MC.PA", country: "France", sector: "Luxury" },
        { company: "Tencent", symbol: "0700.HK", country: "China", sector: "Technology" },
        { company: "Samsung Electronics", symbol: "005930.KS", country: "South Korea", sector: "Technology" },
        { company: "Shopify", symbol: "SHOP.TO", country: "Canada", sector: "Technology" },
        { company: "CSL", symbol: "CSL.AX", country: "Australia", sector: "Healthcare" },
        { company: "Vale", symbol: "VALE3.SA", country: "Brazil", sector: "Materials" },
        { company: "Saudi Aramco", symbol: "2222.SR", country: "Saudi Arabia", sector: "Energy" },
        { company: "DBS Group", symbol: "D05.SI", country: "Singapore", sector: "Banking" },
        { company: "Naspers", symbol: "NPN.JO", country: "South Africa", sector: "Technology" }
    ];

    function initSampleStocks() {
        var tbody = $("globalStocksTableBody");
        if (!tbody) return;

        tbody.innerHTML = SAMPLE_COMPANIES.map(function (item, index) {
            return "<tr>" +
                "<td>" + escapeHtml(item.company) + "</td>" +
                "<td><strong>" + escapeHtml(item.symbol) + "</strong></td>" +
                "<td>" + escapeHtml(item.country) + "</td>" +
                "<td>" + escapeHtml(item.sector) + "</td>" +
                '<td><button class="secondary-btn sample-add" data-index="' +
                index + '" type="button">⭐ Add</button></td>' +
                "</tr>";
        }).join("");

        tbody.querySelectorAll(".sample-add").forEach(function (button) {
            button.addEventListener("click", function () {
                var item = SAMPLE_COMPANIES[Number(button.dataset.index)];
                var entries = loadWatchlist();

                var exists = entries.some(function (entry) {
                    return entry.symbol === item.symbol;
                });

                if (exists) {
                    showToast(item.symbol + " is already in your watchlist", "⚠️");
                    return;
                }

                entries.push({
                    symbol: item.symbol,
                    country: item.country,
                    sector: item.sector,
                    price: "",
                    note: "Added from sample list"
                });

                saveWatchlist(entries);
                renderWatchlist();
                showToast(item.company + " added to watchlist", "⭐");
            });
        });
    }

    /* ============================================================
       CHAT ANSWERS — extra rule-based global topics
       ============================================================ */

    var GLOBAL_ANSWERS = [
        {
            keywords: ["exchange", "exchanges", "nyse", "nasdaq", "lse", "world"],
            answer:
                "Major world exchanges include the NYSE and NASDAQ (USA), " +
                "NSE and BSE (India), LSE (UK), TSE (Japan), Shanghai & Shenzhen " +
                "(China), Deutsche Börse (Germany), Euronext (Europe), TSX (Canada), " +
                "ASX (Australia), KRX (South Korea), B3 (Brazil), Tadawul (Saudi " +
                "Arabia), SGX (Singapore) and JSE (South Africa). Each has its own " +
                "trading hours, currency and listed companies."
        },
        {
            keywords: ["international", "invest abroad", "foreign", "global markets"],
            answer:
                "To invest internationally you can: (1) buy ADRs/GDRs of foreign " +
                "companies on your home exchange, (2) use a broker with access to " +
                "foreign markets, or (3) buy global or international index ETFs and " +
                "mutual funds. Always check your country's regulations, taxes and " +
                "the currency exposure you take on."
        },
        {
            keywords: ["nifty", "sensex"],
            answer:
                "NIFTY 50 tracks the 50 largest companies on India's National Stock " +
                "Exchange (NSE), while SENSEX tracks the 30 largest on the Bombay " +
                "Stock Exchange (BSE). Both are headline benchmarks for the Indian " +
                "equity market and include companies like Reliance, TCS, HDFC Bank " +
                "and Infosys."
        },
        {
            keywords: ["emerging market", "emerging markets", "brazil", "indonesia", "vietnam"],
            answer:
                "Emerging markets (India, Brazil, Indonesia, Vietnam, South Africa " +
                "and others) typically offer higher long-term growth but with higher " +
                "volatility, currency risk and political risk. A common approach is " +
                "to keep emerging-market exposure to a moderate slice of a " +
                "diversified portfolio rather than the core."
        },
        {
            keywords: ["currency risk", "forex risk", "exchange rate"],
            answer:
                "Currency risk is the possibility that exchange-rate moves reduce " +
                "your returns from foreign investments. If your home currency " +
                "strengthens against the currency you invested in, your foreign " +
                "gains shrink when converted back. Diversifying across currencies " +
                "and using currency-hedged funds can soften this effect."
        },
        {
            keywords: ["adr", "gdr", "depositary"],
            answer:
                "An ADR (American Depositary Receipt) or GDR (Global Depositary " +
                "Receipt) is a certificate issued by a bank representing shares in " +
                "a foreign company. It lets you buy foreign companies (like Infosys " +
                "or Toyota) on your local exchange in your local currency, without " +
                "opening a foreign brokerage account."
        }
    ];

    function initChatExtensions() {
        var form = $("chatForm");
        var input = $("chatInput");
        var messages = $("chatMessages");

        if (!form || !input || !messages) return;

        function appendMessage(kind, text) {
            var wrapper = document.createElement("div");
            wrapper.className = "chat-message " + kind;
            wrapper.textContent = text;
            messages.appendChild(wrapper);
            messages.scrollTop = messages.scrollHeight;
        }

        function findAnswer(question) {
            var lower = question.toLowerCase();

            for (var i = 0; i < GLOBAL_ANSWERS.length; i += 1) {
                var entry = GLOBAL_ANSWERS[i];
                var hit = entry.keywords.some(function (keyword) {
                    return lower.indexOf(keyword) !== -1;
                });
                if (hit) return entry.answer;
            }

            return null;
        }

        form.addEventListener("submit", function (event) {
            var question = input.value.trim();
            if (!question) return;

            var answer = findAnswer(question);
            if (!answer) return; /* let dashboard.js handle it */

            event.preventDefault();
            appendMessage("user", question);
            appendMessage("assistant", answer);
            input.value = "";
        }, true); /* capture: run before the generic handler */
    }

    /* ============================================================
       INVESTMENT OPTIONS — cards, risk filter, detail panel
       ============================================================ */

    var INVESTMENT_OPTIONS = [
        {
            id: "savings", icon: "🏦", name: "Savings Account", risk: "low",
            ret: "2–4% p.a.", liquidity: "High", horizon: "Any",
            desc: "Bank deposit that earns modest interest while keeping money instantly accessible.",
            detail: "A savings account is the safest place to park cash. Capital is typically government-insured up to a limit, returns are low but guaranteed, and you can withdraw at any time. Best for emergency funds (3–6 months of expenses) and short-term goals."
        },
        {
            id: "fd", icon: "🔒", name: "Fixed Deposit / CD", risk: "low",
            ret: "3–6% p.a.", liquidity: "Low (locked)", horizon: "3 months–5 years",
            desc: "Locked deposit with a fixed interest rate for a fixed term.",
            detail: "Fixed deposits (certificates of deposit) pay a guaranteed rate if you lock your money for a set term. Breaking early usually costs a penalty. Ideal for goals with a known date — tuition, a down payment — where certainty matters more than growth."
        },
        {
            id: "bonds", icon: "📜", name: "Government & Corporate Bonds", risk: "low",
            ret: "3–7% p.a.", liquidity: "Medium", horizon: "1–10+ years",
            desc: "Loans to governments or companies that pay regular interest.",
            detail: "Bonds pay periodic coupons and return principal at maturity. Government bonds are the safest; corporate bonds pay more but carry default risk. Bond prices fall when interest rates rise. They smooth out a portfolio dominated by stocks."
        },
        {
            id: "mmf", icon: "💧", name: "Money Market Funds", risk: "low",
            ret: "3–5% p.a.", liquidity: "High", horizon: "Days–months",
            desc: "Funds holding short-term debt — a liquid, low-return parking spot.",
            detail: "Money market funds invest in treasury bills and short-term commercial paper. They aim to keep the value stable at 1 unit while paying small interest. A common place to hold cash between investments."
        },
        {
            id: "index", icon: "📊", name: "Index Funds", risk: "medium",
            ret: "7–10% p.a.", liquidity: "High", horizon: "5+ years",
            desc: "Funds that simply track a whole market index like the S&P 500 or NIFTY 50.",
            detail: "Index funds buy every company in an index, so no single stock can sink you. Fees are minimal because there is no active manager. Historically, broad index investing has beaten most professional stock-pickers after fees over long horizons."
        },
        {
            id: "etf", icon: "🧺", name: "ETFs", risk: "medium",
            ret: "6–10% p.a.", liquidity: "High", horizon: "3+ years",
            desc: "Exchange-traded funds — index or thematic baskets traded like a stock.",
            detail: "ETFs combine diversification with intraday trading. Variants cover countries, sectors, commodities and themes. Watch the expense ratio and tracking error. A single global ETF is one of the simplest ways to own thousands of companies."
        },
        {
            id: "mf", icon: "📁", name: "Mutual Funds (Active)", risk: "medium",
            ret: "6–12% p.a.", liquidity: "Medium", horizon: "3–7 years",
            desc: "Professionally managed pools of stocks or bonds, aiming to beat the market.",
            detail: "Active fund managers pick holdings to outperform an index — but most underperform after fees. Check the expense ratio, manager track record and consistency. SIP (systematic investment plan) versions automate monthly investing."
        },
        {
            id: "stocks", icon: "📈", name: "Individual Stocks", risk: "high",
            ret: "8–12% p.a. (wide range)", liquidity: "High", horizon: "5+ years",
            desc: "Direct ownership of companies — high potential, high volatility.",
            detail: "Owning individual shares gives you the full upside (and downside) of a business. Diversify across 10–20 companies and sectors, avoid over-concentration, and only invest money you won't need for years. Research earnings, debt and competitive moats."
        },
        {
            id: "reits", icon: "🏢", name: "REITs / Real Estate", risk: "high",
            ret: "6–10% p.a.", liquidity: "Medium–High (listed REITs)", horizon: "5+ years",
            desc: "Income-producing property exposure without buying a building.",
            detail: "Real Estate Investment Trusts own offices, malls, warehouses or data centres and must pay out most rental income as dividends. Listed REITs trade like stocks; direct property is illiquid but can be leveraged. Sensitive to interest rates."
        },
        {
            id: "gold", icon: "🥇", name: "Gold & Commodities", risk: "medium",
            ret: "4–7% p.a.", liquidity: "High (ETFs)", horizon: "5+ years",
            desc: "A hedge against inflation and crisis — no cash flow, driven by sentiment.",
            detail: "Gold produces nothing; its price reflects fear, currency moves and real interest rates. A 5–10% allocation can dampen portfolio swings. Prefer gold ETFs or sovereign gold bonds over physical metal to avoid storage and purity issues."
        },
        {
            id: "crypto", icon: "🪙", name: "Cryptocurrency", risk: "high",
            ret: "Highly volatile", liquidity: "High (24/7)", horizon: "Speculative",
            desc: "Digital assets like Bitcoin — extreme swings, regulatory uncertainty.",
            detail: "Crypto has produced both fortunes and total losses. Prices can drop 50–80% and stay down for years. If you participate, keep it a small single-digit percentage of your portfolio, use reputable exchanges, and never invest money you can't afford to lose."
        },
        {
            id: "derivatives", icon: "⚡", name: "Options & Futures", risk: "high",
            ret: "Leveraged", liquidity: "High", horizon: "Days–months",
            desc: "Contracts whose value derives from an underlying asset — amplified gains and losses.",
            detail: "Derivatives let you hedge or speculate with leverage. Leverage magnifies losses as easily as gains, and most retail options expire worthless. Treat them as a professional tool, not an investment — learn thoroughly and paper-trade first."
        }
    ];

    function renderOptionCards(filter) {
        var grid = $("optionsGrid");
        if (!grid) return;

        var risk = filter || "all";
        var html = "";
        var count = 0;

        INVESTMENT_OPTIONS.forEach(function (opt) {
            if (risk !== "all" && opt.risk !== risk) return;
            count += 1;
            html +=
                '<div class="option-card risk-' + opt.risk + '" data-option="' +
                opt.id + '" role="button" tabindex="0">' +
                '<div class="option-top"><span class="option-icon">' + opt.icon +
                '</span><span class="risk-dot risk-dot-' + opt.risk + '"></span></div>' +
                '<h4>' + opt.name + '</h4>' +
                '<p>' + opt.desc + '</p>' +
                '<div class="option-meta">' +
                '<span><b>Return:</b> ' + opt.ret + '</span>' +
                '<span><b>Liquidity:</b> ' + opt.liquidity + '</span>' +
                '<span><b>Horizon:</b> ' + opt.horizon + '</span>' +
                '</div></div>';
        });

        grid.innerHTML = html;

        var noResults = $("optionsNoResults");
        if (noResults) noResults.hidden = count > 0;

        Array.prototype.forEach.call(
            grid.querySelectorAll(".option-card"),
            function (card) {
                function open() { showOptionDetail(card.dataset.option); }
                card.addEventListener("click", open);
                card.addEventListener("keydown", function (event) {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        open();
                    }
                });
            }
        );
    }

    function showOptionDetail(id) {
        var panel = $("optionDetailPanel");
        if (!panel) return;

        var opt = null;
        INVESTMENT_OPTIONS.forEach(function (candidate) {
            if (candidate.id === id) opt = candidate;
        });
        if (!opt) return;

        var title = $("optionDetailTitle");
        var subtitle = $("optionDetailSubtitle");
        var body = $("optionDetailBody");

        if (title) title.textContent = opt.icon + " " + opt.name;
        if (subtitle) {
            subtitle.textContent =
                "Risk level: " + opt.risk + "  ·  Typical return: " +
                opt.ret + "  ·  Liquidity: " + opt.liquidity;
        }
        if (body) body.textContent = opt.detail;

        panel.hidden = false;
        panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function initInvestmentOptions() {
        var filterBar = $("optionsFilter");
        if (!filterBar || !$("optionsGrid")) return;

        renderOptionCards("all");

        var buttons = filterBar.querySelectorAll(".filter-btn");
        Array.prototype.forEach.call(buttons, function (btn) {
            btn.addEventListener("click", function () {
                Array.prototype.forEach.call(buttons, function (other) {
                    other.classList.remove("active");
                });
                btn.classList.add("active");
                renderOptionCards(btn.dataset.risk || "all");
            });
        });

        var closeBtn = $("optionDetailClose");
        if (closeBtn) {
            closeBtn.addEventListener("click", function () {
                var panel = $("optionDetailPanel");
                if (panel) panel.hidden = true;
            });
        }
    }

    /* ============================================================
       INIT
       ============================================================ */

    function initGlobalMarkets() {
        initMarketSearch();
        initWatchlistForm();
        renderWatchlist();
        initSampleStocks();
        initChatExtensions();
        initInvestmentOptions();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initGlobalMarkets);
    } else {
        initGlobalMarkets();
    }
})();
