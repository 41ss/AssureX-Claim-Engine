"""Trains and compares the Python claim classifiers (SRS xviii, 1.10.4). Owner: Victor.

Procedure (the test split is used exactly once, at the end):
  1. 5-fold stratified cross-validation of three algorithms on the training split
  2. each algorithm fitted on train and scored on the validation split
  3. the best validation accuracy is selected
  4. the selected pipeline is refitted on train + validation and scored once on test

Writes model/python_<version>.joblib (+ preprocessor and label files), model/metrics.json,
reports/python_model_evaluation.md and charts in reports/figures/.

Run from the repo root:  python src/ml/scripts/train_model.py --version v2
"""
import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import joblib  # noqa: E402
import matplotlib  # noqa: E402
matplotlib.use("Agg")                      # draw charts to files, no window
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402
from sklearn.base import clone  # noqa: E402
from sklearn.compose import ColumnTransformer  # noqa: E402
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier  # noqa: E402
from sklearn.linear_model import LogisticRegression  # noqa: E402
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, precision_recall_fscore_support  # noqa: E402
from sklearn.model_selection import StratifiedKFold, cross_val_score  # noqa: E402
from sklearn.pipeline import Pipeline  # noqa: E402
from sklearn.preprocessing import OneHotEncoder, StandardScaler  # noqa: E402

from src.core.config import CLAIM_CLASSES, DATA_DIR, MODEL_DIR, REPORTS_DIR  # noqa: E402

# Feature columns (the same fields as ClaimFeatures and the Claim Summary Card)
NUMERIC_FEATURES = ["product_age_days", "warranty_months", "warranty_days_left",
                    "days_purchase_to_fault", "previous_repairs", "missing_documents"]
CATEGORICAL_FEATURES = ["product_category", "fault_category"]
BOOLEAN_FEATURES = ["product_replaced_before", "physical_damage", "water_damage", "receipt_present",
                    "warranty_card_present", "product_image_present", "repair_report_present", "serial_matches"]
ALL_FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES + BOOLEAN_FEATURES

# The three algorithms compared, with their hyperparameters (SRS 1.10.4: at least three).
CANDIDATES = {
    "RandomForest": RandomForestClassifier(n_estimators=150, max_depth=12, random_state=42),
    "GradientBoosting": GradientBoostingClassifier(n_estimators=120, learning_rate=0.1, max_depth=5, random_state=42),
    "LogisticRegression": LogisticRegression(max_iter=1000, random_state=42),
}
CV_FOLDS = 5
FIGURES_DIR = REPORTS_DIR / "figures"
LABELS = list(CLAIM_CLASSES)


def load_dataset(filename: str) -> tuple[pd.DataFrame, pd.Series]:
    """Loads one split. Missing values: none are produced by the generator, but boolean
    columns may arrive as 'True'/'False' text, so they are converted to 0/1 here."""
    df = pd.read_csv(DATA_DIR / filename)
    for col in BOOLEAN_FEATURES:
        if df[col].dtype == object:
            df[col] = df[col].astype(str).str.lower() == "true"
        df[col] = df[col].astype(int)
    return df[ALL_FEATURES], df["label"]


def build_preprocessor() -> ColumnTransformer:
    """Numeric: standardised (mean 0, sd 1). Categorical: one-hot, unknown values ignored.
    Boolean: passed through as 0/1."""
    return ColumnTransformer(transformers=[
        ("num", StandardScaler(), NUMERIC_FEATURES),
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL_FEATURES),
        ("bool", "passthrough", BOOLEAN_FEATURES),
    ])


def make_pipeline(name: str) -> Pipeline:
    return Pipeline(steps=[("preprocessor", build_preprocessor()), ("classifier", clone(CANDIDATES[name]))])


def cross_validate_all(X: pd.DataFrame, y: pd.Series) -> dict:
    """5-fold stratified cross-validation accuracy for every candidate, on the training split."""
    folds = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=42)
    results = {}
    for name in CANDIDATES:
        scores = cross_val_score(make_pipeline(name), X, y, cv=folds, scoring="accuracy")
        results[name] = {"mean": round(float(scores.mean()), 4), "std": round(float(scores.std()), 4),
                         "folds": [round(float(s), 4) for s in scores]}
    return results


def evaluate(pipe: Pipeline, X: pd.DataFrame, y: pd.Series) -> dict:
    """Accuracy, per-class precision / recall / F1, and the confusion matrix (rows = actual)."""
    pred = pipe.predict(X)
    precision, recall, f1, support = precision_recall_fscore_support(y, pred, labels=LABELS, zero_division=0)
    macro = precision_recall_fscore_support(y, pred, labels=LABELS, average="macro", zero_division=0)
    return {
        "accuracy": round(float(accuracy_score(y, pred)), 4),
        "precision_macro": round(float(macro[0]), 4), "recall_macro": round(float(macro[1]), 4), "f1_macro": round(float(macro[2]), 4),
        "per_class": {c: {"precision": round(float(p), 4), "recall": round(float(r), 4), "f1": round(float(f), 4), "support": int(n)}
                      for c, p, r, f, n in zip(LABELS, precision, recall, f1, support)},
        "classes": LABELS,
        "confusion_matrix": confusion_matrix(y, pred, labels=LABELS).tolist(),
        "report": classification_report(y, pred, labels=LABELS, digits=3, zero_division=0),
    }


def feature_importance(pipe: Pipeline) -> list[tuple[str, float]]:
    """Tree-model importances, with the one-hot columns of a category added back together
    so each original feature gets one number."""
    classifier = pipe.named_steps["classifier"]
    if not hasattr(classifier, "feature_importances_"):
        return []
    names = pipe.named_steps["preprocessor"].get_feature_names_out()
    totals: dict[str, float] = {}
    for name, value in zip(names, classifier.feature_importances_):
        raw = name.split("__", 1)[1]
        feature = next((c for c in CATEGORICAL_FEATURES if raw.startswith(c + "_")), raw)
        totals[feature] = totals.get(feature, 0.0) + float(value)
    return sorted(((k, round(v, 4)) for k, v in totals.items()), key=lambda kv: -kv[1])


def plot_confusion(cm: list[list[int]], title: str, path: Path) -> None:
    fig, ax = plt.subplots(figsize=(5, 4.2))
    ax.imshow(cm, cmap="Greens")
    ax.set_xticks(range(3), LABELS, rotation=20)
    ax.set_yticks(range(3), LABELS)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("Actual")
    for i in range(3):
        for j in range(3):
            ax.text(j, i, cm[i][j], ha="center", va="center", color="white" if cm[i][j] > max(map(max, cm)) / 2 else "black")
    ax.set_title(title)
    fig.tight_layout()
    fig.savefig(path, dpi=130)
    plt.close(fig)


def plot_importance(importance: list[tuple[str, float]], path: Path) -> None:
    fig, ax = plt.subplots(figsize=(6, 4.5))
    names, values = zip(*reversed(importance))
    ax.barh(names, values, color="#145C4A")
    ax.set_xlabel("Importance (sum over one-hot columns)")
    ax.set_title("Random Forest feature importance")
    fig.tight_layout()
    fig.savefig(path, dpi=130)
    plt.close(fig)


def sample_predictions(pipe: Pipeline, n: int = 10) -> list[dict]:
    """First n test claims with the model's three probabilities (SRS 1.10.4: sample test predictions)."""
    df = pd.read_csv(DATA_DIR / "claims_test.csv").head(n)
    X, _ = load_dataset("claims_test.csv")
    probs = pipe.predict_proba(X.head(n))
    rows = []
    for (_, row), p in zip(df.iterrows(), probs):
        by_class = dict(zip(pipe.classes_, p))
        rows.append({"claim_code": row["claim_code"], "actual": row["label"], "predicted": max(by_class, key=by_class.get),
                     **{c: round(float(by_class[c]), 3) for c in LABELS}})
    return rows


def write_report(version: str, cv: dict, val: dict, best: str, test: dict, importance, samples) -> None:
    lines = [
        f"# Python model evaluation (model {version})\n",
        "Generated by `python src/ml/scripts/train_model.py`. Never hand-edited.\n",
        "## Procedure\n",
        f"1. {CV_FOLDS}-fold stratified cross-validation on the training split (1,050 claims).",
        "2. Each algorithm fitted on train, scored on the validation split (225 claims).",
        "3. The algorithm with the best validation accuracy is selected.",
        "4. It is refitted on train + validation and scored once on the test split (225 claims).\n",
        "Preprocessing: numeric features standardised, categorical features one-hot encoded (unknown values ignored), "
        "boolean features as 0/1. All of it is inside the saved pipeline, so prediction applies the same steps.\n",
        "## Algorithms compared\n",
        "| Algorithm | Hyperparameters | CV accuracy (mean ± sd) | Validation accuracy | Validation macro F1 |",
        "|---|---|---|---|---|",
    ]
    for name, clf in CANDIDATES.items():
        params = {k: v for k, v in clf.get_params().items() if k in ("n_estimators", "max_depth", "learning_rate", "max_iter")}
        mark = " **(selected)**" if name == best else ""
        lines.append(f"| {name}{mark} | {params} | {cv[name]['mean']:.2%} ± {cv[name]['std']:.2%} | "
                     f"{val[name]['accuracy']:.2%} | {val[name]['f1_macro']:.3f} |")
    lines += ["", "Cross-validation folds: " + "; ".join(f"{n}: {', '.join(f'{s:.3f}' for s in cv[n]['folds'])}" for n in cv), ""]
    lines += [f"## Validation results — {best}\n", "```", val[best]["report"], "```",
              "![Validation confusion matrix](figures/python_confusion_val.png)\n",
              f"## Test results — {best} refitted on train + validation\n",
              f"Accuracy **{test['accuracy']:.2%}** (target: at least 85%).\n", "```", test["report"], "```",
              "Confusion matrix (rows = actual class):\n",
              pd.DataFrame(test["confusion_matrix"], index=[f"actual {c}" for c in LABELS], columns=LABELS).to_markdown(), "",
              "![Test confusion matrix](figures/python_confusion_test.png)\n",
              "## Feature importance\n",
              "| Feature | Importance |", "|---|---|", *[f"| {f} | {v:.3f} |" for f, v in importance], "",
              "![Feature importance](figures/python_feature_importance.png)\n",
              "## Sample test predictions\n", pd.DataFrame(samples).to_markdown(index=False), ""]
    (REPORTS_DIR / "python_model_evaluation.md").write_text("\n".join(lines), encoding="utf-8")


def train_and_evaluate(version: str) -> dict:
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    X_train, y_train = load_dataset("claims_train.csv")
    X_val, y_val = load_dataset("claims_val.csv")
    X_test, y_test = load_dataset("claims_test.csv")

    cv = cross_validate_all(X_train, y_train)
    val = {}
    for name in CANDIDATES:
        val[name] = evaluate(make_pipeline(name).fit(X_train, y_train), X_val, y_val)
        print(f"{name:<20} CV {cv[name]['mean']:.2%} ± {cv[name]['std']:.2%} | validation {val[name]['accuracy']:.2%}")
    best = max(CANDIDATES, key=lambda n: val[n]["accuracy"])

    final = make_pipeline(best).fit(pd.concat([X_train, X_val]), pd.concat([y_train, y_val]))
    test = evaluate(final, X_test, y_test)
    importance = feature_importance(final)
    samples = sample_predictions(final)
    print(f"Selected {best}: test accuracy {test['accuracy']:.2%}")

    # Model files: full pipeline (used by the app), plus the preprocessing step and class labels on their own.
    joblib.dump(final, MODEL_DIR / f"python_{version}.joblib")
    joblib.dump(final.named_steps["preprocessor"], MODEL_DIR / f"python_{version}_preprocessor.joblib")
    (MODEL_DIR / f"python_{version}_labels.json").write_text(json.dumps(list(final.classes_)), encoding="utf-8")
    metrics = {
        "version": version, "best_model": best, "features": ALL_FEATURES,
        "cross_validation": cv,
        "validation": {n: {k: v for k, v in m.items() if k != "report"} for n, m in val.items()},
        "test": {k: v for k, v in test.items() if k != "report"},
        "test_accuracy": test["accuracy"],
        "feature_importance": importance,
        "hyperparameters": {n: {k: v for k, v in c.get_params().items() if not callable(v)} for n, c in CANDIDATES.items()},
    }
    (MODEL_DIR / "metrics.json").write_text(json.dumps(metrics, indent=2, default=str), encoding="utf-8")

    plot_confusion(val[best]["confusion_matrix"], f"{best} — validation", FIGURES_DIR / "python_confusion_val.png")
    plot_confusion(test["confusion_matrix"], f"{best} — test", FIGURES_DIR / "python_confusion_test.png")
    if importance:
        plot_importance(importance, FIGURES_DIR / "python_feature_importance.png")
    write_report(version, cv, val, best, test, importance, samples)
    print(f"Saved model/python_{version}.joblib, model/metrics.json, reports/python_model_evaluation.md")
    return metrics


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train and compare the Python claim classifiers.")
    parser.add_argument("--version", default="v2", help="model version label, e.g. v2")
    train_and_evaluate(parser.parse_args().version)
