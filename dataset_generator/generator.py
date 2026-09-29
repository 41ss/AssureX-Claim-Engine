"""Common warranty-claim dataset generator Owner: Victor.

Every claim comes from a named scenario function so its label traces to a written rule,
not a random draw. A small amount of label noise is added per-split afterwards so the
model is not trivially perfect.
"""
import csv
import random
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
POLICIES_DIR = ROOT / "policies"
DATA_DIR = ROOT / "data"

CLASSES = ("Valid Claim", "Invalid Claim", "Manual Review")
CLAIMS_PER_CLASS = 500
SEED = 42
LABEL_NOISE_RATE = 0.04   # fraction of claims per split whose label gets flipped

# How often each optional document is attached, in every class. A repair report only
# exists when the product was repaired before. (v1 of the dataset attached every optional
# document to almost every claim, so the model learned "no repair report = manual review".)
OPTIONAL_DOC_RATES = {"warranty_card": 0.75, "product_image": 0.7, "diagnostic_report": 0.3, "fault_video": 0.35}
REPAIR_REPORT_RATE_IF_REPAIRED = 0.85

POLICIES = {p.stem: yaml.safe_load(p.read_text()) for p in POLICIES_DIR.glob("*.yaml")}
CATEGORIES = list(POLICIES.keys())

SCENARIOS = {
    "Valid Claim": ["normal_valid", "valid_with_repair_history", "valid_near_expiry"],
    "Invalid Claim": ["expired_warranty", "excluded_damage", "excessive_repairs"],
    "Manual Review": ["missing_documents", "serial_mismatch", "contradiction_bad_dates", "borderline_disagreement"],
}

FIELDNAMES = [
    "claim_code", "product_category", "product_age_days", "warranty_months",
    "warranty_days_left", "fault_category", "days_purchase_to_fault", "previous_repairs",
    "product_replaced_before", "physical_damage", "water_damage", "receipt_present",
    "warranty_card_present", "product_image_present", "repair_report_present",
    "serial_matches", "missing_documents", "scenario", "label",
]


def choose_optional_docs(optional, previous_repairs, rng):
    """Which optional documents a customer attached, drawn at realistic rates."""
    chosen = set()
    for doc in optional:
        if doc == "repair_report":
            if previous_repairs > 0 and rng.random() < REPAIR_REPORT_RATE_IF_REPAIRED:
                chosen.add(doc)
        elif rng.random() < OPTIONAL_DOC_RATES.get(doc, 0.5):
            chosen.add(doc)
    return chosen


def doc_flags(present_docs, mandatory_docs):
    missing = [d for d in mandatory_docs if d not in present_docs]
    return {
        "receipt_present": "receipt" in present_docs,
        "warranty_card_present": "warranty_card" in present_docs,
        "product_image_present": "product_image" in present_docs,
        "repair_report_present": "repair_report" in present_docs,
        "missing_documents": len(missing),
    }


def generate_claim(claim_id, label, scenario, category, rng):
    policy = POLICIES[category]
    warranty_days = policy["coverage_duration_months"] * 30
    grace = policy["grace_period_days"]
    mandatory = policy["mandatory_documents"]
    optional = policy["optional_documents"]
    covered_faults = policy["covered_faults"]
    excluded = policy["exclusions"]
    max_repairs = policy["repair_conditions"]["max_covered_repairs"]

    removed_docs = set()      # documents a scenario takes away
    physical_damage = water_damage = False
    serial_matches = True
    product_replaced_before = False
    previous_repairs = 0

    if scenario == "normal_valid":
        product_age_days = rng.randint(10, warranty_days - 30)
        days_purchase_to_fault = rng.randint(1, product_age_days)
        fault_category = rng.choice(covered_faults)
        previous_repairs = rng.choice([0, 0, 1])

    elif scenario == "valid_with_repair_history":
        product_age_days = rng.randint(60, warranty_days - 15)
        days_purchase_to_fault = rng.randint(30, product_age_days)
        fault_category = rng.choice(covered_faults)
        previous_repairs = rng.randint(1, max_repairs)

    elif scenario == "valid_near_expiry":
        product_age_days = warranty_days - rng.randint(1, 20)
        days_purchase_to_fault = rng.randint(max(1, product_age_days - 15), product_age_days)
        fault_category = rng.choice(covered_faults)

    elif scenario == "expired_warranty":
        overrun = rng.randint(grace + 5, grace + 120)
        product_age_days = warranty_days + overrun
        days_purchase_to_fault = product_age_days - rng.randint(0, 10)
        fault_category = rng.choice(covered_faults)

    elif scenario == "excluded_damage":
        product_age_days = rng.randint(10, warranty_days - 30)
        days_purchase_to_fault = rng.randint(1, product_age_days)
        fault_category = rng.choice(excluded)
        physical_damage, water_damage = rng.choice([(True, False), (False, True)])

    elif scenario == "excessive_repairs":
        product_age_days = rng.randint(60, warranty_days - 10)
        days_purchase_to_fault = rng.randint(30, product_age_days)
        fault_category = rng.choice(covered_faults)
        previous_repairs = rng.randint(max_repairs + 1, max_repairs + 3)
        product_replaced_before = rng.random() < 0.3

    elif scenario == "missing_documents":
        product_age_days = rng.randint(10, warranty_days - 30)
        days_purchase_to_fault = rng.randint(1, product_age_days)
        fault_category = rng.choice(covered_faults)
        drop_count = rng.randint(1, max(1, len(mandatory) - 1))
        removed_docs |= set(rng.sample(mandatory, drop_count))

    elif scenario == "serial_mismatch":
        product_age_days = rng.randint(10, warranty_days - 30)
        days_purchase_to_fault = rng.randint(1, product_age_days)
        fault_category = rng.choice(covered_faults)
        serial_matches = False

    elif scenario == "contradiction_bad_dates":
        product_age_days = rng.randint(10, warranty_days - 30)
        days_purchase_to_fault = -rng.randint(1, 15)   # fault logged before purchase
        fault_category = rng.choice(covered_faults)

    elif scenario == "borderline_disagreement":
        product_age_days = warranty_days + rng.choice([-1, 0, 1, 2])
        days_purchase_to_fault = rng.randint(max(1, product_age_days - 5), max(product_age_days, 1))
        fault_category = rng.choice(covered_faults)
        previous_repairs = max_repairs
        removed_docs.add("warranty_card")

    else:
        raise ValueError(f"unknown scenario: {scenario}")

    present_docs = (set(mandatory) | choose_optional_docs(optional, previous_repairs, rng)) - removed_docs
    warranty_days_left = warranty_days - product_age_days
    row = {
        "claim_code": f"CLM-{claim_id:05d}",
        "product_category": category,
        "product_age_days": product_age_days,
        "warranty_months": policy["coverage_duration_months"],
        "warranty_days_left": warranty_days_left,
        "fault_category": fault_category,
        "days_purchase_to_fault": days_purchase_to_fault,
        "previous_repairs": previous_repairs,
        "product_replaced_before": product_replaced_before,
        "physical_damage": physical_damage,
        "water_damage": water_damage,
        "serial_matches": serial_matches,
        "scenario": scenario,
        "label": label,
    }
    row.update(doc_flags(present_docs, mandatory))
    return row


def stratified_split(rows_by_class):
    train, val, test = [], [], []
    for label in CLASSES:
        rows = rows_by_class[label]
        train += rows[:350]
        val += rows[350:425]
        test += rows[425:500]
    return train, val, test


def apply_label_noise(rows, rng):
    """Flip a small fraction of labels to a different class so the model isn't trivially perfect."""
    n_flip = int(len(rows) * LABEL_NOISE_RATE)
    for row in rng.sample(rows, n_flip):
        row["label"] = rng.choice([c for c in CLASSES if c != row["label"]])


def build_dataset(seed=SEED):
    rng = random.Random(seed)
    rows_by_class = {label: [] for label in CLASSES}
    claim_id = 1
    for label in CLASSES:
        names = SCENARIOS[label]
        for i in range(CLAIMS_PER_CLASS):
            category = rng.choice(CATEGORIES)
            rows_by_class[label].append(
                generate_claim(claim_id, label, names[i % len(names)], category, rng)
            )
            claim_id += 1
        rng.shuffle(rows_by_class[label])

    train, val, test = stratified_split(rows_by_class)
    for split in (train, val, test):
        rng.shuffle(split)
        apply_label_noise(split, rng)
    return train, val, test


def write_csv(rows, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)


if __name__ == "__main__":
    train, val, test = build_dataset()
    write_csv(train, DATA_DIR / "claims_train.csv")
    write_csv(val, DATA_DIR / "claims_val.csv")
    write_csv(test, DATA_DIR / "claims_test.csv")
    print(f"train={len(train)} val={len(val)} test={len(test)}")