"""Model prediction and confidence comparison report (SRS 1.10.6).

Runs every unseen test claim through both models and the decision engine:
  - the Python model reads the claim's CSV row,
  - the Teachable Machine model reads the claim's Summary Card image (data/cards/test/),
  - the decision engine compares them and applies the warranty rules.

Writes reports/model_comparison.csv (every column the SRS lists, one row per claim) and
reports/model_comparison.md (summary, disagreement explanations, full table).

Run from the repo root:  python src/ml/scripts/compare_models.py
"""
from collections import Counter
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import pandas as pd  # noqa: E402

from dataset_generator.generate_cards import csv_row_to_features  # noqa: E402
from dataset_generator.generator import SCENARIOS  # noqa: E402
from src.core.config import DATA_DIR, REPORTS_DIR  # noqa: E402
from src.decision.engine import decide  # noqa: E402
from src.ml.predict import predict as python_predict  # noqa: E402
from src.teachable.predict import predict_card  # noqa: E402

# Final decision -> the claim class it corresponds to, to score the application as a whole.
DECISION_CLASS = {"Likely Valid": "Valid Claim", "Likely Invalid": "Invalid Claim", "Manual Review Required": "Manual Review"}
SCENARIO_CLASS = {scenario: label for label, names in SCENARIOS.items() for scenario in names}
DOC_FLAGS = {"receipt_present": "receipt", "warranty_card_present": "warranty card",
             "product_image_present": "product image", "repair_report_present": "repair report"}


def missing_documents_text(row: dict) -> str:
    count = int(row["missing_documents"])
    absent = [label for flag, label in DOC_FLAGS.items() if str(row[flag]).lower() != "true"]
    return f"{count} mandatory missing" + (f"; not attached: {', '.join(absent)}" if absent else "")


def disagreement_note(r: dict) -> str:
    """Plain explanation of why the two models may have disagreed on this claim."""
    right = [name for name, pred in (("Python", r["python_predicted"]), ("Teachable Machine", r["tm_predicted"])) if pred == r["actual_class"]]
    who = f"{' and '.join(right)} matched the actual class" if right else "neither model matched the actual class"
    parts = [f"Python said {r['python_predicted']} ({r['python_top_confidence']:.0%}), Teachable Machine said "
             f"{r['tm_predicted']} ({r['tm_top_confidence']:.0%}); actual {r['actual_class']} (scenario {r['scenario']}); {who}."]
    if SCENARIO_CLASS.get(r["scenario"]) != r["actual_class"]:
        parts.append("This claim's label was deliberately flipped as label noise, so a 'wrong' prediction here follows the scenario's rules.")
    if r["scenario"] == "borderline_disagreement":
        parts.append("Borderline case: expiry within a few days and repairs at the policy limit, built to be hard for both models.")
    if r["python_top_confidence"] < 0.6 or r["tm_top_confidence"] < 0.6:
        parts.append("At least one model was below the 60% minimum confidence.")
    return " ".join(parts)


def run() -> pd.DataFrame:
    test = pd.read_csv(DATA_DIR / "claims_test.csv", dtype=str)
    mapping = pd.read_csv(DATA_DIR / "cards" / "card_mapping.csv")
    card_file = dict(zip(mapping[mapping["split"] == "test"]["claim_code"], mapping[mapping["split"] == "test"]["image_file"]))
    rows = []
    for _, csv_row in test.iterrows():
        row = csv_row.to_dict()
        features = csv_row_to_features(row)
        py = python_predict(features)
        tm = predict_card(DATA_DIR / card_file[row["claim_code"]])
        result = decide(features, py, tm)
        failed = [f"{f.rule} ({f.severity})" for f in result.findings if not f.passed]
        rows.append({
            "claim_id": row["claim_code"],
            "actual_class": row["label"],
            "scenario": row["scenario"],
            "python_predicted": py.label,
            "python_conf_valid": py.probabilities.get("Valid Claim", 0),
            "python_conf_invalid": py.probabilities.get("Invalid Claim", 0),
            "python_conf_manual_review": py.probabilities.get("Manual Review", 0),
            "python_top_confidence": py.confidence,
            "card_filename": card_file[row["claim_code"]],
            "tm_predicted": tm.label,
            "tm_conf_valid": tm.probabilities.get("Valid Claim", 0),
            "tm_conf_invalid": tm.probabilities.get("Invalid Claim", 0),
            "tm_conf_manual_review": tm.probabilities.get("Manual Review", 0),
            "tm_top_confidence": tm.confidence,
            "classes_match": result.classes_match,
            "confidence_difference": result.confidence_gap,
            "consistency_status": result.consistency,
            "warranty_rule_result": "all rules passed" if not failed else "failed: " + ", ".join(failed),
            "missing_documents": missing_documents_text(row),
            "contradictions": "; ".join(result.contradictions) or "none",
            "duplicate_indicators": "none (dataset claims have no claim history)",
            "final_decision": result.decision,
            "decision_correct": DECISION_CLASS[result.decision] == row["label"],
            "python_version": py.model_version,
            "tm_version": tm.model_version,
        })
    df = pd.DataFrame(rows)
    df["disagreement_explanation"] = [disagreement_note(r) if not r["classes_match"] else "" for r in df.to_dict("records")]
    return df


def write_report(df: pd.DataFrame) -> None:
    n = len(df)
    py_acc = (df["python_predicted"] == df["actual_class"]).mean()
    tm_acc = (df["tm_predicted"] == df["actual_class"]).mean()
    consistency = Counter(df["consistency_status"])
    decisions = Counter(df["final_decision"])
    disagreements = df[~df["classes_match"]]
    manual = df[df["final_decision"] == "Manual Review Required"]
    auto = df[df["final_decision"] != "Manual Review Required"]
    auto_acc = auto["decision_correct"].mean() if len(auto) else 0

    lines = [
        "# Model prediction and confidence comparison (SRS 1.10.6)\n",
        f"Generated by `python src/ml/scripts/compare_models.py` on all {n} unseen test claims. Never hand-edited. "
        f"Python model {df['python_version'].iloc[0]}, Teachable Machine model {df['tm_version'].iloc[0]}. "
        "Full table with every column: `reports/model_comparison.csv`.\n",
        "Confidence difference = |Python top-class confidence − Teachable Machine top-class confidence|.\n",
        "## Overall comparison summary\n",
        "| Measure | Value |", "|---|---|",
        f"| Test claims | {n} |",
        f"| Python model accuracy | {py_acc:.2%} |",
        f"| Teachable Machine accuracy | {tm_acc:.2%} |",
        f"| Predicted classes match | {df['classes_match'].mean():.2%} ({df['classes_match'].sum()} of {n}) |",
        f"| Average confidence difference | {df['confidence_difference'].mean():.3f} |",
        f"| Average difference when classes match | {df[df['classes_match']]['confidence_difference'].mean():.3f} |",
        f"| Sent to manual review | {len(manual)} ({len(manual) / n:.0%}) |",
        f"| Accuracy of automatic decisions (Likely Valid / Likely Invalid) | {auto_acc:.2%} of {len(auto)} |",
        "",
        "Consistency status: " + ", ".join(f"{k} {v}" for k, v in consistency.most_common()) + ".\n",
        "Final decisions: " + ", ".join(f"{k} {v}" for k, v in decisions.most_common()) + ".\n",
        "Claims with different model predictions, low confidence, missing evidence or large confidence "
        "differences are sent to manual review by the decision engine, so the automatic decisions are the "
        "ones both models and the rules agree on.\n",
        f"## Major disagreements ({len(disagreements)})\n",
    ]
    lines += [f"- **{r['claim_id']}** — {r['disagreement_explanation']} Final decision: {r['final_decision']}."
              for r in disagreements.to_dict("records")] or ["None."]
    table_cols = ["claim_id", "actual_class", "python_predicted", "python_conf_valid", "python_conf_invalid", "python_conf_manual_review",
                  "card_filename", "tm_predicted", "tm_conf_valid", "tm_conf_invalid", "tm_conf_manual_review", "classes_match",
                  "confidence_difference", "consistency_status", "warranty_rule_result", "missing_documents", "contradictions",
                  "duplicate_indicators", "final_decision"]
    lines += ["", "## All test claims\n", df[table_cols].to_markdown(index=False, floatfmt=".3f"), ""]
    (REPORTS_DIR / "model_comparison.md").write_text("\n".join(lines), encoding="utf-8")
    df.to_csv(REPORTS_DIR / "model_comparison.csv", index=False)
    print(f"Python {py_acc:.2%} | Teachable {tm_acc:.2%} | match {df['classes_match'].mean():.2%} | "
          f"manual review {len(manual)} | automatic decisions correct {auto_acc:.2%}")


if __name__ == "__main__":
    write_report(run())
