from PIL import Image
from src.core.contracts import ClaimFeatures
from src.ml.card import render_card


def test_render_card_outputs_valid_png(tmp_path):
    features = ClaimFeatures(
        claim_code="CLM-CARD-001",
        product_category="consumer_electronics",
        product_age_days=100,
        warranty_months=12,
        warranty_days_left=265,
        fault_category="display",
        days_purchase_to_fault=90,
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
    # Test variation 
    p0 = render_card(features, variation=0, output_dir=tmp_path)
    p1 = render_card(features, variation=1, output_dir=tmp_path)

    assert p0.exists()
    assert p1.exists()

    with Image.open(p0) as img:
        assert img.size == (520, 680)
        assert img.format == "PNG"

    with Image.open(p1) as img:
        assert img.size == (520, 680)
