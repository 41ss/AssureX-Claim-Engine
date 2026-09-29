"""Tests for date parsing, warranty status, and Teachable Machine card inference."""
from datetime import date
from src.core.contracts import ClaimFeatures
from src.ml.card import render_card
from src.teachable.dates import parse_date, warranty_status
from src.core.config import TEACHABLE_MODEL_VERSION
from src.teachable.predict import predict_card


def test_parse_multiple_date_formats():
    expected = date(2026, 9, 28)
    assert parse_date("2026-09-28") == expected
    assert parse_date("28/09/2026") == expected
    assert parse_date("09/28/2026") == expected
    assert parse_date("28-Sep-2026") == expected
    assert parse_date("2026/09/28") == expected


def test_warranty_status_calculation():
    today = date(2026, 9, 28)
    # Active
    assert warranty_status(date(2026, 12, 1), today=today) == "Active"
    # Expiring soon (within 30 days)
    assert warranty_status(date(2026, 10, 15), today=today, alert_days=30) == "Expiring Soon"
    # Expired
    assert warranty_status(date(2026, 9, 1), today=today) == "Expired"
    # Extended
    assert warranty_status(date(2027, 9, 28), extended=True, today=today) == "Extended"


def test_predict_card_runs_on_rendered_image(tmp_path):
    features = ClaimFeatures(
        claim_code="CLM-TM-001",
        product_category="consumer_electronics",
        product_age_days=100,
        warranty_months=12,
        warranty_days_left=265,
        fault_category="display",
        days_purchase_to_fault=80,
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
    card_path = render_card(features, variation=0, output_dir=tmp_path)
    pred = predict_card(card_path)

    assert pred.model_name == "teachable"
    assert pred.model_version == TEACHABLE_MODEL_VERSION
    assert pred.label in ("Valid Claim", "Invalid Claim", "Manual Review")
    assert len(pred.probabilities) == 3
