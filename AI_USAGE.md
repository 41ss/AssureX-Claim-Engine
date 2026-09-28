# AI Usage

Required by SRS 1.8 item 9 and 1.10.15. Every AI tool used during development is listed here,
one row per use. The final claim decision is never produced by a generative-AI API: it comes
from our Python model, our Teachable Machine model, the rule engine and application logic.

| Tool | Purpose | Prompt / type of assistance | Files or modules affected | Modifications by the team | Testing by the team | Verified by |
|---|---|---|---|---|---|---|
| Claude (Anthropic) | Project skeleton and folder layout | Asked for a FastAPI + SQLite skeleton matching the SRS, with module stubs and contracts | `src/`, `templates/`, `static/`, `tests/`, `database/`, READMEs | [to fill] | App starts; `pytest` passes (1 test) | [name] |
| Claude (Anthropic) | Starting warranty-policy and threshold files | Asked for policy files with every field in SRS 1.10.7 | `policies/*.yaml`, `config/thresholds.yaml` | [to fill] | [to fill] | [name] |
| Claude (Anthropic) | UI design kit | Asked for a design system and example page | `static/assurex.css`, `static/assurex.js`, `templates/base.html` | [to fill] | [to fill] | [name] |
| Claude (Anthropic) | Dataset generator (Step 1): scenario-based claim generator, split, docs | Asked for a scenario-driven generator (10 named scenarios across 3 classes) reading `policies/*.yaml`, a stratified 70/15/15 split, label noise, and the stats/dictionary/scenario docs, under Day-4-evening time pressure | `dataset_generator/generator.py`, `dataset_generator/report.py`, `data/claims_train.csv`, `data/claims_val.csv`, `data/claims_test.csv`, `data/scenarios.md`, `data/data_dictionary.md`, `data/dataset_statistics.md` | [Victor: note anything you changed after this] | Ran `generator.py` (train=1050 val=225 test=225); verified 1,500 unique `claim_code`s across splits and per-split label counts | [Victor] |
