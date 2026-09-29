"""Database records -> the JSON shapes the frontend reads (static/js/services/*)."""
from datetime import date, datetime

from sqlalchemy.orm import Session

from src.core.models import AuditLog, Claim, Product, User
from src.platform.checks import DOC_LABELS, warranty_info
from src.platform.common import user_code

STATUS_KEYS = {
    "Draft": "draft", "Submitted": "submitted", "Under Evaluation": "evaluating",
    "Additional Information Required": "info", "Manual Review": "review",
    "Approved": "approved", "Rejected": "rejected", "Closed": "closed",
}
DAMAGE_LABELS = {"none": "No physical or liquid damage", "physical": "Physical damage", "water": "Water or liquid damage"}
MODEL_NAMES = {"python": "Python Classification Model", "teachable": "Google Teachable Machine"}


def iso(value) -> str | None:
    """Dates as YYYY-MM-DD; timestamps are stored in UTC, so they get a 'Z' for the browser."""
    if not value:
        return None
    return value.isoformat() + "Z" if isinstance(value, datetime) else value.isoformat()


def humanize(key: str) -> str:
    text = (key or "").replace("_", " ")
    return text[:1].upper() + text[1:] if text else "—"


def product_json(product: Product, today: date, alert_days: int, claim_count: int = 0) -> dict:
    return {
        "id": product.product_code, "name": product.name, "category": product.category,
        "brand": product.brand, "model": product.model_number, "serialNumber": product.serial_number,
        "purchaseDate": iso(product.purchase_date), "purchasePrice": product.purchase_price,
        "retailer": product.retailer, "warranty": warranty_info(product, today, alert_days),
        "repairs": [repair_json(r) for r in product.repairs], "claimCount": claim_count,
    }


def repair_json(r) -> dict:
    return {"id": r.id, "date": iso(r.repair_date), "serviceCenter": r.service_center, "authorized": r.authorized_center,
            "partsReplaced": r.parts_replaced, "outcome": r.outcome, "cost": r.cost, "productReplaced": r.product_replaced}


def document_json(doc) -> dict:
    """OCR fields with the user's corrections applied on top (SRS vi, vii)."""
    fields = {**(doc.extracted or {}).get("fields", {}), **(doc.verified or {})}
    return {
        "id": doc.id, "name": doc.original_name, "type": doc.doc_type,
        "typeLabel": DOC_LABELS.get(doc.doc_type, doc.doc_type), "size": doc.size_bytes, "sha256": doc.sha256,
        "extracted": fields, "ocrMessage": (doc.extracted or {}).get("message", ""), "verifiedAt": bool(doc.verified),
        "duplicateOf": doc.duplicate_of or None, "uploadedAt": iso(doc.uploaded_at),
    }


def prediction_json(pred) -> dict:
    p = pred.probabilities
    return {
        "name": MODEL_NAMES.get(pred.model_version.model_name, pred.model_version.model_name),
        "version": pred.model_version.version,
        "prediction": pred.label,
        "confidence": {"valid": p.get("Valid Claim", 0), "invalid": p.get("Invalid Claim", 0), "review": p.get("Manual Review", 0)},
    }


def latest_predictions(claim: Claim) -> tuple:
    """The most recent Python and Teachable predictions (earlier ones stay in the history)."""
    py = next((p for p in reversed(claim.predictions) if p.model_version.model_name == "python"), None)
    tm = next((p for p in reversed(claim.predictions) if p.model_version.model_name == "teachable"), None)
    return py, tm


def timeline(claim: Claim) -> list[dict]:
    steps = [{"label": "Draft created", "timestamp": iso(claim.created_at), "complete": True}]
    if claim.submitted_at:
        steps.append({"label": "Submitted", "timestamp": iso(claim.submitted_at), "complete": True})
    if claim.evaluated_at:
        steps.append({"label": f"Evaluated — {claim.final_decision}", "timestamp": iso(claim.evaluated_at), "complete": True})
    for r in claim.reviews:
        steps.append({"label": f"Reviewer: {r.action.replace('_', ' ')}", "timestamp": iso(r.created_at), "complete": True})
    steps.append({"label": f"Current status: {claim.status}", "timestamp": None, "complete": claim.status in ("Approved", "Rejected", "Closed"),
                  "current": claim.status not in ("Approved", "Rejected", "Closed")})
    return steps


def claim_json(db: Session, claim: Claim, viewer: User, today: date, alert_days: int) -> dict:
    product = claim.product
    detail = claim.decision_detail or {}
    py, tm = latest_predictions(claim)
    analysis = None
    if py and tm:
        analysis = {
            "modelOne": prediction_json(py), "modelTwo": prediction_json(tm),
            "consistency": claim.consistency, "confidenceDifference": claim.confidence_gap,
            "classesMatch": py.label == tm.label,
            "cardUrl": f"/api/claims/{claim.claim_code}/card" if claim.card_path else None,
        }
    reviewer = db.get(User, claim.reviewer_id) if claim.reviewer_id else None
    data = {
        "id": claim.claim_code, "userId": user_code(claim.user), "claimant": claim.user.full_name,
        "product": {"id": product.product_code, "name": product.name, "category": product.category, "brand": product.brand,
                    "model": product.model_number, "serialNumber": product.serial_number, "purchaseDate": iso(product.purchase_date)},
        "serialNumber": claim.serial_number, "invoiceNumber": claim.invoice_number,
        "faultCategory": claim.fault_category, "faultType": humanize(claim.fault_category),
        "damageType": claim.damage_type, "damageLabel": DAMAGE_LABELS.get(claim.damage_type, claim.damage_type),
        "description": claim.fault_description, "notes": claim.notes,
        "previousReplacement": claim.previous_replacement, "replacementDetails": claim.replacement_details,
        "incidentDate": iso(claim.fault_date), "createdAt": iso(claim.created_at), "submittedAt": iso(claim.submitted_at),
        "status": STATUS_KEYS.get(claim.status, "draft"), "stage": claim.status,
        "warranty": warranty_info(product, today, alert_days),
        "repairCount": len(product.repairs), "unauthorizedRepairs": sum(1 for r in product.repairs if not r.authorized_center),
        "documents": [document_json(d) for d in claim.documents],
        "analysis": analysis,
        "decision": {
            "result": claim.final_decision, "explanation": detail.get("explanation", ""),
            "supportingFactors": detail.get("supporting", []), "opposingFactors": detail.get("opposing", []),
            "contradictions": detail.get("contradictions", []), "missingDocuments": detail.get("missingDocuments", []),
            "duplicateWarning": detail.get("duplicate"), "rules": [
                {"rule": r.rule, "passed": r.passed, "severity": r.severity, "message": r.message} for r in claim.rule_results],
            "evidenceRequired": detail.get("evidenceRequired", []),
        },
        "summary": claim.summary, "riskLevel": claim.risk_level, "reviewer": reviewer.full_name if reviewer else None,
        "requiredDocumentTypes": detail.get("missingDocumentTypes", []),
        "reviews": [{"reviewer": r.reviewer.full_name, "action": r.action.replace("_", " "), "comment": r.comment,
                     "timestamp": iso(r.created_at)} for r in claim.reviews],
        "timeline": timeline(claim),
    }
    if viewer.role in ("reviewer", "admin"):
        entries = db.query(AuditLog).filter_by(target=claim.claim_code).order_by(AuditLog.id).all()
        names = {u.id: u.full_name for u in db.query(User).filter(User.id.in_({e.user_id for e in entries if e.user_id})).all()}
        data["auditHistory"] = [{"action": e.action.replace("_", " "), "actor": names.get(e.user_id, "System"),
                                 "detail": e.detail.get("summary", ""), "timestamp": iso(e.created_at)} for e in entries]
    return data
