"""Claim checks that need the database: duplicates, document contradictions, the
preparation check before submitting, warranty status, risk level and the claim summary."""
from datetime import date
from difflib import SequenceMatcher

from sqlalchemy.orm import Session

from src.core.models import Claim, Product
from src.ml.features import document_value, missing_mandatory, normalise_serial, present_document_types, serials_match, warranty_end
from src.teachable.dates import warranty_status as classify_warranty

DOC_LABELS = {
    "receipt": "Purchase receipt / invoice", "warranty_card": "Warranty card", "product_image": "Product photo",
    "serial_photo": "Serial-number photo", "fault_evidence": "Fault / damage evidence", "fault_video": "Fault video",
    "diagnostic_report": "Diagnostic report", "repair_report": "Repair report",
}
CLOSED_STATUSES = ("Rejected", "Closed")
SIMILAR_DESCRIPTION = 0.85     # difflib ratio above which two fault descriptions count as near-identical


def warranty_info(product: Product, today: date, alert_days: int) -> dict:
    """Standard + extended warranty with status Active / Expiring / Expired / Extended (SRS viii)."""
    standard = next((w for w in product.warranties if w.kind == "standard"), None)
    extended = next((w for w in product.warranties if w.kind == "extended"), None)
    end = warranty_end(product)
    if end is None:
        return {"provider": "", "start": None, "expiry": None, "status": "expired", "active": False, "daysLeft": 0, "extended": None}
    label = classify_warranty(end, extended=extended is not None and (standard is None or today > standard.end_date),
                              today=today, alert_days=alert_days)
    status = {"Active": "active", "Expiring Soon": "expiring", "Expired": "expired", "Extended": "extended"}[label]
    base = standard or extended
    return {
        "provider": base.provider, "start": base.start_date.isoformat(), "expiry": (standard or extended).end_date.isoformat(),
        "status": status, "active": status != "expired", "daysLeft": (end - today).days,
        "serviceCenter": base.service_center, "coverage": base.coverage_conditions, "exclusions": base.exclusions,
        "extended": {"provider": extended.provider, "expiry": extended.end_date.isoformat()} if extended else None,
    }


def find_duplicates(db: Session, claim: Claim) -> list[dict]:
    """Possible duplicates of this claim among other submitted claims (SRS xxx, xxxi).

    Returns [{"reason": str, "claim": Claim}], most specific reasons first.
    """
    others = db.query(Claim).filter(Claim.id != claim.id, Claim.status != "Draft").all()
    found: list[dict] = []

    def add(reason, other):
        found.append({"reason": reason, "claim": other})

    for doc in claim.documents:
        if doc.duplicate_of:
            other = db.query(Claim).filter_by(claim_code=doc.duplicate_of).first()
            if other:
                add(f"the same {DOC_LABELS.get(doc.doc_type, doc.doc_type).lower()} file was already used on {other.claim_code}", other)
    for other in others:
        if claim.invoice_number and other.invoice_number and claim.invoice_number.strip().upper() == other.invoice_number.strip().upper():
            add(f"invoice {claim.invoice_number} was already used on {other.claim_code}", other)
        if other.product_id == claim.product_id and other.status not in CLOSED_STATUSES:
            if other.fault_category == claim.fault_category:
                add(f"{other.claim_code} is an open claim for the same product and fault", other)
            elif claim.fault_description and other.fault_description and \
                    SequenceMatcher(None, claim.fault_description.lower(), other.fault_description.lower()).ratio() >= SIMILAR_DESCRIPTION:
                add(f"the fault description is almost identical to {other.claim_code}", other)
        serial = normalise_serial(claim.serial_number)
        if serial and other.user_id != claim.user_id and normalise_serial(other.serial_number) == serial:
            add(f"serial number {claim.serial_number} was already claimed by another customer on {other.claim_code}", other)
    # One reason per related claim is enough for the reviewer.
    seen, unique = set(), []
    for item in found:
        if item["claim"].id not in seen:
            seen.add(item["claim"].id)
            unique.append(item)
    return unique


def document_contradictions(claim: Claim, product: Product, repairs, today: date) -> list[str]:
    """Conflicts between the claim, the product record and the documents (SRS xxviii)."""
    issues: list[str] = []
    for doc in claim.documents:
        doc_date = document_value(doc, "purchase_date")
        if doc_date and product.purchase_date and doc_date != product.purchase_date.isoformat():
            issues.append(f"{DOC_LABELS.get(doc.doc_type, doc.doc_type)} shows purchase date {doc_date}, "
                          f"but the product record says {product.purchase_date.isoformat()}.")
        doc_model = normalise_serial(document_value(doc, "model_number"))
        if doc_model and product.model_number and doc_model != normalise_serial(product.model_number):
            issues.append(f"{DOC_LABELS.get(doc.doc_type, doc.doc_type)} shows model {document_value(doc, 'model_number')}, "
                          f"but the product is model {product.model_number}.")
    for r in repairs:
        if r.repair_date and product.purchase_date and r.repair_date < product.purchase_date:
            issues.append(f"A repair on {r.repair_date.isoformat()} is dated before the purchase date.")
    if product.purchase_date and today < product.purchase_date:
        issues.append("The claim date is before the purchase date.")
    return issues


def preparation(claim: Claim, product: Product, repairs, policy: dict, today: date, alert_days: int) -> dict:
    """What is missing or risky before the claim is submitted (SRS xxxiii)."""
    missing_fields = [label for label, value in (
        ("fault", claim.fault_category), ("fault date", claim.fault_date),
        ("fault description", claim.fault_description), ("serial number", claim.serial_number),
    ) if not value]
    missing_docs = missing_mandatory(claim.documents, policy)
    present = sorted(present_document_types(claim.documents) & set(DOC_LABELS))

    deadlines: list[str] = []
    w = warranty_info(product, today, alert_days)
    if w["status"] == "expired":
        deadlines.append(f"The warranty ended {abs(w['daysLeft'])} days ago (grace period: {policy.get('grace_period_days', 0)} days).")
    elif w["daysLeft"] <= alert_days:
        deadlines.append(f"The warranty ends in {w['daysLeft']} days, on {w['expiry']}.")
    period = policy.get("claim_reporting_period_days")
    if claim.fault_date and period:
        left = period - (today - claim.fault_date).days
        deadlines.append(f"Claims must be reported within {period} days of the fault: "
                         + (f"{left} days left." if left >= 0 else f"the deadline passed {-left} days ago."))

    contradictions = document_contradictions(claim, product, repairs, today)
    if claim.fault_date and product.purchase_date and claim.fault_date < product.purchase_date:
        contradictions.append("The fault date is before the purchase date.")
    if claim.fault_date and claim.fault_date > today:
        contradictions.append("The fault date is in the future.")
    if not serials_match(claim, product, claim.documents):
        contradictions.append("The serial number does not match the product record or the documents.")

    actions = [f"Add the {f}." for f in missing_fields]
    actions += [f"Upload the {DOC_LABELS.get(d, d).lower()}." for d in missing_docs]
    actions += ["Check the dates and serial number shown above." for _ in contradictions[:1]]
    unchecked = [d for d in claim.documents if d.extracted and not d.verified]
    if unchecked:
        actions.append("Confirm the details read from your uploaded documents.")

    checks = 4 + len(policy.get("mandatory_documents", [])) + 1
    passed = (4 - len(missing_fields)) + (len(policy.get("mandatory_documents", [])) - len(missing_docs)) + (0 if contradictions else 1)
    return {
        "readiness": round(max(passed, 0) / checks, 2),
        "missingFields": missing_fields,
        "missingDocuments": [DOC_LABELS.get(d, d) for d in missing_docs],
        "missingDocumentTypes": missing_docs,
        "presentDocuments": [DOC_LABELS[d] for d in present],
        "deadlines": deadlines,
        "contradictions": contradictions,
        "actions": actions,
    }


def risk_level(final_decision: str, contradictions: list[str], duplicates: list) -> str:
    """High: likely invalid, contradictions or duplicates. Medium: manual review. Low: likely valid."""
    if final_decision == "Likely Invalid" or contradictions or duplicates:
        return "high"
    if final_decision == "Manual Review Required":
        return "medium"
    return "low"


def claim_summary(claim: Claim, product: Product, features, result, warranty: dict) -> str:
    """Plain-language summary of the claim for users and reviewers (SRS xxxii).

    Built from the stored facts and the decision engine's findings; it describes the result,
    it does not decide it.
    """
    failed = [f.message for f in result.findings if not f.passed]
    docs = ", ".join(sorted({DOC_LABELS.get(d.doc_type, d.doc_type) for d in claim.documents})) or "none"
    parts = [
        f"{product.name} ({product.brand} {product.model_number}), bought {product.purchase_date.isoformat()}, "
        f"{features.product_age_days} days old.",
        f"Warranty: {warranty['status']}, {warranty['daysLeft']} days {'left' if warranty['daysLeft'] >= 0 else 'past expiry'}.",
        f"Reported fault: {claim.fault_category.replace('_', ' ')} on {claim.fault_date.isoformat() if claim.fault_date else 'an unknown date'}"
        f"{', with ' + claim.damage_type + ' damage' if claim.damage_type in ('physical', 'water') else ''}.",
        f"Repair history: {features.previous_repairs} earlier repair(s)"
        f"{f', {features.unauthorized_repairs} at an unauthorised centre' if features.unauthorized_repairs else ''}.",
        f"Evidence uploaded: {docs}.",
        ("Issues found: " + " ".join(failed + result.contradictions)) if failed or result.contradictions else "No issues found.",
        f"Result: {result.decision} ({result.consistency}).",
    ]
    return " ".join(parts)
