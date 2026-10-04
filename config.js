/* ============================================================
 * InvestAI — RUNTIME CONFIGURATION (safe defaults)
 *
 * window.INVEST_API_BASE is read by src/auth.js and
 * src/dashboard.js (and admin.html). Leave it as null to use
 * the built-in fallbacks, which are already production-safe:
 *   - served over http(s) on a non-localhost host -> same origin
 *   - localhost / file://                        -> http://localhost:4000
 *
 * For a split deployment (frontend and backend on different
 * hosts), set the value below to the backend's public URL, e.g.
 *   window.INVEST_API_BASE = "https://api.your-domain.com";
 * ============================================================ */
(function () {
    if (typeof window === "undefined") return;
    /* Explicitly undefined/null -> keep the built-in fallback. */
    if (window.INVEST_API_BASE === undefined || window.INVEST_API_BASE === null) {
        try {
            var injected = /*INVEST_API_BASE*/ null /*END*/;
            if (injected) window.INVEST_API_BASE = injected;
        } catch (e) { /* keep fallback */ }
    }
})();
