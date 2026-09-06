/* ============================================================
   AUTH GATE — landing page + sign in / sign up (local only)
   Runs before dashboard.js. Injects the gate and unlocks the
   app-container only when a session exists.
   ============================================================ */

(function () {
    "use strict";

    var USERS_KEY = "investai_users_v1";
    var SESSION_KEY = "investai_session_v1";

    /* ------------------------------------------------------------
       Session helpers
       ------------------------------------------------------------ */

    function readJSON(key, fallback) {
        try {
            var raw = localStorage.getItem(key);
            var parsed = raw ? JSON.parse(raw) : null;
            return parsed || fallback;
        } catch (error) {
            return fallback;
        }
    }

    function writeJSON(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function getUsers() {
        var users = readJSON(USERS_KEY, {});
        return (users && typeof users === "object" && !Array.isArray(users))
            ? users : {};
    }

    function getSession() {
        return readJSON(SESSION_KEY, null);
    }

    function setSession(email) {
        writeJSON(SESSION_KEY, { email: email, at: Date.now() });
    }

    function clearSession() {
        localStorage.removeItem(SESSION_KEY);
    }

    /* Passwords are hashed with a simple local digest — this is a
       demo store (localStorage), not a substitute for a real backend. */

    function hashPassword(password) {
        var hash = 5381;
        var salted = "investai::" + password;
        for (var i = 0; i < salted.length; i += 1) {
            hash = ((hash << 5) + hash + salted.charCodeAt(i)) >>> 0;
        }
        return "h" + hash.toString(36) + ":" + salted.length;
    }

    /* ------------------------------------------------------------
       Gate markup — injected right after <body> opens
       ------------------------------------------------------------ */

    var GATE_ID = "authGate";

    function gateHTML() {
        return '\
<div class="auth-gate" id="' + GATE_ID + '">\
  <div class="auth-landing" id="authLanding">\
    <nav class="landing-nav">\
      <div class="landing-brand"><span class="brand-icon">📊</span><strong>InvestAI</strong></div>\
      <div class="landing-nav-actions">\
        <button class="landing-link" id="landingLearnBtn" type="button">What\u2019s inside</button>\
        <button class="landing-btn-ghost" id="landingSigninBtn" type="button">Sign In</button>\
        <button class="landing-btn-solid" id="landingSignupBtn" type="button">Get Started</button>\
      </div>\
    </nav>\
    <header class="landing-hero">\
      <span class="eyebrow">✨ 100% LOCAL — NO API REQUIRED</span>\
      <h1>Understand your investments <em>before</em> you risk a rupee.</h1>\
      <p>InvestAI is a private, offline analytics workspace for building portfolios, scoring risk, screening markets and projecting growth — everything runs in your browser and nothing leaves your device.</p>\
      <div class="landing-hero-actions">\
        <button class="landing-btn-solid" id="heroSignupBtn" type="button">Create free account</button>\
        <button class="landing-btn-ghost" id="heroSigninBtn" type="button">I already have one</button>\
      </div>\
      <div class="landing-hero-stats">\
        <div><strong>10</strong><span>Tools &amp; sections</span></div>\
        <div><strong>18</strong><span>Global markets</span></div>\
        <div><strong>0</strong><span>Data sent to servers</span></div>\
      </div>\
    </header>\
    <section class="landing-sections" id="landingSections">\
      <h2>What\u2019s inside the dashboard</h2>\
      <p class="landing-sections-sub">Every section below unlocks right after you sign in.</p>\
      <div class="landing-grid">\
        <div class="landing-card"><span class="lc-icon">🏠</span><h3>Dashboard (Home)</h3><p>Your control centre — quick actions, saved-data management and a summary of every tool in the workspace.</p></div>\
        <div class="landing-card"><span class="lc-icon">💼</span><h3>Portfolio Builder</h3><p>Enter amounts per asset class and get an instant allocation breakdown with diversification feedback.</p></div>\
        <div class="landing-card"><span class="lc-icon">⚠️</span><h3>Risk Evaluator</h3><p>Scores your portfolio\u2019s concentration, volatility and asset mix — with plain-English suggestions to reduce risk.</p></div>\
        <div class="landing-card"><span class="lc-icon">🔎</span><h3>Market Screener</h3><p>Browse investment categories by risk, return potential, liquidity and time horizon to shortlist what fits you.</p></div>\
        <div class="landing-card"><span class="lc-icon">🌍</span><h3>Global Markets</h3><p>Exchanges and indices of 18 markets — US, India, Japan, Europe, Middle East, Africa — plus ADRs and currency risk.</p></div>\
        <div class="landing-card"><span class="lc-icon">📈</span><h3>Future Projection</h3><p>Compound-growth modelling with contributions, expected return and horizon — visualised year by year.</p></div>\
        <div class="landing-card"><span class="lc-icon">💬</span><h3>Analytics Chat</h3><p>A built-in, rule-based assistant covering diversification, ETFs, bonds, ADRs and global investing.</p></div>\
        <div class="landing-card"><span class="lc-icon">⭐</span><h3>Watchlist</h3><p>Track reference profiles of stocks from any market — saved locally on this device only.</p></div>\
        <div class="landing-card"><span class="lc-icon">🕘</span><h3>History &amp; Reports</h3><p>Your last 20 analyses with one-click export — every report generated stays on your machine.</p></div>\
      </div>\
    </section>\
    <footer class="landing-footer"><p>Educational tool — not investment advice. Always verify with a licensed advisor.</p></footer>\
  </div>\
  <div class="auth-view" id="authView" hidden>\
    <nav class="auth-topbar">\
      <button class="auth-brand auth-home-btn" id="authHomeBtn" type="button">\
        <span class="brand-icon">📊</span><strong>InvestAI</strong>\
        <span class="auth-home-hint">← Back to Home</span>\
      </button>\
      <button class="auth-close" id="authCloseBtn" type="button" aria-label="Close and return to home">✕</button>\
    </nav>\
    <div class="auth-card">\
      <div class="auth-brand"><span class="brand-icon">📊</span><strong>InvestAI</strong></div>\
      <button class="auth-back" id="authBackBtn" type="button">← Back to overview</button>\
      <form id="loginForm" class="auth-form" novalidate>\
        <h2>Welcome back</h2>\
        <p class="auth-sub">Sign in to open your analytics dashboard.</p>\
        <label for="loginEmail">Email</label>\
        <input type="email" id="loginEmail" placeholder="you@example.com" autocomplete="email" required>\
        <label for="loginPassword">Password</label>\
        <div class="password-field">\
          <input type="password" id="loginPassword" placeholder="Your password" autocomplete="current-password" required>\
          <button type="button" class="password-toggle" data-target="loginPassword" aria-label="Show password" aria-pressed="false">👁️</button>\
        </div>\
        <p class="auth-error" id="loginError" hidden></p>\
        <button class="auth-submit" type="submit">Sign In</button>\
        <p class="auth-switch">New here? <button type="button" class="auth-link-btn" id="switchToSignup">Create an account</button></p>\
      </form>\
      <form id="signupForm" class="auth-form" hidden novalidate>\
        <h2>Create your account</h2>\
        <p class="auth-sub">Free, instant, and stored only on this device.</p>\
        <label for="signupName">Full name</label>\
        <input type="text" id="signupName" placeholder="Ada Lovelace" autocomplete="name" required>\
        <label for="signupEmail">Email</label>\
        <input type="email" id="signupEmail" placeholder="you@example.com" autocomplete="email" required>\
        <label for="signupPassword">Password</label>\
        <div class="password-field">\
          <input type="password" id="signupPassword" placeholder="At least 6 characters" autocomplete="new-password" minlength="6" required>\
          <button type="button" class="password-toggle" data-target="signupPassword" aria-label="Show password" aria-pressed="false">👁️</button>\
        </div>\
        <p class="auth-error" id="signupError" hidden></p>\
        <button class="auth-submit" type="submit">Sign Up</button>\
        <p class="auth-switch">Already registered? <button type="button" class="auth-link-btn" id="switchToLogin">Sign in instead</button></p>\
      </form>\
      <p class="auth-note">🔒 Local demo — accounts live in your browser\u2019s localStorage, never on a server.</p>\
    </div>\
  </div>\
</div>';
    }

    function injectGate() {
        if (document.getElementById(GATE_ID)) {
            return document.getElementById(GATE_ID);
        }
        var wrapper = document.createElement("div");
        wrapper.innerHTML = gateHTML();
        var gate = wrapper.firstElementChild;
        document.body.insertBefore(gate, document.body.firstChild);
        return gate;
    }

    /* ------------------------------------------------------------
       Show / hide app
       ------------------------------------------------------------ */

    function showApp(user) {
        document.body.classList.add("is-authed");
        var gate = document.getElementById(GATE_ID);
        if (gate) gate.remove();
        var label = document.getElementById("authUserLabel");
        if (label && user) {
            label.textContent = "👤 " + (user.name || user.email);
        }
    }

    function showGate(view) {
        document.body.classList.remove("is-authed");
        injectGate();
        initGate();
        switchView(view || "landing");
    }

    function switchView(view) {
        var landing = document.getElementById("authLanding");
        var authView = document.getElementById("authView");
        if (!landing || !authView) return;

        if (view === "landing") {
            landing.hidden = false;
            authView.hidden = true;
            return;
        }

        landing.hidden = true;
        authView.hidden = false;

        document.getElementById("loginForm").hidden = view !== "login";
        document.getElementById("signupForm").hidden = view !== "signup";
    }

    function showError(id, message) {
        var el = document.getElementById(id);
        if (!el) return;
        el.textContent = message;
        el.hidden = false;
    }

    /* ------------------------------------------------------------
       Event wiring
       ------------------------------------------------------------ */

    function initGate() {
        var gate = document.getElementById(GATE_ID);
        if (!gate || gate.dataset.wired === "1") return;
        gate.dataset.wired = "1";

        function open(view) {
            gate.querySelectorAll("form").forEach(function (form) {
                form.reset();
            });
            gate.querySelectorAll(".auth-error").forEach(function (el) {
                el.hidden = true;
            });
            switchView(view);
        }

        document.getElementById("landingLearnBtn").addEventListener("click", function () {
            document.getElementById("landingSections")
                .scrollIntoView({ behavior: "smooth" });
        });
        document.getElementById("landingSigninBtn").addEventListener("click", function () { open("login"); });
        document.getElementById("landingSignupBtn").addEventListener("click", function () { open("signup"); });
        document.getElementById("heroSigninBtn").addEventListener("click", function () { open("login"); });
        document.getElementById("heroSignupBtn").addEventListener("click", function () { open("signup"); });
        document.getElementById("authBackBtn").addEventListener("click", function () { open("landing"); });
        document.getElementById("authHomeBtn").addEventListener("click", function () { open("landing"); });
        document.getElementById("authCloseBtn").addEventListener("click", function () { open("landing"); });
        document.getElementById("switchToSignup").addEventListener("click", function () { open("signup"); });
        document.getElementById("switchToLogin").addEventListener("click", function () { open("login"); });

        /* Show / hide password toggles */
        gate.querySelectorAll(".password-toggle").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var input = document.getElementById(btn.dataset.target);
                if (!input) return;
                var show = input.type === "password";
                input.type = show ? "text" : "password";
                btn.textContent = show ? "🙈" : "👁️";
                btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
                btn.setAttribute("aria-pressed", show ? "true" : "false");
                input.focus({ preventScroll: true });
            });
        });

        /* --- Sign up --- */
        document.getElementById("signupForm").addEventListener("submit", function (event) {
            event.preventDefault();

            var name = document.getElementById("signupName").value.trim();
            var email = document.getElementById("signupEmail").value.trim().toLowerCase();
            var password = document.getElementById("signupPassword").value;

            if (!name || !email || !password) {
                showError("signupError", "Please fill in every field.");
                return;
            }
            if (password.length < 6) {
                showError("signupError", "Password must be at least 6 characters.");
                return;
            }

            var users = getUsers();
            if (users[email]) {
                showError("signupError", "An account with this email already exists. Try signing in.");
                return;
            }

            users[email] = { name: name, pass: hashPassword(password), createdAt: Date.now() };
            writeJSON(USERS_KEY, users);
            setSession(email);
            showApp({ email: email, name: name });
        });

        /* --- Sign in --- */
        document.getElementById("loginForm").addEventListener("submit", function (event) {
            event.preventDefault();

            var email = document.getElementById("loginEmail").value.trim().toLowerCase();
            var password = document.getElementById("loginPassword").value;

            if (!email || !password) {
                showError("loginError", "Please enter your email and password.");
                return;
            }

            var users = getUsers();
            var user = users[email];
            if (!user || user.pass !== hashPassword(password)) {
                showError("loginError", "Incorrect email or password.");
                return;
            }

            setSession(email);
            showApp(user);
        });
    }

    /* ------------------------------------------------------------
       Logout — button is injected into the sidebar footer
       ------------------------------------------------------------ */

    function injectLogoutButton() {
        var footer = document.querySelector(".sidebar-footer");
        if (!footer || document.getElementById("logoutBtn")) return;

        var label = document.createElement("div");
        label.className = "auth-user-label";
        label.id = "authUserLabel";

        var btn = document.createElement("button");
        btn.className = "clear-data-btn";
        btn.id = "logoutBtn";
        btn.type = "button";
        btn.textContent = "🚪 Sign Out";

        btn.addEventListener("click", function () {
            clearSession();
            showGate("landing");
            /* make sure the app shows the dashboard again next time */
            var dashBtn = document.querySelector('.nav-item[data-section="dashboard"]');
            if (dashBtn) dashBtn.click();
        });

        footer.insertBefore(label, footer.firstChild);
        footer.appendChild(btn);
    }

    /* ------------------------------------------------------------
       Boot
       ------------------------------------------------------------ */

    function boot() {
        injectLogoutButton();

        var session = getSession();
        if (session && session.email) {
            var users = getUsers();
            var user = users[session.email];
            if (user) {
                showApp(user);
                return;
            }
            clearSession();
        }
        showGate("landing");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();
