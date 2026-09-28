from datetime import date
from src.core.contracts import ClaimFeatures


def build_features(claim, product, documents, repairs) -> ClaimFeatures:
    """Transforms raw database records into normalized ClaimFeatures."""
    today = date.today()

    # Product age in days
    product_age_days = (today - product.purchase_date).days if product.purchase_date else 0

    # Warranty days left (standard warranty end date)
    warranty_days = product.warranty_months * 30
    warranty_days_left = warranty_days - product_age_days

    # Days from purchase to fault occurrence
    days_to_fault = (claim.fault_date - product.purchase_date).days if claim.fault_date and product.purchase_date else 0

    # Document type detection
    doc_types = {d.doc_type for d in (documents or [])}
    receipt_present = "receipt" in doc_types or "invoice" in doc_types
    warranty_card_present = "warranty_card" in doc_types
    product_image_present = "product_image" in doc_types or "damage_image" in doc_types
    repair_report_present = "repair_report" in doc_types

    # Serial verification
    serial_matches = (claim.serial_number == product.serial_number) if claim.serial_number and product.serial_number else True

    # Count missing core documents
    mandatory = [receipt_present, product_image_present]
    missing_count = sum(1 for present in mandatory if not present)

    return ClaimFeatures(
        claim_code=claim.claim_code,
        product_category=product.category,
        product_age_days=product_age_days,
        warranty_months=product.warranty_months,
        warranty_days_left=warranty_days_left,
        fault_category=claim.fault_category or "unknown",
        days_purchase_to_fault=days_to_fault,
        previous_repairs=len(repairs or []),
        product_replaced_before=claim.previous_replacement,
        physical_damage=(claim.damage_type == "physical"),
        water_damage=(claim.damage_type == "water"),
        receipt_present=receipt_present,
        warranty_card_present=warranty_card_present,
        product_image_present=product_image_present,
        repair_report_present=repair_report_present,
        serial_matches=serial_matches,
        missing_documents=missing_count,
    )
