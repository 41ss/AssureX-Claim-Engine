# AssureX Claim Engine

Warranty claim validation for manufacturers and service centres. Each claim is checked by a
**Python classification model** reading the structured claim data and, independently, by a
**Google Teachable Machine model** reading a Claim Summary Card image drawn from the same data.
The application compares the two predictions and their confidence scores, applies the warranty
rules for the product category, and returns **Likely Valid**, **Likely Invalid** or
**Manual Review Required** with an explanation. Uncertain or conflicting claims go to a reviewer.

TechWiz 7 · NextWave AI and ML · Theme: AI-Powered Document Ops.

## Links

| Item | Link |
|---|---|
| Deployed application | [TO ADD — or "local installation only", see below] |
| Demonstration video | [TO ADD] |
| Technical blog | [TO ADD] |
| Project report | `documentation/AssureX_Project_Report.docx` [TO ADD: final PDF link] |
| Teachable Machine project | https://drive.google.com/file/d/1ruZkYKbzm37YkyMXrzRzUZW-X4I73XdM/view?usp=sharing |

## Evaluator logins

Created by `python database/seed_db.py` (see Installation). Local demo credentials only.

| Role | Email | Password | Can do |
|---|---|---|---|
| Evaluator (administrator) | evaluator@assurex.com | Evaluator123! | Everything, including settings |
| Administrator | admin@assurex.com | Admin123! | Everything, including settings |
| Claim reviewer | reviewer@assurex.com | Review123! | Review queue, approve / reject / request information / override, exports |
| Customer | customer@assurex.com | Customer123! | Own products and claims |
| Service-centre employee | service@assurex.com | Service123! | Own products and claims (files claims for customers) |

New customer and service-centre accounts can register on the login page. Reviewer and
administrator accounts cannot self-register; they come from the seed script.

## Results at a glance

| | Python model (Random Forest, v2) | Teachable Machine (v2) |
|---|---|---|
| Accuracy on the 225 unseen test claims | **94.2%** | **95.1%** |
| Validation accuracy | 94.2% (cross-validation 94.8% ± 1.9%) | 95.6% |
| Evidence | `reports/python_model_evaluation.md`, `notebooks/python_model_training.ipynb` | `reports/teachable_evaluation.md`, `screenshots/teachable/` |

Both models agree on 97.3% of the test claims; decisions the application makes on its own
(Likely Valid / Likely Invalid) are correct 94.9% of the time, and no invalid or manual-review
claim was approved automatically (`reports/model_comparison.md`). A claim is evaluated in
under a second (SRS target: 5 seconds).

---

## Installation (SRS 1.10.9)

**Prerequisites**
- Windows 10/11 (tested), macOS or Linux
- Python **3.11 – 3.13** (developed on 3.13.9)
- Git
- **Tesseract OCR 5** for reading receipts
  - Windows: `winget install UB-Mannheim.TesseractOCR` (or the installer from
    https://github.com/UB-Mannheim/tesseract/wiki). The app looks in
    `C:\Program Files\Tesseract-OCR` automatically.
  - macOS: `brew install tesseract` · Ubuntu: `sudo apt install tesseract-ocr`
- About 2 GB of disk space (TensorFlow is large)

**Steps** (from the repository root)

```bash
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python database/seed_db.py        # creates assurex.db with the logins above and the demo claims
uvicorn src.main:app --port 8000
```

Open http://127.0.0.1:8000 and log in. The first start takes about 10 seconds while TensorFlow
loads the Teachable Machine model; after that a claim is evaluated in under a second.

**Database.** SQLite, file `assurex.db` in the repository root, tables defined in
`src/core/models.py`. `python database/init_db.py` creates empty tables;
`python database/seed_db.py` deletes the file and rebuilds it with the demo accounts and claims
(it creates every claim through the real API, so this also takes about a minute).

**Model placement.** The files are already in the repository:

| File | Used for |
|---|---|
| `model/python_v2.joblib` | Python classifier (preprocessing + Random Forest pipeline) |
| `model/teachable_v2/keras_model.h5`, `labels.txt` | Teachable Machine export (Tensorflow → Keras) |

To use a new Teachable Machine export, put `keras_model.h5` and `labels.txt` in
`model/teachable_v3/` and set `TEACHABLE_MODEL_VERSION = "v3"` in `src/core/config.py`.
To retrain the Python model: `python src/ml/scripts/train_model.py --version v3` and set
`PYTHON_MODEL_VERSION`. Earlier predictions keep the version that made them.

**Environment variables** (all optional)

| Variable | Default | Purpose |
|---|---|---|
| `ASSUREX_SECRET_KEY` | a local development key | Signs the login cookie. **Set it for any shared deployment.** |
| `ASSUREX_DATABASE_URL` | `sqlite:///<repo>/assurex.db` | Another database (the tests use a temporary one) |

**Folder setup.** `uploads/` (uploaded files and rendered Claim Summary Cards) is created on
start and is not committed.

**Tests**

```bash
pytest
```

34 automated tests (API, security, rules, models, cards, database); all pass.

**Troubleshooting**

| Problem | Fix |
|---|---|
| Uploaded receipts show "Text recognition is not available" | Install Tesseract (above). On Windows, if it is not in `C:\Program Files\Tesseract-OCR`, add its folder to PATH. |
| Claim submission says the models are unavailable | Check `model/python_v2.joblib` and `model/teachable_v2/` exist and `pip install -r requirements.txt` completed (TensorFlow and tf-keras). Administrators also see a `model_failure` alert. |
| `ModuleNotFoundError: tf_keras` | `pip install tf-keras==2.21.*` — Teachable Machine exports Keras 2 files. |
| Logged out immediately / 401 errors | The session cookie expired (8 hours) or the secret key changed; log in again. |
| Port 8000 in use | `uvicorn src.main:app --port 8001` |

---

## How to use it (SRS 1.10.10)

**Register or log in.** On the login page, sign in with an account above, or choose
*Create one* and pick *Customer* or *Service-centre employee*.

**Register a product and its warranty.** *Products & Warranty → Register Product.* Choose the
category (consumer electronics, mobile devices, small appliances), enter the product details
and warranty provider. The warranty expiry is filled in from the category policy and can be
changed; tick *extended warranty* to add one. Each product gets a Product ID (`PRD-1001`).
*Repair history* on a product card records earlier repairs and whether the service centre was
authorised.

**Create a claim.** *New Claim.*
1. Pick a registered product (or register one on the spot).
2. Choose the fault from the policy's list, the damage type and the date the fault started;
   describe it; check the serial number. Continuing saves the claim as a **Draft** with a
   Claim ID (`CLM-2026-0001`).
3. **Upload documents.** Required documents for the category are marked *Required*. PDF, JPG,
   PNG up to 10 MB; MP4 videos up to 50 MB for fault evidence.
4. **Verify extracted information.** Receipts, warranty cards and serial photos are read by
   OCR; the fields read (invoice number, purchase date, product, model, serial, retailer,
   amount, warranty months) appear under the file. Correct anything wrong and choose
   *Confirm these values*. Documents already used on another claim are flagged.
5. **Review.** The preparation check lists missing information, missing documents, deadlines
   and possible contradictions.
6. **Submit.** Both models run and the result appears.

**Read the result** (*Claims → View*).
- **Python confidence scores:** the model's probability for each of the three classes; the
  highest is its predicted class.
- **Claim Summary Card:** generated automatically from the claim data at submission and shown
  on the claim page. It never shows a prediction or decision.
- **Teachable Machine prediction:** the image model's class and three confidences, from the card.
- **Comparing both models:** *Model comparison* shows whether the classes match, the confidence
  difference `|Python top confidence − Teachable Machine top confidence|` and the consistency
  status (Strong Match, Acceptable Match, Weak Match, Model Disagreement, Uncertain Result),
  set by `config/thresholds.yaml`.
- **Warranty-rule results:** *Warranty rules* lists every rule passed and failed, marked
  *fails the claim*, *needs a reviewer* or *warning only*.
- **Contradictions** (fault before purchase, fault in the future, receipt date or model not
  matching the product, repair before purchase, serial mismatch) appear in a red box.
- **Duplicate claims** (same receipt file, invoice number, product + fault, near-identical
  description, or serial claimed by another customer) appear in *Duplicate Possible*.
- **Track claim status:** the status badge and *Claim Timeline* follow Draft → Submitted →
  Under Evaluation → Manual Review / Approved / Rejected → (Additional Information Required,
  Closed).
- **Export a claim report:** *Download Report* gives a PDF with the claim, evidence, both model
  results, the comparison, rule results, contradictions, recommendation and reviewer comments.

**Manual-review queue** (reviewer or administrator): *Review Queue* lists claims needing review.
Open one to see everything above, then approve, reject or request information with a comment.
Approving a *Likely Invalid* claim or rejecting a *Likely Valid* one is an override and needs a
reason; the original results stay in the audit history.

**Administrator dashboard:** totals, valid / invalid / manual-review counts, pending reviews,
model disagreements, duplicate alerts, average confidence, claim trend and monitoring alerts.
*Export* downloads claims, products, warranties or analytics as CSV or Excel.
*Settings → System* changes the warranty-expiry alert days and the comparison thresholds.

**Run the automated tests:** `pytest`.

**Regenerate the evidence**

| Command | Output |
|---|---|
| `python dataset_generator/generator.py` then `report.py`, `generate_cards.py` | The dataset CSVs, statistics and Claim Summary Card images |
| `python src/ml/scripts/train_model.py --version v2` | Python model, `model/metrics.json`, `reports/python_model_evaluation.md` |
| `python -m src.teachable.evaluate` | `reports/teachable_evaluation.md` |
| `python src/ml/scripts/compare_models.py` | `reports/model_comparison.md` and `.csv` (SRS 1.10.6) |

## Demonstration claims (SRS 1.10.8)

After seeding, the customer and service-centre accounts own one claim for each required case.
Details and the documents to try by hand are in `sample_claims/`.

| Case | Claim | Result |
|---|---|---|
| Valid claim | CLM-2026-0001 | Likely Valid (Strong Match) → Approved |
| Invalid claim — liquid damage | CLM-2026-0002 | Likely Invalid → Rejected |
| Duplicate claim | CLM-2026-0003 | Manual Review (same receipt file as CLM-2026-0001) |
| Expired warranty | CLM-2026-0004 | Likely Invalid → Rejected |
| Missing documents | CLM-2026-0005 | Manual Review → reviewer requested information |
| Contradictory claim | CLM-2026-0006 | Manual Review (fault date before purchase) |
| Serial-number mismatch | CLM-2026-0007 | Manual Review |
| Unauthorised repair | CLM-2026-0008 | Likely Invalid → Rejected |
| Tricky boundary date | CLM-2026-0009 | Manual Review (inside the grace period, low model confidence) |
| Models disagree | CLM-2026-0010 | Manual Review (Python: Valid, Teachable Machine: Manual Review) → reviewer override, Approved |
| Manual review — fault not covered | CLM-2026-0011 | Manual Review |
| Draft | CLM-2026-0012 | Not submitted |

## How it works

```
New Claim form ──> /api/claims (src/platform/claims.py) ──> uploads + OCR (src/ml/ocr.py)
Submit ──> src/platform/evaluation.py
            ├─ src/ml/features.py      claim + product + documents + repairs -> ClaimFeatures
            ├─ src/ml/predict.py       Python model: class + 3 probabilities
            ├─ src/ml/card.py          Claim Summary Card image (claim data only)
            ├─ src/teachable/predict.py Teachable Machine: class + 3 probabilities from the card
            └─ src/decision/engine.py  comparison, consistency status, rules from policies/*.yaml,
                                       contradictions, duplicates -> final decision + explanation
          ──> stored with model versions, rule results and an audit entry
```

Diagrams (architecture, data flow, use case, activity, sequence, decision flow, database):
`documentation/diagrams/`.

## Repository layout (SRS 1.10.2)

| Folder | Contents |
|---|---|
| `src/core/` | Settings, database tables, shared data shapes, the claim pipeline, password hashing |
| `src/platform/` | API routes (auth, products, claims, admin, dashboards), checks, evaluation, PDF report |
| `src/ml/` | Features, Python model prediction, Claim Summary Card, OCR; `scripts/` for training and the comparison report |
| `src/teachable/` | Teachable Machine prediction and evaluation, date parsing |
| `src/decision/` | Decision engine |
| `templates/`, `static/` | Web pages (Jinja templates, CSS, JavaScript) |
| `data/` | Dataset CSVs, Claim Summary Card images, card mapping, data dictionary, statistics, scenarios |
| `dataset_generator/` | Dataset, statistics and card generation scripts |
| `model/` | Saved models, preprocessing and label files, metrics |
| `notebooks/` | Training notebook |
| `policies/` | One warranty policy per product category |
| `config/` | Comparison thresholds and alert settings |
| `database/` | Database creation and seed scripts |
| `tests/` | Automated tests |
| `sample_claims/` | Demo claim list and documents to upload |
| `reports/` | Model evaluation and comparison reports |
| `documentation/` | Project report and diagrams |
| `screenshots/` | Application and Teachable Machine screenshots |

## Assumptions

- The dataset is synthetic (1,500 claims, 500 per class); no real customer data is used anywhere.
- One product category corresponds to one policy file in `policies/`.
- The dataset counts warranty length in 30-day months; live claims use the real warranty end date.
- Receipts are clear enough for OCR, and the user corrects anything misread before submitting.
- The session cookie and local SQLite database are adequate for a demonstration; a production
  deployment would use a server database and a managed secret.

## Known limitations

- The Python model is less confident on valid claims in the middle of their warranty period
  (about 65–70%) than near its end, so many such claims go to manual review under the
  current thresholds. It errs on the safe side: no invalid claim is approved automatically.
- The dataset does not model the claim-reporting deadline; late reports are shown as warnings.
- OCR can misread similar characters (O and 0, K and k); the verification step is where these
  are corrected.
- Teachable Machine reads the card as a picture, so it depends on the card design; the dark
  card is used for evaluation because the model reads it best (95.6% vs 81.3% on validation in v1).
- TensorFlow makes the application too large for most free hosting plans.
- [TO ADD: anything else the team finds]

## Screenshots and test results

Screenshots: `screenshots/` [TO ADD: application screenshots]. Teachable Machine training runs:
`screenshots/teachable/`. Test results: `pytest` (34 passed); model results in `reports/`.

## Team files

`DEVLOG.md` (development log) · `AI_USAGE.md` (AI tools used) · `CONTRIBUTIONS.md` (who did what)
