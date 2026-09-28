# Development Log — Frontend Module

> Frontend-only entries (Cyrus). Merge under the team's shared
> `DEVLOG.md` rather than overwriting other members' entries.

## 2026-09-27 — Cyrus

**Done:**
- Scaffolded the frontend module: `templates/` (Jinja shells) +
  `static/` (consolidated `style.css`, `js/` app).
- Built the ASSUREX design system as CSS custom properties — brand
  palette, DM Serif Display / Inter type scale, spacing, radius,
  status colors (always icon + label, never color alone).
- Built the shared app shell: sidebar (desktop), icon-only sidebar
  (tablet), mobile header + bottom tab bar (phone) — `app.js`,
  `components/sidebar.js`, `components/navbar.js`,
  `components/mobileNav.js`.
- Built the reusable component library: stat cards, status badges,
  claim rows/table rows, modal, toast, file uploader (drag/drop +
  progress + retry), hand-rolled SVG line/donut/bar charts, empty/
  loading/error states, stepper, timeline.
- Built all 10 page screens: login, user dashboard, claims (search +
  modular filters + pagination), new-claim (5-step flow), claim
  details (AI analysis, decision, contradictions, missing docs,
  duplicate warning, timeline, report download), products & warranty,
  reports/analytics, admin dashboard, admin review (queue + reviewer
  actions), settings.
- Built the service/mock layer: `api.js` (mock/live switch),
  `authService`, `claimService`, `dashboardService`, `productService`,
  `reportService`, `adminService`, each backed by realistic mock data
  covering approved/rejected/manual-review/contradiction/duplicate/
  model-disagreement cases.
- Wrote `README_FRONTEND.md` (architecture, mock mode, adding a
  filter, frontend/backend contract) and this log.

**Problems encountered:**
- Original build targeted a standalone `frontend/` directory with
  one `.html` file per page and per-file CSS; the team's finalized
  repo structure uses Flask `templates/` + `static/` instead. Ported
  everything over: HTML pages became Jinja templates extending
  `base.html`, the nine separate CSS files were consolidated into one
  `static/style.css`, and every internal link/asset path was updated
  from `page.html` / `../assets/...` to clean routes (`/dashboard`,
  `/claims`, ...) and `/static/...` paths respectively.
- A naive find-and-replace of `dashboard.html` → `/dashboard` also
  matched inside `admin-dashboard.html`, producing a broken
  `admin-/dashboard` route. Caught it with a grep pass afterwards and
  fixed with a follow-up replace.

**Changed:**
- Filter architecture in `claims.js` was written as a single
  `FILTER_CONFIG` array specifically so the documented "add a new
  dashboard filter" live-judging exercise is a two-line change (see
  README_FRONTEND.md).

**Tested:**
- Manually reviewed every generated file for stray/unused imports
  after the templates/static port.
- _(Team: add manual QA notes here — desktop/tablet/mobile pass,
  mock-mode walkthrough, `?live=1` behaviour without a backend
  running.)_

**Next:**
- Swap placeholder `static/branding/*.svg` for final logo exports.
- Once `src/core/web.py` exposes real routes, delete `preview_app.py`
  and point the same templates at it (no template changes needed).
- Replace `// TODO: Replace with confirmed backend endpoint.` markers
  in `static/js/services/*.js` once real API paths are confirmed.
