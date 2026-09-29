# model/

| File | What it is |
|---|---|
| `python_v2.joblib` | Python classifier in use: preprocessing + Random Forest in one scikit-learn pipeline |
| `python_v2_preprocessor.joblib`, `python_v2_labels.json` | The preprocessing step and the class labels on their own (SRS 1.10.4) |
| `metrics.json` | Cross-validation, validation and test metrics of the current Python model |
| `python_v1.joblib`, `metrics_v1.json` | Previous Python model (dataset v1), kept so old predictions stay traceable |
| `teachable_v2/` | Teachable Machine export in use (`keras_model.h5`, `labels.txt`) and its `metrics.json` |
| `teachable_v1/` | Previous Teachable Machine export (dataset v1) |

The versions used for new predictions are set in `src/core/config.py`
(`PYTHON_MODEL_VERSION`, `TEACHABLE_MODEL_VERSION`). Every prediction stores the version
that made it (SRS xlviii).
