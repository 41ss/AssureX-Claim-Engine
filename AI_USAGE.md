# AI Usage Declaration — Frontend Module (Cyrus)

> This covers AI usage for `templates/`, `static/style.css`, and
> `static/js/**` only. If teammates already have entries in a shared
> `AI_USAGE.md`, merge this section in under a "Frontend (Cyrus)"
> heading rather than overwriting theirs.

## Entry 1

- **Tool name:** Claude (Anthropic)
- **Purpose of use:** Scaffolding the frontend module — directory
  structure, design tokens (colors/type/spacing), reusable component
  library (sidebar, topbar, cards, badges, modal, toast, charts,
  stepper, file uploader), mock data layer, and the Jinja templates
  that wrap them.
- **Prompt / type of assistance requested:** Given the SRS
  (`AssureX_Claim_Engine-NextWave_AI_and_ML_SRS.pdf`) and a detailed
  frontend implementation brief (brand palette, typography, icon
  system, page list, component list, mock-mode requirement), asked
  for a complete first pass of the frontend/design module.
- **Files/modules affected:** All of `templates/*.html`,
  `static/style.css`, `static/js/**`, `static/branding/*.svg`
  (placeholder marks), `preview_app.py`, `README_FRONTEND.md`.
- **Modifications performed by the team:** _(fill in before
  submission)_ — e.g. "Replaced placeholder logo SVGs with final
  brand assets", "Adjusted FILTER_CONFIG for the live judging
  exercise", "Connected claimService to real /api/claims endpoint
  once backend was ready", "Rewrote copy on X page".
- **Testing performed by the team:** _(fill in before submission)_ —
  e.g. "Manually tested all 11 templates at desktop/tablet/mobile
  widths", "Verified mock-mode toggle (`?live=1`) falls back to a
  friendly error when no backend is running", "Walked through the
  new-claim flow end to end including document upload and submission
  timeline".
- **Team member who verified the output:** _(name)_

## What AI-generated output was NOT used for

- No claim decision, model prediction, or confidence score is
  computed by an external generative-AI API anywhere in this module —
  every number in the running app comes from `static/js/mock/*.js`
  (clearly separated from UI code) or, once connected, from the real
  Python/Teachable Machine/decision-engine services.
- No backend, ML, OCR, or decision-engine code was generated as part
  of this frontend work.

## Reminder for whoever fills this in

AI-generated output cannot replace technical understanding — be ready
to explain any function in this module, including `FILTER_CONFIG` in
`static/js/pages/claims.js` (the documented live-modification
target), the mock/live switch in `static/js/services/api.js`, and how
`static/js/app.js` mounts the shared shell on every page.
