import csv
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from src.core.config import DATA_DIR
from src.core.contracts import ClaimFeatures
from src.ml.card import CARDS_DIR, render_card


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


def process_split(split_name: str, csv_path: Path, variations: int):
    """Renders cards for one CSV split, partitioned by label subfolder."""
    print(f"Generating cards for {split_name} ({variations} variation(s)/claim)...")
    count = 0
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            features = csv_row_to_features(row)
            label = row["label"]
            label_dir = CARDS_DIR / split_name / label
            for v in range(variations):
                render_card(features, variation=v, output_dir=label_dir)
                count += 1
    print(f"  -> Generated {count} images in {CARDS_DIR / split_name}")


def main():
    process_split("train", DATA_DIR / "claims_train.csv", variations=2)  # 1050 * 2 = 2100
    process_split("val", DATA_DIR / "claims_val.csv", variations=1)      # 225
    process_split("test", DATA_DIR / "claims_test.csv", variations=1)    # 225
    print("All Claim Summary Cards rendered successfully.")


if __name__ == "__main__":
    main()
