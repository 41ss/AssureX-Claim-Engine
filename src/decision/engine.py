"""Model comparison, rule checks and the final decision (xxii-xxxv). Owner: Keagan.

Rules are read from policies/*.yaml and thresholds from config/thresholds.yaml;
nothing is hard-coded here (SRS 1.10.7).
"""
from pathlib import Path
import yaml
from src.core.config import POLICIES_DIR, THRESHOLDS_FILE 
from src.core.contracts import ClaimFeatures, DecisionResult, ModelPrediction, RuleFinding


# Policy and threshold loaders

def load_thresholds() -> dict:
    """Reads config/thresholds.yaml for confidence limits and
     consistency hierachy."""
    with open(THRESHOLDS_FILE, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_policy(category: str) -> dict:
    """Loads policies, falls back to consumer_electronics if unknown."""
    policy_path = POLICIES_DIR / f"{category}.yaml"
    if not policy_path.exists():
        policy_path = POLICIES_DIR / "consumer_electronics.yaml"
    with open(policy_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)


# Model Prediction and confidence comparison

def evaluate_consistency(
    py_pred: ModelPrediction,
    tm_pred: ModelPrediction,
    thresholds: dict
) -> tuple[str, bool, float]:
    """Calculates confidence gap and matches it against the thresholds hierachy"""
    classes_match = (py_pred.label == tm_pred.label)
    gap = round(abs(py_pred.confidence - tm_pred.confidence), 4)
    min_conf = thresholds.get("min_confidence", 0.60)

    # Differing classes -> Refusal
    if not classes_match:
        return "Model Disagreement", classes_match, gap
    
    # Low confidence -> Uncertain result
    if py_pred.confidence < min_conf or tm_pred.confidence < min_conf:
        return "Uncertain Result", classes_match, gap

    # Check threshold ladder (Strong match -> Acceptable Match  -> Weak Match)
    for rule in thresholds.get("consistency", []):
        status = rule.get("status")
        if status in ("Model Disagreement", "Uncertain Result"):
            continue
        max_diff = rule.get("max_difference")
        min_top = rule.get("min_top_confidence")
        if max_diff is not None and min_top is not None:
            if gap <= max_diff and py_pred.confidence >= min_top and tm_pred.confidence >= min_top: 
                return status, classes_match, gap 

    return "Weak match", classes_match, gap
    

# Business Rules And Contradictions

def evaluate_rules(features: ClaimFeatures, policy: dict) -> tuple[list[RuleFinding], list[str]]:
    """Evaluates category policy rules and identifies data contradictions."""
    findings: list[RuleFinding] = []
    contradictions: list[str] = []
    # Chronological Contradictions 
    if features.days_purchase_to_fault < 0:
        contradictions.append("Fault date precedes product purchase date.")
    if features.days_purchase_to_fault > features.product_age_days:
        contradictions.append("Fault date is reported after claim submission date.")
    if not features.serial_matches:
        contradictions.append("Serial number mismatch between claim input and evidence.")
    # Warranty Expiry Check
    grace = policy.get("grace_period_days", 0)
    effective_days_left = features.warranty_days_left + grace
    if effective_days_left < 0:
        findings.append(RuleFinding(
            rule="warranty_expired_beyond_grace",
            passed=False,
            severity="blocking",
            message=f"Warranty expired {abs(features.warranty_days_left)} days ago (grace period: {grace} days)."
        ))
    elif features.warranty_days_left < 0:
        findings.append(RuleFinding(
            rule="within_grace_period",
            passed=True,
            severity="warning",
            message=f"Claim submitted within {grace}-day post-expiry grace period."
        ))
    else:
        findings.append(RuleFinding(
            rule="warranty_active",
            passed=True,
            severity="info",
            message=f"Warranty active with {features.warranty_days_left} days remaining."
        ))
    # Damage Exclusion Checks
    exclusions = policy.get("exclusions", [])
    if features.physical_damage and "physical_damage" in exclusions:
        findings.append(RuleFinding(
            rule="excluded_damage_physical",
            passed=False,
            severity="blocking",
            message="Physical damage detected; excluded under warranty policy."
        ))
    if features.water_damage and "water_damage" in exclusions:
        findings.append(RuleFinding(
            rule="excluded_damage_liquid",
            passed=False,
            severity="blocking",
            message="Liquid/water damage detected; excluded under warranty policy."
        ))
    if features.fault_category in exclusions:
        findings.append(RuleFinding(
            rule="excluded_fault_type",
            passed=False,
            severity="blocking",
            message=f"Reported fault '{features.fault_category}' is excluded from coverage."
        ))
    # Repair and replacement conditions
    repair_cond = policy.get("repair_conditions", {})
    max_repairs = repair_cond.get("max_covered_repairs", 3)
    if features.previous_repairs > max_repairs:
        findings.append(RuleFinding(
            rule="max_repairs_exceeded",
            passed=False,
            severity="blocking",
            message=f"Prior repair count ({features.previous_repairs}) exceeds policy limit ({max_repairs})."
        ))
    replace_cond = policy.get("replacement_conditions", {})
    max_replacements = replace_cond.get("max_replacements", 1)
    if features.product_replaced_before and max_replacements <= 1:
        findings.append(RuleFinding(
            rule="prior_replacement_limit",
            passed=False,
            severity="blocking",
            message="Product has already been replaced previously."
        ))
    # Mandatory documents check 
    mandatory_docs = policy.get("mandatory_documents", [])
    doc_map = {
        "receipt": features.receipt_present,
        "warranty_card": features.warranty_card_present,
        "product_image": features.product_image_present,
        "repair_report": features.repair_report_present,
    }
    missing_list = [d for d in mandatory_docs if d in doc_map and not doc_map[d]]
    if missing_list or features.missing_documents > 0:
        findings.append(RuleFinding(
            rule="missing_mandatory_documents",
            passed=False,
            severity="warning",
            message=f"Missing mandatory documents: {', '.join(missing_list) if missing_list else 'Incomplete file upload'}."
        ))
    return findings, contradictions


# Synthesis and Natural Language Summary 
def decide(
    features: ClaimFeatures,
    py_pred: ModelPrediction,
    tm_pred: ModelPrediction
) -> DecisionResult:
    """Combines dual ML predictions, consistency status, and rule findings into final decision."""
    thresholds = load_thresholds()
    policy = load_policy(features.product_category)
    # 1. Evaluate Model Consistency
    consistency, classes_match, gap = evaluate_consistency(py_pred, tm_pred, thresholds)
    # 2. Evaluate Business Rules and Contradictions
    findings, contradictions = evaluate_rules(features, policy)
    # Separate findings by severity
    blockers = [f for f in findings if not f.passed and f.severity == "blocking"]
    warnings = [f for f in findings if not f.passed and f.severity == "warning"]
    supporting: list[str] = []
    opposing: list[str] = []
    evidence_required: list[str] = []


    # Decision Synthesis Logic 
    manual_review_triggers = set(thresholds.get("manual_review_on", ["Model Disagreement", "Uncertain Result", "Weak Match"]))
    if blockers:
        decision = "Likely Invalid"
        supporting.extend(b.message for b in blockers)
        if py_pred.label == "Valid Claim":
            opposing.append(f"Python model classified as Valid Claim ({py_pred.confidence:.0%}).")
    elif contradictions:
        decision = "Manual Review Required"
        supporting.extend(contradictions)
        evidence_required.append("Customer clarification on inconsistent claim/fault dates or serial number.")
    elif warnings:
        decision = "Manual Review Required"
        supporting.extend(w.message for w in warnings)
        evidence_required.append("Upload missing mandatory documents.")
    elif consistency in manual_review_triggers or py_pred.label == "Manual Review" or tm_pred.label == "Manual Review":
        decision = "Manual Review Required"
        supporting.append(f"Dual-model outcome flagged as {consistency} (gap: {gap:.2f}).")
        if not classes_match:
            opposing.append(f"Conflict: Python ({py_pred.label}) vs Teachable Machine ({tm_pred.label}).")
    elif py_pred.label == "Invalid Claim" and tm_pred.label == "Invalid Claim":
        decision = "Likely Invalid"
        supporting.append(f"Both models agree on Invalid Claim ({consistency}).")
    elif py_pred.label == "Valid Claim" and tm_pred.label == "Valid Claim":
        decision = "Likely Valid"
        supporting.append(f"Both models agree on Valid Claim ({consistency}).")
        supporting.append("All warranty rules and documentation checks passed.")
    else:
        decision = "Manual Review Required"
        supporting.append("Inconclusive claim parameters require human adjudication.")
    return DecisionResult(
        decision=decision,
        consistency=consistency,
        classes_match=classes_match,
        confidence_gap=gap,
        findings=findings,
        supporting=supporting,
        opposing=opposing,
        contradictions=contradictions,
        evidence_required=evidence_required,
    )
