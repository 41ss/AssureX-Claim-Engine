"""Model comparison, rule checks and the final decision (xxii-xxxv). Owner: Keagan.

Rules are read from policies/*.yaml and thresholds from config/thresholds.yaml;
nothing is hard-coded here (SRS 1.10.7).
"""
import yaml

from src.core.config import POLICIES_DIR, THRESHOLDS_FILE
from src.core.contracts import ClaimFeatures, DecisionResult, ModelPrediction, RuleFinding


# Policy and threshold loaders

def load_thresholds() -> dict:
    """Reads config/thresholds.yaml for confidence limits and the consistency hierarchy."""
    with open(THRESHOLDS_FILE, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_policy(category: str) -> dict:
    """Loads the category's policy, falls back to consumer_electronics if unknown."""
    policy_path = POLICIES_DIR / f"{category}.yaml"
    if not policy_path.exists():
        policy_path = POLICIES_DIR / "consumer_electronics.yaml"
    with open(policy_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


# Model prediction and confidence comparison

def evaluate_consistency(
    py_pred: ModelPrediction,
    tm_pred: ModelPrediction,
    thresholds: dict,
) -> tuple[str, bool, float]:
    """Calculates the confidence gap and matches it against the thresholds hierarchy."""
    classes_match = py_pred.label == tm_pred.label
    gap = round(abs(py_pred.confidence - tm_pred.confidence), 4)
    min_conf = thresholds.get("min_confidence", 0.60)

    # Different classes -> disagreement
    if not classes_match:
        return "Model Disagreement", classes_match, gap

    # Low confidence -> uncertain result
    if py_pred.confidence < min_conf or tm_pred.confidence < min_conf:
        return "Uncertain Result", classes_match, gap

    # Threshold ladder (Strong Match -> Acceptable Match -> Weak Match)
    for rule in thresholds.get("consistency", []):
        status = rule.get("status")
        if status in ("Model Disagreement", "Uncertain Result"):
            continue
        max_diff = rule.get("max_difference")
        min_top = rule.get("min_top_confidence")
        if max_diff is not None and min_top is not None:
            if gap <= max_diff and py_pred.confidence >= min_top and tm_pred.confidence >= min_top:
                return status, classes_match, gap

    return "Weak Match", classes_match, gap


# Rule severity comes from the policy file's three lists (SRS 1.10.7):
#   hard_fail_rules     -> "blocking": the claim is Likely Invalid
#   manual_review_rules -> "review":   the claim goes to Manual Review
#   warning_rules       -> "warning":  shown to the reviewer, does not decide alone
# Engine rule names that are reported under a different name in the policy files:
POLICY_RULE_NAMES = {
    "excluded_damage_physical": "excluded_damage",
    "excluded_damage_liquid": "excluded_damage",
    "excluded_fault_type": "excluded_damage",
    "prior_replacement_limit": "max_replacements_exceeded",
    "missing_mandatory_documents": "missing_mandatory_document",
    "serial_number_match": "serial_number_mismatch",
}


def policy_severity(policy: dict, rule: str, default: str) -> str:
    """Severity of a failed rule according to the policy, or the engine default if the policy doesn't list it."""
    name = POLICY_RULE_NAMES.get(rule, rule)
    if name in policy.get("hard_fail_rules", []):
        return "blocking"
    if name in policy.get("manual_review_rules", []):
        return "review"
    if name in policy.get("warning_rules", []):
        return "warning"
    return default


# Business rules and contradictions

def evaluate_rules(features: ClaimFeatures, policy: dict) -> tuple[list[RuleFinding], list[str]]:
    """Evaluates the category policy rules and finds contradictions in the claim data.

    Every check adds a finding, passed or failed, so the claim page can list rules
    passed and rules failed (SRS xxxv).
    """
    findings: list[RuleFinding] = []
    contradictions: list[str] = []

    # Chronological contradictions (xxviii)
    if features.days_purchase_to_fault < 0:
        contradictions.append("Fault date precedes product purchase date.")
    if features.days_purchase_to_fault > features.product_age_days:
        contradictions.append("Fault date is reported after claim submission date.")
    if not features.serial_matches:
        contradictions.append("Serial number mismatch between claim input and evidence.")
        findings.append(RuleFinding("serial_number_match", False, "review",
                                    "Serial number on the claim does not match the documents."))
    else:
        findings.append(RuleFinding("serial_number_match", True, "info", "Serial number matches the documents."))

    # Warranty expiry and grace period
    grace = policy.get("grace_period_days", 0)
    effective_days_left = features.warranty_days_left + grace
    if effective_days_left < 0:
        findings.append(RuleFinding(
            rule="warranty_expired_beyond_grace", passed=False, severity="blocking",
            message=f"Warranty expired {abs(features.warranty_days_left)} days ago (grace period: {grace} days).",
        ))
    elif features.warranty_days_left < 0:
        findings.append(RuleFinding(
            rule="within_grace_period", passed=True, severity="warning",
            message=f"Claim submitted within the {grace}-day grace period after expiry.",
        ))
    else:
        findings.append(RuleFinding(
            rule="warranty_active", passed=True, severity="info",
            message=f"Warranty active with {features.warranty_days_left} days remaining.",
        ))

    # Damage exclusions
    exclusions = policy.get("exclusions", [])
    if features.physical_damage and "physical_damage" in exclusions:
        findings.append(RuleFinding("excluded_damage_physical", False, "blocking",
                                    "Physical damage detected; excluded under warranty policy."))
    if features.water_damage and "water_damage" in exclusions:
        findings.append(RuleFinding("excluded_damage_liquid", False, "blocking",
                                    "Liquid/water damage detected; excluded under warranty policy."))
    if not features.physical_damage and not features.water_damage:
        findings.append(RuleFinding("no_excluded_damage", True, "info", "No physical or liquid damage reported."))

    # Fault coverage
    covered = policy.get("covered_faults", [])
    if features.fault_category in exclusions:
        findings.append(RuleFinding("excluded_fault_type", False, "blocking",
                                    f"Reported fault '{features.fault_category}' is excluded from coverage."))
    elif features.fault_category in covered:
        findings.append(RuleFinding("fault_covered", True, "info",
                                    f"Reported fault '{features.fault_category}' is covered by the policy."))
    else:
        findings.append(RuleFinding("fault_not_in_covered_list", False, "review",
                                    f"Reported fault '{features.fault_category}' is not on the policy's covered list."))

    # Claim reporting period: days between the fault and the claim
    reporting_days = policy.get("claim_reporting_period_days")
    days_fault_to_claim = features.product_age_days - features.days_purchase_to_fault
    if reporting_days is not None and 0 <= features.days_purchase_to_fault <= features.product_age_days:
        if days_fault_to_claim > reporting_days:
            findings.append(RuleFinding("reported_after_reporting_period", False, "warning",
                                        f"Fault reported {days_fault_to_claim} days after it occurred; "
                                        f"the policy allows {reporting_days} days."))
        else:
            findings.append(RuleFinding("reported_within_period", True, "info",
                                        f"Fault reported within the {reporting_days}-day reporting period."))

    # Repair and replacement conditions
    repair_cond = policy.get("repair_conditions", {})
    max_repairs = repair_cond.get("max_covered_repairs", 3)
    if features.previous_repairs > max_repairs:
        findings.append(RuleFinding("max_repairs_exceeded", False, "blocking",
                                    f"Prior repair count ({features.previous_repairs}) exceeds policy limit ({max_repairs})."))
    else:
        findings.append(RuleFinding("repairs_within_limit", True, "info",
                                    f"{features.previous_repairs} prior repair(s), within the policy limit of {max_repairs}."))
    if features.unauthorized_repairs > 0:
        voids = repair_cond.get("unauthorized_repair_voids_warranty", False)
        findings.append(RuleFinding("unauthorized_repair", False, "blocking" if voids else "review",
                                    f"{features.unauthorized_repairs} repair(s) done at an unauthorised service centre"
                                    f"{'; this voids the warranty under the policy' if voids else ''}."))
    replace_cond = policy.get("replacement_conditions", {})
    max_replacements = replace_cond.get("max_replacements", 1)
    if features.product_replaced_before and max_replacements <= 1:
        findings.append(RuleFinding("prior_replacement_limit", False, "blocking",
                                    "Product has already been replaced previously."))

    # Mandatory documents
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
            rule="missing_mandatory_documents", passed=False, severity="review",
            message=f"Missing mandatory documents: {', '.join(missing_list) if missing_list else f'{features.missing_documents} required document(s)'}.",
        ))
    else:
        findings.append(RuleFinding("mandatory_documents_present", True, "info", "All mandatory documents provided."))

    for f in findings:
        if not f.passed:
            f.severity = policy_severity(policy, f.rule, f.severity)
    return findings, contradictions


# Final decision and explanation

def decide(
    features: ClaimFeatures,
    py_pred: ModelPrediction,
    tm_pred: ModelPrediction,
    extra_contradictions: list[str] | None = None,
    duplicate_indicators: list[str] | None = None,
) -> DecisionResult:
    """Combines both predictions, the consistency status and the rule findings into the final decision.

    extra_contradictions: conflicts found in the uploaded documents (e.g. receipt date differs).
    duplicate_indicators: reasons this claim may duplicate an earlier one (xxx, xxxi).
    """
    thresholds = load_thresholds()
    policy = load_policy(features.product_category)
    consistency, classes_match, gap = evaluate_consistency(py_pred, tm_pred, thresholds)
    findings, contradictions = evaluate_rules(features, policy)
    contradictions += extra_contradictions or []
    duplicates = duplicate_indicators or []
    if duplicates:
        findings.append(RuleFinding("duplicate_claim_or_document", False,
                                    policy_severity(policy, "duplicate_claim_or_document", "review"),
                                    "Possible duplicate: " + "; ".join(duplicates)))

    blockers = [f for f in findings if not f.passed and f.severity == "blocking"]
    reviews = [f for f in findings if not f.passed and f.severity == "review"]
    warnings = [f for f in findings if not f.passed and f.severity == "warning"]
    supporting: list[str] = []
    opposing: list[str] = []
    evidence_required: list[str] = []
    model_summary = f"Python model: {py_pred.label} ({py_pred.confidence:.0%}); Teachable Machine: {tm_pred.label} ({tm_pred.confidence:.0%})."

    manual_review_triggers = set(thresholds.get("manual_review_on", ["Model Disagreement", "Uncertain Result", "Weak Match"]))
    if blockers:
        decision = "Likely Invalid"
        supporting.extend(b.message for b in blockers)
        if py_pred.label == "Valid Claim":
            opposing.append(f"Python model classified as Valid Claim ({py_pred.confidence:.0%}).")
        if tm_pred.label == "Valid Claim":
            opposing.append(f"Teachable Machine classified as Valid Claim ({tm_pred.confidence:.0%}).")
        explanation = "A warranty rule fails outright: " + blockers[0].message
    elif contradictions:
        decision = "Manual Review Required"
        supporting.extend(contradictions)
        evidence_required.append("Customer clarification on inconsistent claim/fault dates or serial number.")
        explanation = "The claim contains conflicting information that a reviewer has to check."
    elif duplicates:
        decision = "Manual Review Required"
        supporting.append("Possible duplicate: " + "; ".join(duplicates))
        evidence_required.append("Confirmation that this is not a repeat of an earlier claim.")
        explanation = "This claim looks similar to an earlier claim or reuses one of its documents."
    elif reviews:
        decision = "Manual Review Required"
        supporting.extend(r.message for r in reviews)
        if any(r.rule == "missing_mandatory_documents" for r in reviews):
            evidence_required.append("Upload missing mandatory documents.")
        explanation = "Some warranty conditions need a reviewer: " + reviews[0].message
    elif consistency in manual_review_triggers or py_pred.label == "Manual Review" or tm_pred.label == "Manual Review":
        decision = "Manual Review Required"
        supporting.append(f"Dual-model outcome flagged as {consistency} (gap: {gap:.2f}).")
        if not classes_match:
            opposing.append(f"Conflict: Python ({py_pred.label}) vs Teachable Machine ({tm_pred.label}).")
        explanation = f"The warranty rules pass, but the two models are not confident enough together ({consistency})."
    elif py_pred.label == "Invalid Claim" and tm_pred.label == "Invalid Claim":
        decision = "Likely Invalid"
        supporting.append(f"Both models agree on Invalid Claim ({consistency}).")
        opposing.append("No warranty rule failed outright.")
        explanation = "Both models classify the claim as invalid with consistent confidence."
    elif py_pred.label == "Valid Claim" and tm_pred.label == "Valid Claim":
        decision = "Likely Valid"
        supporting.append(f"Both models agree on Valid Claim ({consistency}).")
        supporting.append("All warranty rules and documentation checks passed.")
        explanation = "Both models agree the claim is valid and every warranty rule passes."
    else:
        decision = "Manual Review Required"
        supporting.append("Inconclusive claim parameters require human adjudication.")
        explanation = "The result is inconclusive, so a reviewer decides."

    # Warning rules never decide on their own, but the reviewer and the customer see them.
    if decision != "Likely Invalid":
        opposing.extend(f"Warning: {w.message}" for w in warnings)

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
        explanation=f"{explanation} {model_summary}",
    )
