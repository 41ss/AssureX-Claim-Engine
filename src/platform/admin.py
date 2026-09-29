"""Reviewer and administrator features: manual-review queue and actions, alerts, settings,
exports and admin statistics (SRS ix, xxxvi, xxxvii, xli, xlv, l)."""
import io
from datetime import date, datetime

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.core.db import get_db
from src.core.models import Alert, Product, ReviewAction, User
from src.platform.claims import get_claim, list_claim_views, view
from src.platform.common import admin_user, audit, notify, staff_user
from src.platform.serialize import product_json
from src.platform.settings import alert_days, read_settings, write_settings
from src.platform.stats import admin_stats

router = APIRouter(prefix="/admin")
REVIEW_STATUSES = ("Manual Review", "Additional Information Required")
# Reviewer action -> resulting claim status (SRS xxxvi)
ACTION_STATUS = {"approve": "Approved", "reject": "Rejected", "request_info": "Additional Information Required", "close": "Closed"}


class ActionIn(BaseModel):
    action: str
    comment: str = ""


@router.get("/review-queue")
def review_queue(search: str = "", consistency: str = "all", warranty: str = "all",
                 user: User = Depends(staff_user), db: Session = Depends(get_db)):
    rows = list_claim_views(db, user, {"search": search, "consistency": consistency}, statuses=REVIEW_STATUSES)
    if warranty != "all":
        rows = [c for c in rows if (c["warranty"]["status"] == "expired") == (warranty == "expired")]
    return rows


@router.post("/review/{code}/action")
def reviewer_action(code: str, body: ActionIn, user: User = Depends(staff_user), db: Session = Depends(get_db)):
    """Approve, reject, request information, add a comment or close (SRS xxxvi, xxxvii).

    Approving a 'Likely Invalid' claim or rejecting a 'Likely Valid' one is an override: it
    needs a comment, and the original model results stay in the claim's audit history.
    """
    claim = get_claim(db, code, user)
    if body.action not in ACTION_STATUS and body.action != "comment":
        raise HTTPException(400, "Unknown reviewer action.")
    if claim.status == "Draft":
        raise HTTPException(400, "A draft claim has not been submitted yet.")
    is_override = (body.action == "approve" and claim.final_decision == "Likely Invalid") or \
                  (body.action == "reject" and claim.final_decision == "Likely Valid")
    if is_override and not body.comment.strip():
        raise HTTPException(400, "Give a reason in the comment when overriding the automated recommendation.")
    if body.action == "comment" and not body.comment.strip():
        raise HTTPException(400, "Write a comment first.")

    before = claim.status
    if body.action in ACTION_STATUS:
        claim.status = ACTION_STATUS[body.action]
    claim.reviewer_id = user.id
    db.add(ReviewAction(claim_id=claim.id, reviewer_id=user.id, action="override" if is_override else body.action,
                        comment=body.comment.strip()))
    audit(db, user, "reviewer_override" if is_override else f"reviewer_{body.action}", claim.claim_code,
          summary=f"{before} -> {claim.status}. Automated recommendation was {claim.final_decision}."
                  + (f" Reason: {body.comment.strip()}" if body.comment.strip() else ""))
    messages = {"approve": "was approved by a reviewer", "reject": "was rejected by a reviewer",
                "request_info": "needs more information - please upload the requested documents", "close": "was closed"}
    if body.action in messages:
        notify(db, claim.user_id, f"Claim {claim.status.lower()}", f"{claim.claim_code} {messages[body.action]}."
               + (f" Reviewer note: {body.comment.strip()}" if body.comment.strip() else ""), claim.claim_code)
    db.commit()
    return view(db, claim, user)


@router.get("/alerts")
def alerts(user: User = Depends(staff_user), db: Session = Depends(get_db)):
    rows = db.query(Alert).filter_by(resolved=False).order_by(Alert.id.desc()).limit(50).all()
    return [{"id": a.id, "kind": a.kind, "detail": a.detail, "createdAt": a.created_at.isoformat() + "Z"} for a in rows]


@router.get("/settings")
def get_settings(user: User = Depends(admin_user)):
    return read_settings()


@router.put("/settings")
def put_settings(body: dict, user: User = Depends(admin_user), db: Session = Depends(get_db)):
    try:
        saved = write_settings(body)
    except (KeyError, ValueError, TypeError) as exc:
        raise HTTPException(400, str(exc) if isinstance(exc, ValueError) else "Some settings are missing.")
    audit(db, user, "settings_changed", "config/thresholds.yaml", summary=str(saved))
    db.commit()
    return saved


@router.get("/stats")
def stats(user: User = Depends(staff_user), db: Session = Depends(get_db)):
    return admin_stats(db)


def export_rows(kind: str, db: Session, user: User) -> list[dict]:
    """Flat rows for one export type."""
    today, days = date.today(), alert_days()
    if kind in ("claims", "review-queue"):
        claims = list_claim_views(db, user, {}, statuses=REVIEW_STATUSES if kind == "review-queue" else None)
        return [{
            "Claim ID": c["id"], "Product ID": c["product"]["id"], "Product": c["product"]["name"],
            "Category": c["product"]["category"], "Serial": c["product"]["serialNumber"], "Fault": c["faultType"],
            "Status": c["stage"], "Final decision": c["decision"]["result"], "Risk": c["riskLevel"],
            "Python prediction": (c["analysis"] or {}).get("modelOne", {}).get("prediction", ""),
            "Teachable prediction": (c["analysis"] or {}).get("modelTwo", {}).get("prediction", ""),
            "Consistency": (c["analysis"] or {}).get("consistency", ""),
            "Confidence difference": (c["analysis"] or {}).get("confidenceDifference", ""),
            "Warranty": c["warranty"]["status"], "Reviewer": c["reviewer"] or "", "Submitted": c["submittedAt"] or "",
        } for c in claims]
    if kind in ("products", "warranties"):
        rows = []
        for p in db.query(Product).order_by(Product.id).all():
            d = product_json(p, today, days)
            if kind == "products":
                rows.append({"Product ID": d["id"], "Name": d["name"], "Category": d["category"], "Brand": d["brand"],
                             "Model": d["model"], "Serial": d["serialNumber"], "Purchase date": d["purchaseDate"],
                             "Price": d["purchasePrice"], "Retailer": d["retailer"], "Repairs": len(d["repairs"])})
            else:
                w = d["warranty"]
                rows.append({"Product ID": d["id"], "Provider": w["provider"], "Start": w["start"], "Expiry": w["expiry"],
                             "Status": w["status"], "Days left": w["daysLeft"],
                             "Extended until": (w["extended"] or {}).get("expiry", "")})
        return rows
    if kind == "analytics":
        s = admin_stats(db)
        return [{"Metric": k, "Value": v["value"] if isinstance(v, dict) else v} for k, v in s.items()]
    raise HTTPException(400, "Unknown export type.")


@router.get("/export")
def export(type: str = "claims", format: str = "csv", user: User = Depends(staff_user), db: Session = Depends(get_db)):
    """Selected records as CSV or Excel (SRS xlv)."""
    frame = pd.DataFrame(export_rows(type, db, user))
    stamp = datetime.now().strftime("%Y%m%d")
    audit(db, user, "data_exported", type, summary=f"{len(frame)} rows as {format}")
    db.commit()
    if format == "xlsx":
        buffer = io.BytesIO()
        frame.to_excel(buffer, index=False, sheet_name=type[:31])
        return Response(buffer.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        headers={"Content-Disposition": f'attachment; filename="assurex-{type}-{stamp}.xlsx"'})
    return Response(frame.to_csv(index=False), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="assurex-{type}-{stamp}.csv"'})
