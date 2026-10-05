# 🛡 InvestAI Admin Guide

How to operate the InvestAI Admin Board: authentication, viewing users and
activities, and exporting data.

**Admin Board URL:** https://investai-backend-production-8cbd.up.railway.app/admin
(same page is also served at `/admin.html`)

---

## 1. Accessing the Admin Board

Open the Admin Board URL in a browser. The page renders the
"InvestAI — Admin Activity Dashboard". The dashboard UI itself is a static
page; all **data** endpoints are protected (see §2), so the page shows nothing
sensitive until a valid admin token is supplied with each API call.

## 2. Admin authentication

- Data endpoints require the shared admin secret:
  - `GET /api/admin/summary?token=<ADMIN_TOKEN>`
  - `GET /api/admin/export?token=<ADMIN_TOKEN>[&format=xlsx]`
- A **missing or wrong token returns HTTP 401** — access is denied.
- In production (`NODE_ENV=production`) the legacy default token
  `investai-admin` is **disabled**; a real long random `ADMIN_TOKEN` must be
  set as an environment variable on the hosting platform.
- The token is provided by whoever operates the deployment (Railway/Render
  dashboard → environment variables). **Never share it in chats, tickets or
  screenshots.**

## 3. Viewing users and activities

With a valid token, `GET /api/admin/summary` returns:

- **counts** — total users and total activities
- **users** — one row per user: email, name, language, currency, created_at
- **activities** — recent activity rows: email, session_id, activity
  (`signup`/`login`/`logout`/`analyze_<type>`), detail, created_at
- **per-user rollup** — activity count and last-activity timestamp per email

Paste the summary JSON into the dashboard (or consume it via the API) to
inspect who signed up, which currency/language they chose, and what they did.

### Filtering activity data

The export/summary includes `session_id`, `activity` type and `created_at`
timestamps, so you can filter/slice by:

- **user** — filter rows by `email`
- **session** — group by `session_id` to reconstruct one visit
- **event type** — `signup`, `login`, `logout`, `analyze_portfolio`,
  `analyze_risk`, `analyze_screener`, `analyze_prediction`, chat events, etc.
- **time** — sort or range-filter by `created_at`

## 4. CSV export

```
GET /api/admin/export?token=<ADMIN_TOKEN>
```

- Returns `text/csv` with header:
  `type,email,name,language,currency,session_id,activity,detail,created_at`
- One row per user (`type=user`) and per activity (`type=activity`).
- Open directly in Excel/Sheets or process with any CSV tool.

## 5. XLSX export (genuine OOXML)

```
GET /api/admin/export?token=<ADMIN_TOKEN>&format=xlsx
```

- Returns a **genuine `.xlsx`** file (`investai-export.xlsx`) with content type
  `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
- The file is a real OOXML package (ZIP of XML parts) with two worksheets:
  **Users** (email, name, language, currency, created_at) and **Activities**
  (email, session_id, activity, detail, created_at).
- Opens in Excel, LibreOffice, Numbers, Google Sheets.

## 6. Security precautions

- **Keep `ADMIN_TOKEN` secret.** Store it only in the hosting platform's
  environment settings. Never commit it to git, never paste it into the
  repo, docs, or issue trackers.
- Rotate the token if it may have leaked; rotation is an environment-variable
  change + redeploy of the backend.
- Always use the admin Board over **HTTPS**; the production URL enforces TLS.
- The database (`DATABASE_URL`) is separate and even more sensitive — it is
  never exposed through the admin endpoints, which return only summary rows.
- Activity data is operational telemetry; treat exported files (CSV/XLSX) as
  internal-confidential and do not email them around.
- If you suspect abuse, check `/api/admin/summary` for unexpected activity
  spikes and rotate both `ADMIN_TOKEN` and database credentials.
