import pytest
from src.core.contracts import ClaimFeatures
from src.ml.predict import predict


@pytest.fixture
def sample_valid_features():
    return ClaimFeatures(
        claim_code="CLM-ML-TEST",
        product_category="consumer_electronics",
        product_age_days=90,
        warranty_months=12,
        warranty_days_left=270,
        fault_category="display",
        days_purchase_to_fault=75,
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


def test_predict_returns_valid_probabilities(sample_valid_features):
    pred = predict(sample_valid_features)
    assert pred.model_name == "python"
    assert pred.model_version == "v1"
    assert pred.label in ("Valid Claim", "Invalid Claim", "Manual Review")
    assert len(pred.probabilities) == 3
    # Check probabilities sum to approximately 1.0
    total_prob = sum(pred.probabilities.values())
    assert abs(total_prob - 1.0) < 0.05
