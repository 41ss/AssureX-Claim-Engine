# AssureX Claim Engine

Warranty claim validation for manufacturers and service centers. A claim is checked by a Python
classification model and a Google Teachable Machine model, then by warranty rules, and ends as
**Likely Valid**, **Likely Invalid** or **Manual Review Required**.

## Run it

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows  (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open http://127.0.0.1:8000. Run the tests with `pytest`.

OCR needs the Tesseract program installed separately: https://github.com/UB-Mannheim/tesseract/wiki

## Who owns what

| Folder | Owner | SRS requirements |
|---|---|---|
| `app/ml/` | Victor | vi, vii, xvi–xx, xlviii |
| `app/decision/` | Keagan | xxii–xxxii, xxxiv–xxxvii |
| `frontend/` | Cyrus | xxxiii, xxxviii, xl–xliv, xlix |
| `app/platform/` | Adan | i–v, x–xv, xxxix, xlvi, xlvii, l |
| `app/teachable/` | Ayub | viii, ix, xxi, xlv |
| `app/core/` | shared | database tables, module contracts |

Work only in your own folder. Changes to `app/core/` or `requirements.txt` go through Victor, Keagan or Cyrus.

## How a claim flows

```
claim form (platform) -> ClaimFeatures (ml.features)
    -> ml.predict              -> ModelPrediction
    -> ml.card -> teachable.predict -> ModelPrediction
    -> decision.engine.decide  -> DecisionResult
    -> saved (platform) -> shown (frontend)
```

The shapes passed between modules are in `app/core/contracts.py`.

## Team files

- `DEVLOG.md` — daily log (SRS 1.8.3)
- `AI_USAGE.md` — every AI tool used (SRS 1.8.9)
- `GIT_GUIDE.md` — GitHub Desktop in four steps
