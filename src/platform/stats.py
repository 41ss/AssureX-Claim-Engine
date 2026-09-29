"""Numbers for the dashboards and reports, all counted from the database or read from
the model evaluation files - nothing typed in by hand (SRS xl, xli, xliii)."""
import json
from collections import Counter
from datetime import date, datetime, timedelta

import numpy as np
from sqlalchemy.orm import Session

from src.core.config import MODEL_DIR, REPORTS_DIR, TEACHABLE_MODEL_VERSION
from src.core.models import Alert, Claim, Document, Notification, Product, RepairRecord, RuleResult, User
from src.platform.checks import warranty_info
from src.platform.common import is_staff

CONSISTENCY_KEYS = {"Strong Match": "strongMatch", "Acceptable Match": "acceptableMatch", "Weak Match": "weakMatch",
                    "Model Disagreement": "modelDisagreement", "Uncertain Result": "uncertainResult"}
PENDING = ("Draft", "Additional Information Required")


def trend_value(claims: list[Claim], keep) -> dict:
    """Count in the last 7 days vs the 7 days before, as the stat cards show it."""
    now = datetime.utcnow()
    recent = sum(1 for c in claims if keep(c) and c.created_at >= now - timedelta(days=7))
    before = sum(1 for c in claims if keep(c) and now - timedelta(days=14) <= c.created_at < now - timedelta(days=7))
    total = sum(1 for c in claims if keep(c))
    delta = round((recent - before) / before * 100) if before else (100 if recent else 0)
    return {"value": total, "deltaPct": delta, "direction": "up" if delta >= 0 else "down"}


def visible_claims(db: Session, user: User) -> list[Claim]:
    query = db.query(Claim)
    return query.all() if is_staff(user) else query.filter(Claim.user_id == user.id).all()


def user_stats(db: Session, user: User, alert_days: int) -> dict:
    """User dashboard (SRS xl): claims, products, warranties, receipts, pending actions."""
    claims = visible_claims(db, user)
    products = db.query(Product).all() if is_staff(user) else db.query(Product).filter_by(owner_id=user.id).all()
    today = date.today()
    statuses = [warranty_info(p, today, alert_days)["status"] for p in products]
    receipts = db.query(Document).filter(Document.doc_type.in_(("receipt", "invoice")))
    if not is_staff(user):
        receipts = receipts.filter(Document.owner_id == user.id)
    evaluated = [c for c in claims if c.evaluated_at]
    return {
        "totalClaims": trend_value(claims, lambda c: c.status != "Draft"),
        "approved": trend_value(claims, lambda c: c.status == "Approved"),
        "rejected": trend_value(claims, lambda c: c.status == "Rejected"),
        "underReview": trend_value(claims, lambda c: c.status in ("Manual Review", "Under Evaluation", "Submitted")),
        "averageConfidence": round(float(np.mean([c.top_confidence for c in evaluated])), 3) if evaluated else 0,
        "products": len(products),
        "activeWarranties": sum(1 for s in statuses if s in ("active", "extended", "expiring")),
        "expiringWarranties": statuses.count("expiring"),
        "savedReceipts": receipts.count(),
        "pendingActions": sum(1 for c in claims if c.status in PENDING),
        "flags": claim_flags(db, evaluated),
    }


def claim_flags(db: Session, claims: list[Claim]) -> dict:
    """How many evaluated claims the checks flagged, by kind (shown on the dashboard)."""
    failed = {(r.claim_id, r.rule) for r in db.query(RuleResult).filter(
        RuleResult.claim_id.in_([c.id for c in claims]), RuleResult.passed.is_(False)).all()} if claims else set()
    def has(claim, rules):
        return any((claim.id, rule) in failed for rule in rules)
    return {
        "duplicates": sum(1 for c in claims if (c.decision_detail or {}).get("duplicate")),
        "ruleViolations": sum(1 for c in claims if any(cid == c.id for cid, _ in failed)),
        "contradictions": sum(1 for c in claims if (c.decision_detail or {}).get("contradictions")),
        "exclusions": sum(1 for c in claims if has(c, ("excluded_damage_physical", "excluded_damage_liquid", "excluded_fault_type"))),
    }


def admin_stats(db: Session) -> dict:
    """Administrator dashboard (SRS xli)."""
    claims = db.query(Claim).all()
    evaluated = [c for c in claims if c.evaluated_at]
    decided = [c for c in claims if c.status in ("Approved", "Rejected")]
    durations = [(c.evaluated_at - c.submitted_at).total_seconds() / 86400 for c in evaluated if c.submitted_at]
    return {
        "totalClaims": trend_value(claims, lambda c: c.status != "Draft"),
        "validClaims": sum(1 for c in claims if c.final_decision == "Likely Valid"),
        "invalidClaims": sum(1 for c in claims if c.final_decision == "Likely Invalid"),
        "manualReviewClaims": sum(1 for c in claims if c.final_decision == "Manual Review Required"),
        "pendingReview": trend_value(claims, lambda c: c.status == "Manual Review"),
        "modelDisagreements": trend_value(claims, lambda c: c.consistency == "Model Disagreement"),
        "duplicateAlerts": trend_value(claims, lambda c: bool((c.decision_detail or {}).get("duplicate"))),
        "averageConfidence": round(float(np.mean([c.top_confidence for c in evaluated])), 3) if evaluated else 0,
        "approvalRate": round(sum(1 for c in decided if c.status == "Approved") / len(decided), 3) if decided else 0,
        "avgProcessingDays": round(float(np.mean(durations)), 2) if durations else 0,
        "openAlerts": db.query(Alert).filter_by(resolved=False).count(),
    }


def claims_trend(db: Session, user: User, range_key: str) -> dict:
    """Approved / rejected / in review per day (7d), per week (30d) or per month (90d)."""
    claims = [c for c in visible_claims(db, user) if c.status != "Draft"]
    today = date.today()
    if range_key == "30d":
        buckets = [(today - timedelta(days=7 * (4 - i)), today - timedelta(days=7 * (3 - i))) for i in range(4)]
        labels = [f"W{i + 1}" for i in range(4)]
    elif range_key == "90d":
        buckets = [(today - timedelta(days=30 * (3 - i)), today - timedelta(days=30 * (2 - i))) for i in range(3)]
        labels = [b[1].strftime("%b") for b in buckets]
    else:
        buckets = [(today - timedelta(days=6 - i), today - timedelta(days=5 - i)) for i in range(7)]
        labels = [b[0].strftime("%d %b") for b in buckets]
    def count(status_set):
        return [sum(1 for c in claims if c.status in status_set and start <= c.created_at.date() < end) for start, end in buckets]
    return {"labels": labels, "approved": count({"Approved"}), "rejected": count({"Rejected"}),
            "review": count({"Manual Review", "Additional Information Required", "Under Evaluation", "Submitted"})}


def claims_by_category(db: Session, user: User) -> dict:
    counts = Counter(c.product.category for c in visible_claims(db, user) if c.status != "Draft")
    labels = sorted(counts)
    return {"labels": [label.replace("_", " ").title() for label in labels], "values": [counts[label] for label in labels]}


def expiry_notifications(db: Session, user: User, alert_days: int) -> None:
    """Creates one warranty-expiry notification per product entering the alert window (SRS ix)."""
    today = date.today()
    for p in db.query(Product).filter_by(owner_id=user.id).all():
        w = warranty_info(p, today, alert_days)
        if 0 <= w["daysLeft"] <= alert_days:
            title = f"Warranty ending: {p.product_code}"
            if not db.query(Notification).filter_by(user_id=user.id, title=title).first():
                db.add(Notification(user_id=user.id, title=title,
                                    message=f"The warranty for {p.name} ends in {w['daysLeft']} days ({w['expiry']})."))
    db.commit()


def notifications(db: Session, user: User, alert_days: int) -> list[dict]:
    expiry_notifications(db, user, alert_days)
    rows = db.query(Notification).filter_by(user_id=user.id).order_by(Notification.id.desc()).limit(20).all()
    return [{"id": n.id, "title": n.title, "body": n.message, "time": n.created_at.isoformat() + "Z", "unread": not n.read,
             "claimId": n.claim_code or None, "href": "/products" if n.title.startswith("Warranty") else None} for n in rows]


def _macro(cm: list[list[int]]) -> dict:
    """Accuracy and macro precision / recall / F1 from a confusion matrix (rows = actual)."""
    m = np.array(cm, dtype=float)
    precision = np.diag(m) / np.maximum(m.sum(axis=0), 1)
    recall = np.diag(m) / np.maximum(m.sum(axis=1), 1)
    f1 = 2 * precision * recall / np.maximum(precision + recall, 1e-9)
    return {"accuracy": round(float(np.trace(m) / m.sum()), 4), "precision": round(float(precision.mean()), 4),
            "recall": round(float(recall.mean()), 4), "f1": round(float(f1.mean()), 4)}


def model_performance(db: Session) -> dict:
    """Test-set metrics for both models, plus how often they agreed on real claims."""
    py = json.loads((MODEL_DIR / "metrics.json").read_text())
    tm_file = MODEL_DIR / f"teachable_{TEACHABLE_MODEL_VERSION}" / "metrics.json"
    tm = json.loads(tm_file.read_text()) if tm_file.exists() else None
    evaluated = [c.consistency for c in db.query(Claim).filter(Claim.consistency != "").all()]
    breakdown = {key: round(evaluated.count(status) / len(evaluated) * 100) if evaluated else 0 for status, key in CONSISTENCY_KEYS.items()}
    return {
        "pythonModel": {"version": py["version"], **_macro(py["test"]["confusion_matrix"])},
        "teachableMachine": {"version": TEACHABLE_MODEL_VERSION, **(_macro(tm["test"]["confusion_matrix"]) if tm else
                                                  {"accuracy": 0, "precision": 0, "recall": 0, "f1": 0})},
        "consistencyBreakdown": breakdown,
    }


def analytics(db: Session, user: User, alert_days: int) -> dict:
    """Claim analytics (SRS xliii)."""
    claims = [c for c in visible_claims(db, user) if c.status != "Draft"]
    faults = Counter(c.fault_category.replace("_", " ") for c in claims)
    rejected_ids = [c.id for c in claims if c.final_decision == "Likely Invalid"]
    reasons = Counter(r.rule.replace("_", " ") for r in db.query(RuleResult).filter(
        RuleResult.claim_id.in_(rejected_ids), RuleResult.passed.is_(False), RuleResult.severity == "blocking").all()) if rejected_ids else Counter()
    repairs = db.query(RepairRecord).all()
    products = db.query(Product).all() if is_staff(user) else db.query(Product).filter_by(owner_id=user.id).all()
    today = date.today()
    days_left = [warranty_info(p, today, alert_days)["daysLeft"] for p in products]
    return {
        "topFaults": [{"label": k, "count": v} for k, v in faults.most_common(5)],
        "rejectionReasons": [{"label": k, "count": v} for k, v in reasons.most_common(5)],
        "repairPatterns": [
            {"label": "Repairs at authorised centres", "count": sum(1 for r in repairs if r.authorized_center)},
            {"label": "Repairs at unauthorised centres", "count": sum(1 for r in repairs if not r.authorized_center)},
            {"label": "Products replaced", "count": sum(1 for r in repairs if r.product_replaced)},
        ],
        "warrantyExpirations": [
            {"label": "Already expired", "count": sum(1 for d in days_left if d < 0)},
            {"label": "Expiring in 30 days", "count": sum(1 for d in days_left if 0 <= d <= 30)},
            {"label": "Expiring in 31-90 days", "count": sum(1 for d in days_left if 30 < d <= 90)},
        ],
        "manualReviewRate": round(sum(1 for c in claims if c.final_decision == "Manual Review Required") / len(claims), 3) if claims else 0,
    }


REPORT_FILES = [
    ("model_comparison.md", "Model prediction and confidence comparison", "Both models on unseen test claims (SRS 1.10.6)"),
    ("teachable_evaluation.md", "Teachable Machine evaluation", "Validation and test accuracy, confusion matrix, misclassified cards"),
    ("python_model_evaluation.md", "Python model evaluation", "Algorithms compared, cross-validation, per-class metrics"),
]


def report_list() -> list[dict]:
    rows = []
    for name, title, description in REPORT_FILES:
        path = REPORTS_DIR / name
        if path.exists():
            rows.append({"id": name, "title": title, "description": description, "filename": name,
                         "generatedAt": datetime.fromtimestamp(path.stat().st_mtime).isoformat(), "url": f"/api/reports/files/{name}"})
    return rows
