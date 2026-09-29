# Development Log

One entry per person per day. Record what really happened, failures included.

Template:

```
### <date> · <name>
Done:
Problems:
Model failures:
Changes made:
Tests performed:
```

---

## 25 Sep 2026 (Day 1)

## 26 Sep 2026 (Day 2)

## 27 Sep 2026 (Day 3)

### 27 Sep 2026 · Cyrus

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

## 28 Sep 2026 (Day 4)

### 28 Sep 2026 · Victor
Done: dataset generator built — 10 named scenarios across the 3 classes, reading real values
from `policies/*.yaml` (no hard-coded warranty numbers); stratified 70/15/15 split
(1,050/225/225); ~4% per-split label noise; `dataset_statistics.md`, `data_dictionary.md`,
`scenarios.md` written from the real generated CSVs.
Model failures: none yet — no ML model trained (that's step 4).
Changes made: 
Tests performed: ran `generator.py` (train=1050 val=225 test=225); confirmed 1,500 unique
`claim_code`s across all three splits with no overlap; checked per-split label distribution.

## 29 Sep 2026 (Day 5)

### 29 Sep 2026 · Victor

**Done:**
- Trained the Google Teachable Machine model on the 2,100 training
  cards (700 Valid, 704 Invalid, 696 Manual Review). Default settings:
  50 epochs, batch size 16, learning rate 0.001.
- Exported it as Keras into `model/teachable_v1/` and hooked it into
  `src/teachable/predict.py`. Took out the old fallback that guessed the
  class from red/green pixel counts with fixed confidences.
- Added `src/teachable/evaluate.py`, which runs the model on the
  validation and test cards and writes `reports/teachable_evaluation.md`.
- Added `data/cards/card_mapping.csv` (Claim ID to image filename).
- Teachable Machine project:
  https://drive.google.com/file/d/1ruZkYKbzm37YkyMXrzRzUZW-X4I73XdM/view?usp=sharing

**Problems encountered:**
- The old cards were 520x680 and Teachable Machine crops uploads to a
  square, so the bottom rows (serial check, missing doc count) would
  have been cut off. Made the new cards square (448x448).
- `labels.txt` from the export shortens the class names
  so the code matches each one to the full class name instead of reading it as-is.
- The Teachable Machine `.h5` file doesn't load with the Keras that ships
  with TensorFlow 2.21. Loading it through `tf-keras` works.

**Model failures:**
- Run 1 got 73% on Teachable Machine's own holdout (Valid 0.95,
  Invalid 0.68, Manual Review 0.57). Almost every mistake was a claim
  called Valid.
- To find out why, trained a plain logistic regression on the card
  pixels. It got 69% and failed on the same claims: every
  excessive-repairs claim and every fault-before-purchase claim came out
  Valid. On the old card those two facts were small grey text, which
  can't be read once the image is shrunk to 224px, so the claims looked
  exactly like valid ones. More epochs wouldn't have fixed this.
- After retraining (run 2), the light card version still missed the red
  "fault before purchase" chip on every test card (0 of 17).

**Changed:**
- Redesigned the Claim Summary Card (`src/ml/card.py`): one row per
  fact with a coloured status chip (green fine, amber borderline, red
  problem, blue for the fault type), coloured against the category's
  policy file. It still shows no prediction, confidence or decision.
  Same pixel regression on the new cards: 96%.
- Run 2 on the new cards: 94% on Teachable Machine's holdout (Valid
  0.98, Invalid 0.93, Manual Review 0.91).
- Validation, test and live claims now use the dark card version. The
  model scored 92.9% on dark validation cards against 81.3% on light
  ones. Training still uses both versions.

**Tested:**
- `python -m src.teachable.evaluate`: 92.89% on validation, 90.67% on
  test (225 cards each, none used in training). About 0.2 s per card.
- `pytest`: 10 of 11 pass. The failing one is the home page test
  (`url_for` in the templates), not related to this work.
- Checked a few test cards in the Teachable Machine preview by hand
  (screenshots in `screenshots/teachable/`).
- _(Team: add who re-checked the exported model / screenshots.)_

**Next:**
- Fix the home page crash and the rule engine gaps (duplicates,
  unauthorized repair, reporting period).
- Connect the frontend to the real backend so claims go through both
  models.
- _(Team: add anything else for today.)_

### 29 Sep 2026 · Victor (continued)

**Done:**
- Went through the UI against the SRS and the backend. Product types now
  match the three policy categories, model predictions show the class
  (Valid Claim / Invalid Claim / Manual Review) and only the final
  decision says "Likely ...". Reworked the new claim flow: pick or
  register a product, fault list from the policy, draft saved before
  documents, OCR fields to check, preparation check, then submit.
- Built the backend API in `src/platform/` (accounts, products, claims,
  documents, review, admin, reports). Login with a signed cookie, salted
  PBKDF2 passwords, role checks on every route.
- Uploads get type/size checks, OCR (images and PDFs, `src/ml/ocr.py`)
  and a SHA-256 hash so the same file on two claims gets flagged.
- Submitting a claim runs both models and the engine and stores the
  predictions with their model versions, rule results, audit entries,
  notifications and admin alerts. PDF claim report, CSV/Excel export,
  admin settings saved into `config/thresholds.yaml`.
- Switched the frontend off mock data and deleted the mock files.
- Teachable Machine run 3 on the new dataset, exported as v2. Python
  model retrained as v2. v1 files kept so old predictions still point
  at the model that made them.
- `train_model.py` now does 5-fold CV, picks the model on validation
  and scores test once. Added the training notebook, the model
  comparison report on all 225 test claims and the Python evaluation
  report with charts.
- Seed script creates the demo logins and one claim per SRS demo case
  through the real API. Wrote the README, sample claims folder, and a
  polish pass on layout (review page, dashboard grid, mobile tables,
  login demo accounts, dropdown chevrons, background X).

**Problems encountered:**
- The engine returned "Weak match" but the config says "Weak Match", so
  weak matches never went to manual review. Fixed.
- The engine treated every non-blocking rule as manual review, so a late
  fault report sent 50 valid test claims to review. The policy files
  already split rules into hard fail / manual review / warning, the
  engine just wasn't reading those lists. It does now.
- OCR read the word "photo" as a serial number, and read O for 0 in a
  couple of serials. Serial/model/invoice numbers now need a digit; the
  verification step is where the user fixes misreads.
- The tests were writing into the real `uploads/` folder and overwrote
  the demo claims' summary cards. Tests now use a temp folder.
- The first claim took 33 s because TensorFlow loaded on first use.
  Both models load at start-up now; a claim takes under a second.

**Model failures:**
- A clean valid claim came out Valid at only 51%. Nearly every training
  claim had the optional warranty card and repair report, so the models
  learned "no repair report = manual review". Changed the generator so
  optional documents vary in every class (repair report only if the
  product was repaired) and retrained both models.
- The Python model is still less sure (about 65-70%) on valid claims in
  the middle of their warranty period, so a lot of those end up as Weak
  Match and go to review. Left the thresholds as they are for now.

**Changed:**
- Python v2: CV 94.8% ± 1.9%, validation 94.2%, test 94.2%.
- Teachable Machine v2: validation 95.6%, test 95.1% (run 3 holdout 95%).
- Comparison on 225 test claims: models agree on 97.3%, automatic
  decisions right 94.9% of the time, no invalid claim auto-approved.
- Rule severity comes from the policy lists; new checks for unauthorised
  repair, reporting period, fault not covered, duplicates and
  contradictions in the documents.

**Tested:**
- `pytest`: 34 of 34 pass (API, security, rules, models, database).
- Clicked through the whole flow in the browser as customer, reviewer
  and admin; all pages checked at desktop and phone width.
- `python database/seed_db.py`: every demo case comes out as expected.
