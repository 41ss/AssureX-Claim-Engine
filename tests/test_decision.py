import pytest
from src.core.contracts import ClaimFeatures, ModelPrediction
from src.decision.engine import decide, evaluate_consistency
@pytest.fixture
def base_features():
    return ClaimFeatures(
        claim_code="CLM-TEST-001",
        product_category="consumer_electronics",
        product_age_days=180,
        warranty_months=12,
        warranty_days_left=180,
        fault_category="display",
        days_purchase_to_fault=150,
        previous_repairs=0,
        product_replaced_before=False,
        physical_damage=False,
        water_damage=False,
        receipt_present=True,
        warranty_card_present=True,
        product_image_present=True,
        repair_report_present=False,
        serial_matches=True,
        missing_documents=0,
    )
def test_clean_valid_claim_strong_match(base_features):
    py_pred = ModelPrediction(
        model_name="python",
        model_version="v1",
        label="Valid Claim",
        probabilities={"Valid Claim": 0.95, "Invalid Claim": 0.03, "Manual Review": 0.02}
    )
    tm_pred = ModelPrediction(
        model_name="teachable",
        model_version="v1",
        label="Valid Claim",
        probabilities={"Valid Claim": 0.92, "Invalid Claim": 0.05, "Manual Review": 0.03}
    )
    result = decide(base_features, py_pred, tm_pred)
    assert result.decision == "Likely Valid"
    assert result.consistency == "Strong Match"
    assert result.classes_match is True
    assert result.confidence_gap == 0.03
    assert len(result.contradictions) == 0
def test_physical_damage_exclusion_override(base_features):
    base_features.physical_damage = True
    py_pred = ModelPrediction(
        model_name="python",
        model_version="v1",
        label="Valid Claim",
        probabilities={"Valid Claim": 0.85, "Invalid Claim": 0.10, "Manual Review": 0.05}
    )
    tm_pred = ModelPrediction(
        model_name="teachable",
        model_version="v1",
        label="Valid Claim",
        probabilities={"Valid Claim": 0.80, "Invalid Claim": 0.15, "Manual Review": 0.05}
    )
    result = decide(base_features, py_pred, tm_pred)
    assert result.decision == "Likely Invalid"
    assert any("Physical damage detected" in msg for msg in result.supporting)
def test_model_disagreement_routes_to_manual_review(base_features):
    py_pred = ModelPrediction(
        model_name="python",
        model_version="v1",
        label="Valid Claim",
        probabilities={"Valid Claim": 0.88, "Invalid Claim": 0.08, "Manual Review": 0.04}
    )
    tm_pred = ModelPrediction(
        model_name="teachable",
        model_version="v1",
        label="Invalid Claim",
        probabilities={"Valid Claim": 0.15, "Invalid Claim": 0.80, "Manual Review": 0.05}
    )
    result = decide(base_features, py_pred, tm_pred)
    assert result.decision == "Manual Review Required"
    assert result.consistency == "Model Disagreement"
    assert result.classes_match is False
def test_serial_mismatch_creates_contradiction(base_features):
    base_features.serial_matches = False
    py_pred = ModelPrediction(
        model_name="python",
        model_version="v1",
        label="Valid Claim",
        probabilities={"Valid Claim": 0.90, "Invalid Claim": 0.05, "Manual Review": 0.05}
    )
    tm_pred = ModelPrediction(
        model_name="teachable",
        model_version="v1",
        label="Valid Claim",
        probabilities={"Valid Claim": 0.85, "Invalid Claim": 0.10, "Manual Review": 0.05}
    )
    result = decide(base_features, py_pred, tm_pred)
    assert result.decision == "Manual Review Required"
    assert "Serial number mismatch" in result.contradictions[0]