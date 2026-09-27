# AI Usage

Required by SRS 1.8 item 9 and 1.10.15. Every AI tool used during development is listed here,
one row per use. The final claim decision is never produced by a generative-AI API: it comes
from our Python model, our Teachable Machine model, the rule engine and application logic.

| Tool | Purpose | Prompt / type of assistance | Files or modules affected | Modifications by the team | Testing by the team | Verified by |
|---|---|---|---|---|---|---|
| Claude (Anthropic) | Project skeleton and folder layout | Asked for a FastAPI + SQLite skeleton matching the SRS, with module stubs and contracts | `src/`, `templates/`, `static/`, `tests/`, `database/`, READMEs | [to fill] | App starts; `pytest` passes (1 test) | [name] |
| Claude (Anthropic) | Starting warranty-policy and threshold files | Asked for policy files with every field in SRS 1.10.7 | `policies/*.yaml`, `config/thresholds.yaml` | [to fill] | [to fill] | [name] |
| Claude (Anthropic) | UI design kit | Asked for a design system and example page | `static/assurex.css`, `static/assurex.js`, `templates/base.html` | [to fill] | [to fill] | [name] |
