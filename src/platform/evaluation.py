"""Evaluates a submitted claim and stores every result (SRS xviii-xxxv, xlvi-xlviii).

Used by POST /api/claims/{id}/submit and by the database seed script, so demo claims go
through exactly the same code as claims submitted in the app.
"""
import time
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from src.core.models import Claim, ModelVersion, Prediction, RuleResult, User
from src.core.pipeline import evaluate_claim
from src.decision.engine import load_policy
from src.ml.features import build_features, missing_mandatory
from src.platform.checks import DOC_LABELS, claim_summary, document_contradictions, find_duplicates, risk_level, warranty_info
from src.platform.common import audit, notify, raise_alert

# Final decision -> claim status after the automated evaluation.
STATUS_AFTER_DECISION = {"Likely Valid": "Approved", "Likely Invalid": "Rejected", "Manual Review Required": "Manual Review"}
UNUSUAL_CLAIMS_PER_DAY = 5


class ModelsUnavailable(RuntimeError):
    """One of the two models could not produce a prediction."""


def model_version(db: Session, model_name: str, version: str) -> ModelVersion:
    """The ModelVersion row for this model, created the first time it is used (SRS xlviii)."""
    row = db.query(ModelVersion).filter_by(model_name=model_name, version=version).first()
    if row is None:
        path = f"model/python_{version}.joblib" if model_name == "python" else f"model/teachable_{version}"
        row = ModelVersion(model_name=model_name, version=version, file_path=path)
        db.add(row)
        db.flush()
    return row


def evaluate_and_store(db: Session, claim: Claim, actor: User, today: date, alert_days: int) -> Claim:
    product = claim.product
    policy = load_policy(product.category)
    features = build_features(claim, product, claim.documents, product.repairs, policy, claim_date=today)
    contradictions = document_contradictions(claim, product, product.repairs, today)
    duplicates = find_duplicates(db, claim)

    claim.status = "Under Evaluation"
    claim.submitted_at = claim.submitted_at or datetime.utcnow()
    started = time.perf_counter()
    try:
        py_pred, tm_pred, result, card_path = evaluate_claim(features, contradictions, [d["reason"] for d in duplicates])
    except Exception as exc:
        claim.status = "Submitted"
        raise_alert(db, "model_failure", f"Evaluation of {claim.claim_code} failed: {type(exc).__name__}.")
        db.commit()
        raise ModelsUnavailable("The claim models are unavailable right now. Your claim is saved and can be submitted again later.") from exc
    seconds = round(time.perf_counter() - started, 2)

    # Predictions, each linked to the model version that made it. Old rows are kept.
    for pred in (py_pred, tm_pred):
        db.add(Prediction(claim_id=claim.id, model_version_id=model_version(db, pred.model_name, pred.model_version).id,
                          label=pred.label, probabilities=pred.probabilities))
    # Rule results for this evaluation replace the previous ones.
    db.query(RuleResult).filter_by(claim_id=claim.id).delete()
    for f in result.findings:
        db.add(RuleResult(claim_id=claim.id, rule=f.rule, passed=f.passed, severity=f.severity, message=f.message))

    missing = missing_mandatory(claim.documents, policy)
    first_dup = duplicates[0] if duplicates else None
    claim.final_decision = result.decision
    claim.consistency = result.consistency
    claim.top_confidence = py_pred.confidence
    claim.confidence_gap = result.confidence_gap
    claim.risk_level = risk_level(result.decision, result.contradictions, duplicates)
    claim.card_path = card_path
    claim.decision_detail = {
        "explanation": result.explanation, "supporting": result.supporting, "opposing": result.opposing,
        "contradictions": result.contradictions, "evidenceRequired": result.evidence_required,
        "missingDocuments": [DOC_LABELS.get(d, d) for d in missing], "missingDocumentTypes": missing,
        "duplicate": {"relatedClaimId": first_dup["claim"].claim_code, "relatedDate": first_dup["claim"].submitted_at.isoformat() + "Z" if first_dup["claim"].submitted_at else None,
                      "relatedStatus": first_dup["claim"].status, "reason": "Possible duplicate: " + first_dup["reason"] + "."} if first_dup else None,
        "evaluationSeconds": seconds,
    }
    claim.summary = claim_summary(claim, product, features, result, warranty_info(product, today, alert_days))
    claim.evaluated_at = datetime.utcnow()
    claim.status = STATUS_AFTER_DECISION[result.decision]

    audit(db, actor, "model_prediction", claim.claim_code,
          summary=f"Python {py_pred.label} {py_pred.confidence:.0%}, Teachable Machine {tm_pred.label} {tm_pred.confidence:.0%}, "
                  f"{result.consistency}, {seconds}s", python=py_pred.probabilities, teachable=tm_pred.probabilities)
    audit(db, actor, "final_decision", claim.claim_code, summary=f"{result.decision} -> {claim.status}")
    notify(db, claim.user_id, f"Claim {claim.status.lower()}", f"{claim.claim_code}: {result.decision}.", claim.claim_code)
    if missing:
        notify(db, claim.user_id, "Documents missing", f"{claim.claim_code} needs: {', '.join(DOC_LABELS.get(d, d) for d in missing)}.", claim.claim_code)

    # Monitoring alerts for administrators (SRS l)
    if result.consistency == "Model Disagreement":
        raise_alert(db, "model_disagreement", f"{claim.claim_code}: Python {py_pred.label} vs Teachable Machine {tm_pred.label}.")
    if result.consistency == "Uncertain Result":
        raise_alert(db, "low_confidence", f"{claim.claim_code}: low model confidence ({py_pred.confidence:.0%} / {tm_pred.confidence:.0%}).")
    if duplicates:
        raise_alert(db, "duplicate_claim", f"{claim.claim_code}: possible duplicate of {first_dup['claim'].claim_code}.")
    recent = db.query(Claim).filter(Claim.user_id == claim.user_id, Claim.submitted_at >= datetime.utcnow() - timedelta(days=1)).count()
    if recent >= UNUSUAL_CLAIMS_PER_DAY:
        raise_alert(db, "unusual_activity", f"{claim.user.email} submitted {recent} claims in the last 24 hours.")
    db.commit()
    return claim
