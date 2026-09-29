# ASSUREX Claim Engine — Frontend (Cyrus's module)

This document covers everything under `templates/` and `static/` —
the frontend/design module. It does **not** describe `src/core`,
`src/ml`, `src/decision`, `src/platform`, `src/teachable`, or any
other backend module; those are owned by the rest of the team.

## Overview

The frontend is a set of Jinja2 templates (`templates/*.html`) plus a
vanilla HTML/CSS/JavaScript application that runs entirely in the
browser (`static/style.css`, `static/js/**`). No frontend build step
is required — templates are served by the FastAPI app
(`src/platform/pages.py`), and everything after that is native ES modules
calling the JSON API under `/api`.

## Tech stack

- Jinja2 templates for page shells (served by FastAPI)
- HTML5 / CSS3 (one consolidated stylesheet, `static/style.css`)
- Vanilla JavaScript (ES modules, no framework, no build step)
- Hand-rolled inline-SVG icons and charts (no external UI library)

## Running it

The pages are served by the real application:

```
uvicorn src.main:app --port 8000
```

Then open `http://127.0.0.1:8000/` (install and seed steps: main `README.md`).

### Routes

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
| `/admin-dashboard`   | `admin-dashboard.html` | Reviewers and administrators    |
| `/admin-review`      | `admin-review.html`    | Reviewers and administrators; `?id=` for detail |
| `/settings`          | `settings.html`        | Profile / appearance / account; *System* tab for administrators |

The sidebar and redirects hide pages by role in the browser, but the
real protection is on the server: every `/api` route checks the session
cookie and the user's role (`src/platform/common.py`).

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
    services/           — the ONLY files that call fetch()
      api.js              — fetch wrapper (+ file downloads) for /api
      authService.js
      claimService.js
      dashboardService.js
      productService.js
      policyService.js
      reportService.js
      adminService.js
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

## Connection to the backend

Every `*Service` file calls `request()` from `static/js/services/api.js`,
which sends JSON to `/api/...` on the same origin, carries the session
cookie, and turns an error response into an `Error` with the server's
plain-language message. A 401 sends the user back to `/login`.
Nothing in `components/` or `pages/` calls `fetch()` directly.

## Frontend → backend contract

The JSON shapes are produced by `src/platform/serialize.py` (claims,
products, documents) and `src/platform/stats.py` (dashboards, reports).
Each model prediction is a claim class (`Valid Claim`, `Invalid Claim`,
`Manual Review`) with three confidences; only the final decision uses
`Likely Valid` / `Likely Invalid` / `Manual Review Required`.
Product categories, document types and statuses are listed once in
`static/js/utils/claimOptions.js`, matching `policies/*.yaml` and the
database.

## Adding a new claims filter (documented live-judging exercise)

1. Add one entry to the `FILTER_CONFIG` array in `static/js/pages/claims.js`
   (key, label, options) and its default (`"all"`) in `static/js/state.js`.
2. Add the query parameter to `list_claims()` and one check to
   `matches()` in `src/platform/claims.py`.

The dropdown, its event wiring, the query string and the "Clear filters"
button all read `FILTER_CONFIG` generically — nothing else needs to change.

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

## Known limitations

- The avatar photo chosen in Settings is only shown in the current page;
  it is not stored.
- Notification preferences (email/SMS toggles) are kept in the browser;
  the app only sends in-app notifications.

