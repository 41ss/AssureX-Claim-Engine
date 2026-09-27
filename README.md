# AssureX Claim Engine

Warranty claim validation for manufacturers and service centers. Each claim is checked by a
Python classification model and, independently, by a Google Teachable Machine model reading a
Claim Summary Card image. The two results are compared, warranty rules are applied, and the
claim ends as **Likely Valid**, **Likely Invalid** or **Manual Review Required**.

TechWiz 7 · NextWave AI and ML. The SRS is the source of truth for everything below.

## Links

- Deployed app: [to add] · Evaluator login: [to add] · Admin login: [to add]
- Demonstration video: [to add] · Technical blog: [to add] · Project report: [to add]

## Run it locally

Prerequisites: Windows 10/11, macOS or Linux; Python 3.11+; Tesseract OCR
(Windows build: https://github.com/UB-Mannheim/tesseract/wiki).

```bash
python -m venv .venv
.venv\Scripts\activate        # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python database/init_db.py
uvicorn src.main:app --reload
```

Open http://127.0.0.1:8000. Run the tests with `pytest`.

## Repository layout (SRS 1.10.2)

| Folder | What it holds | Owner |
|---|---|---|
| `src/` | Python backend: `core/` (tables, contracts, pipeline), `ml/`, `decision/`, `teachable/`, `platform/` (routes) | per module |
| `templates/`, `static/` | Jinja pages, CSS, JavaScript | Cyrus |
| `data/` | Structured CSV dataset and Claim Summary Card images | Victor, Ayub |
| `dataset_generator/` | Dataset-generation scripts and scenario definitions | Victor |
| `notebooks/` | Preprocessing and training notebooks | Victor |
| `model/` | Saved Python model, encoders, Teachable Machine export | Victor, Ayub |
| `policies/` | Warranty-policy files, one per product category | Keagan |
| `config/` | Thresholds and settings | Keagan, Adan |
| `database/` | Database creation and seed scripts | Adan |
| `tests/` | Automated tests | everyone |
| `sample_claims/` | Claims for evaluators and the demo | Adan, Victor |
| `documentation/` | Project report, diagrams, test cases | Adan |
| `reports/` | Model-comparison report, model evidence | Victor, Ayub, Keagan |
| `screenshots/` | Screenshots of the working app | Cyrus |

Work only in the folders you own. Changes to `src/core/` or `requirements.txt` go through
Victor, Keagan or Cyrus.

## How a claim flows

```
claim form (platform/claims) -> ClaimFeatures (ml/features)
    -> ml/predict                 -> Python prediction, 3 probabilities
    -> ml/card -> teachable/predict -> Teachable Machine prediction, 3 probabilities
    -> decision/engine            -> classes match, confidence difference, consistency status,
                                     rule results, contradictions, final decision, explanation
    -> saved with model versions and an audit entry -> shown to the user and reviewer
```

The shapes passed between modules are in `src/core/contracts.py`.

## Still to write before submission (SRS 1.10.9 to 1.10.11)

- [ ] Installation details: database seeding, model placement, Teachable Machine model placement,
      OCR configuration, environment variables, default administrator, troubleshooting
- [ ] How to: register or log in, register a product, add warranty information, create a claim,
      upload documents, verify extracted information, submit, read the Python confidence scores,
      generate the Claim Summary Card, get the Teachable Machine prediction, compare both models,
      review rule results, check contradictions, find duplicates, use the manual-review queue,
      use the admin dashboard, track claim status, export a claim report, run the tests
- [ ] Known limitations and assumptions
- [ ] Screenshots, test results, Claim Summary Card samples

## Team files

`DEVLOG.md` (daily log) · `AI_USAGE.md` (every AI tool used) · `CONTRIBUTIONS.md`
(who did what) · `GIT_GUIDE.md` (GitHub Desktop in four steps)
