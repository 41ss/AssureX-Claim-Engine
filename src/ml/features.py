"""Data pre-processing (SRS xvi): database records -> ClaimFeatures. Owner: Victor.

Produces the same fields as the dataset CSV, so a live claim reaches the Python model and
the Claim Summary Card in the same shape as the training data. Missing values get safe
defaults (no fault date -> 0 days; unknown fault -> "unknown").
"""
from datetime import date

from src.core.contracts import ClaimFeatures

# Document types that count as each piece of evidence.
RECEIPT_TYPES = {"receipt", "invoice"}
PRODUCT_IMAGE_TYPES = {"product_image", "damage_image"}
FAULT_EVIDENCE_TYPES = {"fault_evidence", "fault_video", "damage_image"}


def normalise_serial(value: str) -> str:
    """'sn-123 45' and 'SN12345' compare equal."""
    return "".join(ch for ch in (value or "").upper() if ch.isalnum())


def document_value(doc, field: str) -> str:
    """The user-checked value if there is one, otherwise what OCR read.

    Document.extracted holds the OCR result {"fields": {...}, "message": ...};
    Document.verified holds the user's corrected fields.
    """
    return (doc.verified or {}).get(field) or ((doc.extracted or {}).get("fields") or {}).get(field) or ""


def serials_match(claim, product, documents) -> bool:
    """Serial entered on the claim vs the product record and every document that shows one (SRS xxvii)."""
    reference = normalise_serial(claim.serial_number) or normalise_serial(product.serial_number)
    candidates = [product.serial_number] + [document_value(d, "serial_number") for d in documents]
    return all(normalise_serial(s) == reference for s in candidates if normalise_serial(s))


def present_document_types(documents) -> set[str]:
    types = {d.doc_type for d in documents}
    if types & RECEIPT_TYPES:
        types.add("receipt")
    if types & PRODUCT_IMAGE_TYPES:
        types.add("product_image")
    if types & FAULT_EVIDENCE_TYPES:
        types.add("fault_evidence")
    return types


def missing_mandatory(documents, policy: dict) -> list[str]:
    present = present_document_types(documents)
    return [d for d in policy.get("mandatory_documents", []) if d not in present]


def warranty_end(product) -> date | None:
    """Latest end date across the standard and any extended warranty."""
    ends = [w.end_date for w in product.warranties if w.end_date]
    return max(ends) if ends else None


def build_features(claim, product, documents, repairs, policy: dict, claim_date: date | None = None) -> ClaimFeatures:
    """Turns one stored claim and its related records into ClaimFeatures."""
    claim_date = claim_date or date.today()
    purchase = product.purchase_date
    product_age_days = (claim_date - purchase).days if purchase else 0

    end = warranty_end(product)
    warranty_days_left = (end - claim_date).days if end else -product_age_days
    starts = [w.start_date for w in product.warranties if w.start_date]
    warranty_months = round((end - min(starts)).days / 30) if end and starts else product.warranty_months

    days_to_fault = (claim.fault_date - purchase).days if claim.fault_date and purchase else 0

    earlier_repairs = [r for r in repairs if not r.repair_date or r.repair_date <= claim_date]
    present = present_document_types(documents)

    return ClaimFeatures(
        claim_code=claim.claim_code,
        product_category=product.category,
        product_age_days=product_age_days,
        warranty_months=warranty_months,
        warranty_days_left=warranty_days_left,
        fault_category=claim.fault_category or "unknown",
        days_purchase_to_fault=days_to_fault,
        previous_repairs=len(earlier_repairs),
        product_replaced_before=bool(claim.previous_replacement or any(r.product_replaced for r in earlier_repairs)),
        physical_damage=claim.damage_type == "physical",
        water_damage=claim.damage_type == "water",
        receipt_present="receipt" in present,
        warranty_card_present="warranty_card" in present,
        product_image_present="product_image" in present,
        repair_report_present="repair_report" in present,
        serial_matches=serials_match(claim, product, documents),
        missing_documents=len(missing_mandatory(documents, policy)),
        unauthorized_repairs=sum(1 for r in earlier_repairs if not r.authorized_center),
    )
