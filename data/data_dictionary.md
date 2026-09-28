# Data dictionary — `claims_train.csv` / `claims_val.csv` / `claims_test.csv`

One row = one claim. Same fields as `ClaimFeatures` (`src/core/contracts.py`) plus two
generation-only columns (`scenario`, `label`) that are not part of the runtime contract.

| Field | Type | Description |
|---|---|---|
| `claim_code` | str | Unique claim ID (`CLM-#####`), assigned sequentially before shuffling — unique across all three splits, no claim appears twice. |
| `product_category` | str | `consumer_electronics` / `mobile_devices` / `small_appliances` — one of `policies/*.yaml`. Drives which warranty length, covered faults, exclusions and mandatory documents apply. |
| `product_age_days` | int | Days between purchase and the claim's reference date. |
| `warranty_months` | int | The category's `coverage_duration_months` (12 or 24) from its policy file. |
| `warranty_days_left` | int | `warranty_months * 30 - product_age_days`. Negative once the warranty has expired. |
| `fault_category` | str | The reported fault. Drawn from the category's `covered_faults` for most scenarios, or from `exclusions` for `excluded_damage`. |
| `days_purchase_to_fault` | int | Days between purchase and the fault occurring. **Negative means a contradiction** (fault reported before the product was purchased) — used by `contradiction_bad_dates`. |
| `previous_repairs` | int | Number of prior repairs on this product. Above the policy's `max_covered_repairs` is the ML-visible proxy for repair-history risk (there's no `authorized_center` flag in `ClaimFeatures`; the exact authorized/unauthorized fact is checked separately at runtime by the rule engine against `RepairRecord`). |
| `product_replaced_before` | bool | Whether the product was already replaced under warranty once. |
| `physical_damage` | bool | Exclusion flag. |
| `water_damage` | bool | Exclusion flag. |
| `receipt_present` | bool | Purchase receipt attached. |
| `warranty_card_present` | bool | Warranty card attached. |
| `product_image_present` | bool | Product photo attached. |
| `repair_report_present` | bool | Repair report attached. |
| `serial_matches` | bool | Whether the entered serial number matches the one on the supporting documents. |
| `missing_documents` | int | Count of the category's **mandatory** documents (per its policy file) that are absent. Broader than the four `*_present` booleans above — also counts `serial_photo` / `fault_evidence`, which aren't tracked as their own columns. |
| `scenario` | str | Which generator scenario produced the row (see `scenarios.md`). **Generation-only — drop before training.** It was assigned before label noise, so it can disagree with `label`; keeping it as a model feature would leak the label. |
| `label` | str | Training target: `Valid Claim` / `Invalid Claim` / `Manual Review`. Independent of `scenario` after ~4% per-split label noise is applied. |

## Notes
- All fields are derived by written rule from a named scenario against the real
  `policies/*.yaml` values (coverage length, covered faults, exclusions, document lists) —
  nothing here is free-random.
- `missing_documents` and the `*_present` flags read from the same policy file the runtime
  rule engine (`src/decision/engine.py`) reads, so a dataset row and a real submitted claim
  are computed the same way.
