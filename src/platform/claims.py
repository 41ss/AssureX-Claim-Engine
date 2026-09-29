"""Claims: drafts, documents with OCR, preparation check, submission and evaluation,
listing with filters, and the downloadable claim report (SRS v-vii, x-xii, xiv, xv, xxx-xxxiv, xxxviii, xlii, xliv)."""
import hashlib
import uuid
from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.core.config import (ALLOWED_UPLOAD_TYPES, ALLOWED_VIDEO_TYPES, MAX_UPLOAD_MB, MAX_VIDEO_MB,
                             UPLOAD_DIR, VIDEO_DOC_TYPES)
from src.core.db import get_db
from src.core.models import Claim, Document, User
from src.decision.engine import load_policy
from src.ml.ocr import FIELDS, extract_fields
from src.platform.checks import DOC_LABELS, preparation
from src.platform.claim_report import build_claim_pdf
from src.platform.common import audit, current_user, is_staff, raise_alert, staff_user
from src.platform.evaluation import ModelsUnavailable, evaluate_and_store
from src.platform.products import get_product, to_date
from src.platform.serialize import claim_json, document_json
from src.platform.settings import alert_days

router = APIRouter()
OCR_DOC_TYPES = {"receipt", "invoice", "warranty_card", "serial_photo", "repair_report", "diagnostic_report"}
EDITABLE_STATUSES = ("Draft", "Additional Information Required", "Submitted")


class ClaimIn(BaseModel):
    productId: str
    faultCategory: str
    damageType: str = "none"
    faultDate: str
    description: str
    serialNumber: str = ""
    invoiceNumber: str = ""
    previousReplacement: bool = False
    replacementDetails: str = ""
    notes: str = ""


def get_claim(db: Session, code: str, user: User) -> Claim:
    claim = db.query(Claim).filter_by(claim_code=code).first()
    if claim is None or (claim.user_id != user.id and not is_staff(user)):
        raise HTTPException(404, "Claim not found.")
    return claim


def editable(claim: Claim) -> None:
    if claim.status not in EDITABLE_STATUSES:
        raise HTTPException(400, f"This claim is {claim.status.lower()} and can no longer be changed.")


def next_claim_code(db: Session) -> str:
    return f"CLM-{date.today().year}-{db.query(Claim).count() + 1:04d}"


def apply_fields(claim: Claim, body: ClaimIn) -> None:
    """Checks and copies the claim fields (SRS xi, xv)."""
    if body.damageType not in ("none", "physical", "water"):
        raise HTTPException(400, "Choose a damage type from the list.")
    if not body.faultCategory.strip():
        raise HTTPException(400, "Choose the fault.")
    if not body.description.strip():
        raise HTTPException(400, "Describe the fault.")
    claim.fault_category = body.faultCategory.strip()
    claim.damage_type = body.damageType
    claim.fault_date = to_date(body.faultDate, "Fault date")   # a future date is kept and flagged as a contradiction
    claim.fault_description = body.description.strip()
    claim.serial_number = body.serialNumber.strip()
    claim.invoice_number = body.invoiceNumber.strip()
    claim.previous_replacement = body.previousReplacement
    claim.replacement_details = body.replacementDetails.strip()
    claim.notes = body.notes.strip()


def view(db: Session, claim: Claim, user: User) -> dict:
    return claim_json(db, claim, user, date.today(), alert_days())


# ---------------- Drafts ----------------

@router.post("/claims")
def create_claim(body: ClaimIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    product = get_product(db, body.productId, user)
    claim = Claim(claim_code=next_claim_code(db), user_id=product.owner_id if is_staff(user) else user.id,
                  product_id=product.id, status="Draft")
    apply_fields(claim, body)
    db.add(claim)
    audit(db, user, "claim_created", claim.claim_code, summary=f"Draft for {product.product_code}")
    db.commit()
    return view(db, claim, user)


@router.patch("/claims/{code}")
def update_claim(code: str, body: ClaimIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    claim = get_claim(db, code, user)
    editable(claim)
    apply_fields(claim, body)
    audit(db, user, "claim_updated", claim.claim_code)
    db.commit()
    return view(db, claim, user)


@router.get("/claims/{code}")
def one_claim(code: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return view(db, get_claim(db, code, user), user)


# ---------------- Documents ----------------

@router.post("/claims/{code}/documents")
async def upload_document(code: str, doc_type: str = Form(...), file: UploadFile = File(...),
                          user: User = Depends(current_user), db: Session = Depends(get_db)):
    claim = get_claim(db, code, user)
    editable(claim)
    if doc_type not in DOC_LABELS:
        raise HTTPException(400, "Unknown document type.")
    name = file.filename or "upload"
    suffix = "." + name.rsplit(".", 1)[-1].lower() if "." in name else ""
    allowed = ALLOWED_UPLOAD_TYPES | (ALLOWED_VIDEO_TYPES if doc_type in VIDEO_DOC_TYPES else set())
    content = await file.read()
    limit_mb = MAX_VIDEO_MB if suffix in ALLOWED_VIDEO_TYPES else MAX_UPLOAD_MB
    problem = None
    if suffix not in allowed:
        problem = f"{name}: only {', '.join(sorted(t.strip('.').upper() for t in allowed))} files are accepted."
    elif len(content) > limit_mb * 1024 * 1024:
        problem = f"{name} is larger than the {limit_mb}MB limit."
    elif not content:
        problem = f"{name} is empty."
    if problem:
        raise_alert(db, "failed_upload", f"{user.email} on {claim.claim_code}: {problem}")
        db.commit()
        raise HTTPException(400, problem)

    # SHA-256 of the file: the same receipt or photo used on another claim is flagged (SRS xxxi).
    digest = hashlib.sha256(content).hexdigest()
    earlier = db.query(Document).filter(Document.sha256 == digest, Document.claim_id != claim.id).first()
    earlier_claim = db.get(Claim, earlier.claim_id) if earlier and earlier.claim_id else None

    folder = UPLOAD_DIR / claim.claim_code
    folder.mkdir(parents=True, exist_ok=True)
    stored = folder / f"{uuid.uuid4().hex}{suffix}"
    stored.write_bytes(content)
    ocr = extract_fields(stored) if doc_type in OCR_DOC_TYPES and suffix != ".mp4" else {}
    doc = Document(owner_id=claim.user_id, product_id=claim.product_id, claim_id=claim.id, doc_type=doc_type,
                   file_path=str(stored.relative_to(UPLOAD_DIR)), original_name=name, size_bytes=len(content),
                   sha256=digest, extracted=ocr, duplicate_of=earlier_claim.claim_code if earlier_claim else "")
    db.add(doc)
    audit(db, user, "document_uploaded", claim.claim_code, summary=f"{DOC_LABELS[doc_type]}: {name}")
    if earlier_claim:
        raise_alert(db, "duplicate_document", f"{name} on {claim.claim_code} is the same file as one on {earlier_claim.claim_code}.")
    db.commit()
    return document_json(doc)


@router.put("/claims/{code}/documents/{doc_id}/verified")
def verify_document(code: str, doc_id: int, values: dict, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Saves the extracted values after the user checked or corrected them (SRS vii)."""
    claim = get_claim(db, code, user)
    doc = db.query(Document).filter_by(id=doc_id, claim_id=claim.id).first()
    if doc is None:
        raise HTTPException(404, "Document not found.")
    clean = {k: str(values.get(k, "")).strip() for k in FIELDS if k in values}
    if clean.get("purchase_date"):
        clean["purchase_date"] = to_date(clean["purchase_date"], "Purchase date").isoformat()
    before = (doc.extracted or {}).get("fields", {})
    changed = {k: v for k, v in clean.items() if v != before.get(k, "")}
    doc.verified = clean
    audit(db, user, "extracted_data_corrected", claim.claim_code,
          summary=f"{DOC_LABELS[doc.doc_type]}: " + (", ".join(f"{k} -> {v}" for k, v in changed.items()) or "confirmed as read"))
    db.commit()
    return document_json(doc)


@router.delete("/claims/{code}/documents/{doc_id}")
def remove_document(code: str, doc_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    claim = get_claim(db, code, user)
    editable(claim)
    doc = db.query(Document).filter_by(id=doc_id, claim_id=claim.id).first()
    if doc is None:
        raise HTTPException(404, "Document not found.")
    (UPLOAD_DIR / doc.file_path).unlink(missing_ok=True)
    db.delete(doc)
    audit(db, user, "document_removed", claim.claim_code, summary=doc.original_name)
    db.commit()
    return {"ok": True}


@router.get("/claims/{code}/documents/{doc_id}/file")
def document_file(code: str, doc_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    claim = get_claim(db, code, user)
    doc = db.query(Document).filter_by(id=doc_id, claim_id=claim.id).first()
    if doc is None or not (UPLOAD_DIR / doc.file_path).exists():
        raise HTTPException(404, "Document not found.")
    return FileResponse(UPLOAD_DIR / doc.file_path, filename=doc.original_name)


@router.get("/claims/{code}/card")
def claim_card(code: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    claim = get_claim(db, code, user)
    if not claim.card_path:
        raise HTTPException(404, "This claim has not been evaluated yet.")
    return FileResponse(claim.card_path, media_type="image/png")


# ---------------- Preparation, submission, status ----------------

@router.get("/claims/{code}/preparation")
def claim_preparation(code: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    claim = get_claim(db, code, user)
    return preparation(claim, claim.product, claim.product.repairs, load_policy(claim.product.category), date.today(), alert_days())


@router.post("/claims/{code}/submit")
def submit_claim(code: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    claim = get_claim(db, code, user)
    editable(claim)
    if not claim.fault_date or not claim.fault_description:
        raise HTTPException(400, "Add the fault date and description before submitting.")
    audit(db, user, "claim_submitted", claim.claim_code, summary=f"from status {claim.status}")
    try:
        evaluate_and_store(db, claim, user, date.today(), alert_days())
    except ModelsUnavailable as exc:
        raise HTTPException(503, str(exc))
    return view(db, claim, user)


@router.get("/claims/{code}/status")
def claim_status(code: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    data = view(db, get_claim(db, code, user), user)
    return {"status": data["status"], "stage": data["stage"], "timeline": data["timeline"]}


@router.get("/claims/{code}/analysis")
def claim_analysis(code: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return view(db, get_claim(db, code, user), user)["analysis"]


@router.get("/claims/{code}/report")
def claim_report(code: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    claim = get_claim(db, code, user)
    pdf = build_claim_pdf(view(db, claim, user), claim.card_path)
    audit(db, user, "report_downloaded", claim.claim_code)
    db.commit()
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{claim.claim_code}-report.pdf"'})


# ---------------- Listing and search (SRS xlii) ----------------

def matches(c: dict, f: dict) -> bool:
    """True when the claim passes every active filter."""
    if f.get("search"):
        text = f"{c['id']} {c['product']['id']} {c['product']['name']} {c['product']['serialNumber']} {c['faultType']} {c['claimant']}".lower()
        if f["search"].lower() not in text:
            return False
    if f.get("status") and c["status"] != f["status"]:
        return False
    if f.get("category") and c["product"]["category"] != f["category"]:
        return False
    if f.get("warrantyStatus") and c["warranty"]["status"] != f["warrantyStatus"]:
        return False
    if f.get("risk") and c["riskLevel"] != f["risk"]:
        return False
    if f.get("consistency") and (c["analysis"] or {}).get("consistency") != f["consistency"]:
        return False
    if f.get("confidenceRange"):
        top = max((c["analysis"] or {}).get("modelOne", {}).get("confidence", {"x": 0}).values())
        band = "high" if top >= 0.8 else "medium" if top >= 0.6 else "low"
        if not c["analysis"] or band != f["confidenceRange"]:
            return False
    if f.get("reviewer"):
        if f["reviewer"] == "none" and c["reviewer"]:
            return False
        if f["reviewer"] != "none" and c["reviewer"] != f["reviewer"]:
            return False
    day = (c["submittedAt"] or c["createdAt"])[:10]
    if f.get("submittedFrom") and day < f["submittedFrom"]:
        return False
    if f.get("submittedTo") and day > f["submittedTo"]:
        return False
    return True


def list_claim_views(db: Session, user: User, filters: dict, statuses: tuple | None = None) -> list[dict]:
    query = db.query(Claim)
    if not is_staff(user):
        query = query.filter(Claim.user_id == user.id)
    if statuses:
        query = query.filter(Claim.status.in_(statuses))
    active = {k: v for k, v in filters.items() if v and v != "all"}
    rows = [view(db, c, user) for c in query.order_by(Claim.id.desc()).all()]
    return [c for c in rows if matches(c, active)]


@router.get("/claims")
def list_claims(search: str = "", status: str = "", category: str = "", warrantyStatus: str = "", risk: str = "",
                confidenceRange: str = "", consistency: str = "", reviewer: str = "", submittedFrom: str = "",
                submittedTo: str = "", limit: int = 0, user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = list_claim_views(db, user, dict(search=search, status=status, category=category, warrantyStatus=warrantyStatus,
                                           risk=risk, confidenceRange=confidenceRange, consistency=consistency,
                                           reviewer=reviewer, submittedFrom=submittedFrom, submittedTo=submittedTo))
    return rows[:limit] if limit else rows


@router.get("/reviewers")
def reviewers(user: User = Depends(staff_user), db: Session = Depends(get_db)):
    staff = db.query(User).filter(User.role.in_(("reviewer", "admin"))).order_by(User.full_name).all()
    return [{"value": u.full_name, "label": u.full_name} for u in staff]

