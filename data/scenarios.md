# Claim scenario definitions

Every claim in the dataset is produced by one of these ten named functions
(`dataset_generator/generator.py::generate_claim`), never by an unconstrained random draw.
Each ties a class label to a concrete, written condition against the claim's `policies/*.yaml`
warranty policy.

## Valid Claim

- **`normal_valid`** — well within warranty, fault on the category's covered-fault list, no
  exclusions, 0–1 prior repairs. The baseline "everything checks out" case.
- **`valid_with_repair_history`** — older product, 1–`max_covered_repairs` prior repairs (still
  within the policy's covered limit), fault still covered. Tests that repair history alone
  doesn't sink a claim if it's within the allowed count.
- **`valid_near_expiry`** — warranty has 1–20 days left. Still active, still valid — a boundary
  case that should *not* be confused with `expired_warranty`.

## Invalid Claim

- **`expired_warranty`** — warranty age is past `coverage_duration_months` **and** past the
  policy's `grace_period_days`. A hard-fail condition (`hard_fail_rules: warranty_expired_beyond_grace`).
- **`excluded_damage`** — fault drawn from the policy's `exclusions` list (not `covered_faults`),
  with `physical_damage` or `water_damage` set. Matches `hard_fail_rules: excluded_damage`.
- **`excessive_repairs`** — prior repairs exceed the policy's `max_covered_repairs` by 1–3, and
  the product may already have been replaced once. This is the ML-visible proxy for the
  "unauthorized repair" scenario (`ClaimFeatures` has no per-repair authorization flag; the
  precise authorized/unauthorized fact is a runtime rule-engine check against `RepairRecord`,
  not a training feature).

## Manual Review

- **`missing_documents`** — 1 or more of the category's mandatory documents (per its policy)
  are missing. Matches `manual_review_rules: missing_mandatory_document`.
- **`serial_mismatch`** — the entered serial number does not match the documents.
  Matches `manual_review_rules: serial_number_mismatch`.
- **`contradiction_bad_dates`** — `days_purchase_to_fault` is negative: the fault is reported
  as occurring before the product was purchased. An impossible, contradictory date.
  Matches `manual_review_rules: contradiction_detected`.
- **`borderline_disagreement`** — deliberately sits on multiple policy edges at once (warranty
  expires within ±2 days, repairs exactly at the covered limit, one optional document missing).
  Nothing here is a clean pass or a clean fail — this is the scenario meant to produce the
  claims where the Python model and the Teachable Machine model are most likely to disagree
  (SRS hint: "cases the two models will disagree on").

## Label noise

After generation and the stratified split, ~4% of rows per split (`LABEL_NOISE_RATE` in
`generator.py`) have their `label` reassigned to a different class, independent of `scenario`.
This is what keeps the dataset from being trivially separable — a real classifier has to earn
its accuracy rather than memorize the scenario-to-label mapping. `scenario` is kept in the CSV
purely as generation provenance and must not be used as a model feature.
