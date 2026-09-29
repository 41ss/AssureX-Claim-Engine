import csv
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from src.core.config import DATA_DIR
from src.core.contracts import ClaimFeatures
from src.ml.card import CARDS_DIR, EVALUATION_VARIATION, render_card


def csv_row_to_features(row: dict) -> ClaimFeatures:
    """Maps CSV columns into ClaimFeatures."""
    return ClaimFeatures(
        claim_code=row["claim_code"],
        product_category=row["product_category"],
        product_age_days=int(row["product_age_days"]),
        warranty_months=int(row["warranty_months"]),
        warranty_days_left=int(row["warranty_days_left"]),
        fault_category=row["fault_category"],
        days_purchase_to_fault=int(row["days_purchase_to_fault"]),
        previous_repairs=int(row["previous_repairs"]),
        product_replaced_before=(row["product_replaced_before"].lower() == "true"),
        physical_damage=(row["physical_damage"].lower() == "true"),
        water_damage=(row["water_damage"].lower() == "true"),
        receipt_present=(row["receipt_present"].lower() == "true"),
        warranty_card_present=(row["warranty_card_present"].lower() == "true"),
        product_image_present=(row["product_image_present"].lower() == "true"),
        repair_report_present=(row["repair_report_present"].lower() == "true"),
        serial_matches=(row["serial_matches"].lower() == "true"),
        missing_documents=int(row["missing_documents"]),
    )


def process_split(split_name: str, csv_path: Path, variations: list[int]) -> list[dict]:
    """Renders cards for one CSV split into <split>/<label>/ and returns their mapping rows."""
    print(f"Generating cards for {split_name} (variation(s) {variations})...")
    mapping = []
    with open(csv_path, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            features = csv_row_to_features(row)
            label_dir = CARDS_DIR / split_name / row["label"]
            for v in variations:
                path = render_card(features, variation=v, output_dir=label_dir)
                mapping.append({
                    "claim_code": row["claim_code"], "split": split_name, "label": row["label"],
                    "variation": v, "image_file": path.relative_to(DATA_DIR).as_posix(),
                })
    print(f"  -> Generated {len(mapping)} images in {CARDS_DIR / split_name}")
    return mapping


def main():
    # Training uses both variations (1050 * 2 = 2100 images). Validation, test and live claims
    # use one card each, in EVALUATION_VARIATION (chosen on the validation split).
    mapping = process_split("train", DATA_DIR / "claims_train.csv", [0, 1])
    mapping += process_split("val", DATA_DIR / "claims_val.csv", [EVALUATION_VARIATION])
    mapping += process_split("test", DATA_DIR / "claims_test.csv", [EVALUATION_VARIATION])
    with open(CARDS_DIR / "card_mapping.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(mapping[0]))
        writer.writeheader()
        writer.writerows(mapping)
    print(f"Wrote {len(mapping)} rows to {CARDS_DIR / 'card_mapping.csv'}")


if __name__ == "__main__":
    main()
