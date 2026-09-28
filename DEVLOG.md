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

## 28 Sep 2026 (Day 4)

### 28 Sep 2026 · Victor
Done: dataset generator built — 10 named scenarios across the 3 classes, reading real values
from `policies/*.yaml` (no hard-coded warranty numbers); stratified 70/15/15 split
(1,050/225/225); ~4% per-split label noise; `dataset_statistics.md`, `data_dictionary.md`,
`scenarios.md` written from the real generated CSVs.
Model failures: none yet — no ML model trained (that's step 4).
Changes made: [Victor: note anything you tweak locally before committing]
Tests performed: ran `generator.py` (train=1050 val=225 test=225); confirmed 1,500 unique
`claim_code`s across all three splits with no overlap; checked per-split label distribution.

## 29 Sep 2026 (Day 5)
