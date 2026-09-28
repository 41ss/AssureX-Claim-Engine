# ASSUREX Claim Engine — Frontend (Cyrus's module)

This document covers everything under `templates/` and `static/` —
the frontend/design module. It does **not** describe `src/core`,
`src/ml`, `src/decision`, `src/platform`, `src/teachable`, or any
other backend module; those are owned by the rest of the team.

## Overview

The frontend is a set of Jinja2 templates (`templates/*.html`) plus a
vanilla HTML/CSS/JavaScript application that runs entirely in the
browser (`static/style.css`, `static/js/**`). No frontend build step
is required — templates are rendered by Flask, and everything after
that is native ES modules.

Every screen currently runs against **mock data**
(`static/js/mock/*.js`) so the UI is fully demonstrable before any
backend endpoint exists. See "Mock mode" below.

## Tech stack

- Jinja2 templates for page shells (rendered by Flask)
- HTML5 / CSS3 (one consolidated stylesheet, `static/style.css`)
- Vanilla JavaScript (ES modules, no framework, no build step)
- Hand-rolled inline-SVG icons and charts (no external UI library)

## Running it

The templates need something to render Jinja and serve `static/`.
Two ways to run it:

**Option A — via the real app (once `src/core/web.py` exists):**
Whatever route the platform teammate wires up for each page (see
"Suggested Flask routes" below) will call `render_template(...)` on
these files. Nothing in the frontend needs to change for that to work.

**Option B — standalone preview (frontend development only):**
```
pip install flask
python preview_app.py
```
Then open `http://127.0.0.1:5000/`. `preview_app.py` is a tiny,
clearly-labelled helper that just renders each template — it has no
real backend logic, and can be deleted once `src/core/web.py` serves
the same routes.

### Suggested Flask routes

| Route              | Template               | Notes                          |
|---------------------|------------------------|---------------------------------|
| `/`                 | `index.html`           | Redirects client-side by session |
| `/login`             | `login.html`           | Public                          |
| `/dashboard`         | `dashboard.html`       | User dashboard                  |
| `/claims`            | `claims.html`          | Claims list (search/filter)     |
| `/new-claim`         | `new-claim.html`       | 5-step new claim flow           |
| `/claim-details`     | `claim-details.html`   | Reads `?id=CLM-...`             |
| `/products`          | `products.html`        | Products & Warranty             |
| `/reports`           | `reports.html`         | Analytics + downloads           |
| `/admin-dashboard`   | `admin-dashboard.html` | Admin only                      |
| `/admin-review`      | `admin-review.html`    | Admin only; `?id=` for detail   |
| `/settings`          | `settings.html`        | Profile / appearance / account  |

Role gating (user vs admin) is currently enforced client-side in
`static/js/services/authService.js` (`requireRole`). If/when the
backend issues real sessions, the same routes should also be
protected server-side.

## Directory structure

```
templates/
  base.html          — shared <head>, fonts, stylesheet link, blocks
  index.html          — session-based redirect
  login.html
  dashboard.html
  claims.html
  new-claim.html
  claim-details.html
  products.html
  reports.html
  admin-dashboard.html
  admin-review.html
  settings.html

static/
  style.css           — ALL styles, consolidated (see banners inside
                         for the original variables/reset/typography/
                         layout/components/forms/tables/dashboard/
                         responsive sections)
  branding/           — logo marks (placeholders — see below)
  js/
    app.js             — mounts sidebar/topbar/mobile-nav on every
                          authenticated page
    state.js            — small app-wide state object (session, filters, ui)
    services/           — the ONLY files that call fetch()/mock data
      api.js              — mock-mode switch + fetch wrapper
      authService.js
      claimService.js
      dashboardService.js
      productService.js
      reportService.js
      adminService.js
    mock/                — demonstration data only
    components/          — reusable UI: sidebar, navbar, cards, badges,
                            modal, toast, charts, file uploader, etc.
    pages/                — one render function per template
    utils/                — formatters, validators, storage, helpers
```

## Design system

- **Colors** — Deep Forest `#09251F`, Forest `#145C4A`, Sage `#7FAF91`,
  Warm Cream `#F6F1E8`, Paper `#FCFAF5`, Charcoal `#17201D`, Peach
  `#F3C9B5`, Lavender `#D9D4F0`, Mint `#D8EBDD`, Gold `#D6B56A`. All
  defined as CSS custom properties at the top of `static/style.css`
  (originally `variables.css`) — change a value there and it
  propagates everywhere.
- **Type** — DM Serif Display for headings/hero text, Inter for
  everything functional (nav, forms, tables, labels).
- **Icons** — a small outline icon set in the Lucide visual style,
  inlined as SVG strings in `static/js/components/icons.js` (so they
  render instantly in dynamically-built markup, with no external
  script race condition).
- **Status color** never stands alone — every badge pairs a color
  with an icon and a text label (see `components/statusBadge.js`).

## Branding assets

`static/branding/*.svg` are **placeholder** logo marks (a simple
ribbon "A" built in CSS gradients), not the final brand file. Drop
the real ASSUREX logo exports in as:
```
static/branding/assurex-logo.svg         (full lockup, dark text)
static/branding/assurex-logo-light.svg   (full lockup, for dark backgrounds)
static/branding/assurex-mark.svg         (icon mark only)
static/branding/assurex-mark-light.svg   (icon mark, light version)
static/branding/favicon.svg
```
No other file needs to change — every reference points at these
filenames.

## Mock mode

`static/js/services/api.js` exports `USE_MOCK_DATA`, `true` by
default. Every `*Service` checks this flag: when true, it resolves
from `static/js/mock/*.js` after a short artificial delay (so loading
states are visible); when false, it calls `API_BASE_URL` from the
same file over `fetch()`.

To force live mode without touching code, open any page with
`?live=1` in the URL. To make it permanent, flip `USE_MOCK_DATA` in
`api.js`.

**When the backend is ready:** each service file has `// TODO:
Replace with confirmed backend endpoint.` comments marking exactly
where a real path goes. Nothing in `components/` or `pages/` needs to
change — they only ever call the service layer.

## Frontend → backend contract (PROVISIONAL — CONFIRM WITH BACKEND TEAM)

```jsonc
// Claim
{
  "id": "CLM-0012847",
  "product": { "name": "...", "type": "laptop", "brand": "...", "model": "...", "serialNumber": "..." },
  "faultType": "Screen Damage",
  "description": "...",
  "incidentDate": "2026-09-24",
  "submittedAt": "2026-09-25T08:12:00Z",
  "status": "approved | rejected | review | draft",
  "stage": "Draft | Submitted | Under Evaluation | Manual Review | Approved | Rejected | Closed",
  "warranty": { "provider": "...", "start": "...", "expiry": "...", "active": true },
  "documents": [{ "id": "...", "name": "...", "type": "...", "size": 12345, "status": "verified" }],
  "analysis": {
    "modelOne": { "name": "Python Classification Model", "version": "...", "prediction": "Likely Valid", "confidence": { "valid": 0.91, "invalid": 0.05, "review": 0.04 } },
    "modelTwo": { "name": "Google Teachable Machine", "version": "...", "prediction": "Likely Valid", "confidence": { "valid": 0.94, "invalid": 0.03, "review": 0.03 } },
    "consistency": "Strong Match | Acceptable Match | Weak Match | Model Disagreement | Uncertain Result",
    "confidenceDifference": 0.03
  },
  "decision": {
    "result": "Likely Valid | Likely Invalid | Manual Review Required",
    "explanation": "...",
    "supportingFactors": ["..."],
    "opposingFactors": ["..."],
    "contradictions": [{ "field": "...", "detail": "...", "severity": "high" }],
    "missingDocuments": ["..."],
    "duplicateWarning": { "relatedClaimId": "...", "relatedDate": "...", "relatedStatus": "..." } // or null
  },
  "timeline": [{ "label": "...", "timestamp": "...", "complete": true, "current": false }]
}
```
Field names above are the frontend's best guess at a workable shape —
**not final until confirmed with the backend team.** `static/js/mock/claims.js`
has a dozen fully-populated example records covering every UI state
(approved, rejected, manual review, contradictions, missing documents,
duplicate warning, model disagreement) if you need reference shapes
for products/dashboard/notifications too.

## Adding a new dashboard filter (documented live-judging exercise)

Everything lives in `static/js/pages/claims.js`:

1. Add one entry to the `FILTER_CONFIG` array (key, label, options).
2. Add a matching `if (filters.<key> && filters.<key> !== "all") { ... }`
   branch inside `claimService.getClaims()` in
   `static/js/services/claimService.js`.

The dropdown, its event wiring, and the "Clear filters" button all
read `FILTER_CONFIG` generically — nothing else needs to change.

## Error handling

All raw errors are translated to friendly copy in exactly one place:
`static/js/components/errorState.js` → `friendlyError(error)`. Pages
never render `error.message` from a caught exception directly.

## Responsive design

- **Desktop** (>1100px): full sidebar + topbar + content.
- **Tablet** (≤1100px): icon-only sidebar (see `.app-shell` rules in
  `static/style.css`).
- **Mobile** (≤720px): sidebar hidden, replaced by a dark mobile
  header + bottom tab bar (`components/mobileNav.js`). Tables convert
  to stacked cards via `data-label` attributes (see `tables.css`
  section).

## Accessibility

- Semantic landmarks (`<nav>`, `<main>`, `<header>`), labelled form
  fields, visible focus rings (`:focus-visible` in the reset section).
- Status is never color-only — every badge carries an icon + text.
- `prefers-reduced-motion` is respected globally.

## State management

`static/js/state.js` — a plain object (`session`, `filters`, `ui`),
no library. `state.filters` is the one judges are likely to ask about
live (see "Adding a new dashboard filter" above).

## Known limitations / not yet wired

- `reportService.downloadClaimReport()` builds a plain-text file
  client-side in mock mode purely so the button is demonstrable — the
  real PDF/CSV report is the backend's responsibility.
- Settings page (profile/appearance/notifications/account) is UI-only;
  no persistence.
- Role-based route protection is client-side only until the backend
  issues real sessions.
