"""API tests: security, validation, documents, duplicates, contradictions, evaluation,
reviewer actions and settings (SRS 1.10.8)."""
from datetime import date, timedelta

from src.core.config import PYTHON_MODEL_VERSION, TEACHABLE_MODEL_VERSION
from tests.conftest import new_client, png_bytes


def draft(client, **overrides) -> str:
    body = {"productId": client.product["id"], "faultCategory": "battery", "damageType": "none",
            "faultDate": (date.today() - timedelta(days=3)).isoformat(), "description": "Battery drains in two hours.",
            "serialNumber": client.product["serialNumber"]}
    body.update(overrides)
    response = client.post("/api/claims", json=body)
    assert response.status_code == 200, response.text
    return response.json()["id"]


def upload(client, code, doc_type, content=None, name=None):
    content = content if content is not None else png_bytes(f"{code}-{doc_type}")
    return client.post(f"/api/claims/{code}/documents", data={"doc_type": doc_type},
                       files={"file": (name or f"{doc_type}.png", content, "image/png")})


def upload_mandatory(client, code):
    for doc_type in ("receipt", "serial_photo", "product_image", "fault_evidence"):
        assert upload(client, code, doc_type).status_code == 200


# ---------- Security ----------

def test_api_requires_login():
    assert new_client().get("/api/claims").status_code == 401


def test_wrong_password_is_rejected(customer):
    email = customer.get("/api/auth/me").json()["email"]
    assert new_client().post("/api/auth/login", json={"email": email, "password": "wrong"}).status_code == 401


def test_cannot_self_register_as_admin():
    response = new_client().post("/api/auth/register", json={"name": "X", "email": "x@evil.com", "password": "Password1", "role": "admin"})
    assert response.status_code == 400


def test_customer_cannot_open_review_queue_or_settings(customer):
    assert customer.get("/api/admin/review-queue").status_code == 403
    assert customer.get("/api/admin/settings").status_code == 403


def test_customer_cannot_see_another_customers_claim(customer):
    code = draft(customer)
    other = new_client()
    other.post("/api/auth/register", json={"name": "Other", "email": "other-user@test.com", "password": "Password1", "role": "customer"})
    assert other.get(f"/api/claims/{code}").status_code == 404


def test_passwords_are_salted_hashes():
    from src.core.security import hash_password, verify_password
    a, b = hash_password("Same1234"), hash_password("Same1234")
    assert a != b and verify_password("Same1234", a) and not verify_password("Other123", a)


# ---------- Validation (negative / boundary) ----------

def test_unsupported_file_type_is_rejected(customer):
    code = draft(customer)
    response = upload(customer, code, "receipt", b"MZ fake exe", name="receipt.exe")
    assert response.status_code == 400 and "accepted" in response.json()["detail"]


def test_file_over_size_limit_is_rejected(customer):
    code = draft(customer)
    response = upload(customer, code, "receipt", b"0" * (10 * 1024 * 1024 + 1), name="big.pdf")
    assert response.status_code == 400 and "10MB" in response.json()["detail"]


def test_invalid_date_is_rejected(customer):
    body = {"productId": customer.product["id"], "faultCategory": "battery", "faultDate": "31/31/2026", "description": "x"}
    assert customer.post("/api/claims", json=body).status_code == 400


def test_warranty_expiry_must_follow_start(customer):
    response = customer.post("/api/products", json={
        "name": "P", "category": "small_appliances", "brand": "B", "model": "M", "serialNumber": "S1",
        "purchaseDate": "2026-01-01", "warranty": {"provider": "W", "start": "2026-01-01", "expiry": "2025-01-01"}})
    assert response.status_code == 400


# ---------- Documents and duplicates ----------

def test_same_document_on_two_claims_is_flagged(customer):
    first, second = draft(customer), draft(customer, faultCategory="camera")
    same_file = png_bytes("identical receipt")
    assert upload(customer, first, "receipt", same_file).json()["duplicateOf"] is None
    assert upload(customer, second, "receipt", same_file).json()["duplicateOf"] == first


def test_repeat_claim_for_same_product_and_fault_is_a_possible_duplicate(customer):
    first = draft(customer)
    customer.post(f"/api/claims/{first}/submit")
    second = draft(customer)
    result = customer.post(f"/api/claims/{second}/submit").json()
    assert result["decision"]["duplicateWarning"]["relatedClaimId"] == first
    assert result["decision"]["result"] == "Manual Review Required"


# ---------- Evaluation ----------

def test_submitted_claim_gets_both_models_rules_and_card(customer):
    code = draft(customer)
    upload_mandatory(customer, code)
    claim = customer.post(f"/api/claims/{code}/submit").json()
    a = claim["analysis"]
    assert a["modelOne"]["name"].startswith("Python") and a["modelTwo"]["name"].startswith("Google")
    for model in (a["modelOne"], a["modelTwo"]):
        assert abs(sum(model["confidence"].values()) - 1) < 0.02
    assert a["confidenceDifference"] == round(abs(max(a["modelOne"]["confidence"].values()) - max(a["modelTwo"]["confidence"].values())), 4)
    assert claim["decision"]["result"] in ("Likely Valid", "Likely Invalid", "Manual Review Required")
    assert claim["decision"]["rules"] and customer.get(f"/api/claims/{code}/card").status_code == 200


def test_missing_documents_send_claim_to_manual_review(customer):
    code = draft(customer)
    claim = customer.post(f"/api/claims/{code}/submit").json()
    assert claim["decision"]["missingDocuments"]
    assert claim["decision"]["result"] in ("Manual Review Required", "Likely Invalid")


def test_fault_before_purchase_is_a_contradiction(customer):
    before_purchase = (date.fromisoformat(customer.product["purchaseDate"]) - timedelta(days=5)).isoformat()
    code = draft(customer, faultDate=before_purchase)
    claim = customer.post(f"/api/claims/{code}/submit").json()
    assert any("precedes" in c for c in claim["decision"]["contradictions"])


def test_serial_mismatch_is_detected(customer):
    code = draft(customer, serialNumber="DIFFERENT-SERIAL-9")
    claim = customer.post(f"/api/claims/{code}/submit").json()
    assert any("Serial" in c for c in claim["decision"]["contradictions"])


def test_unauthorised_repair_fails_the_claim(customer):
    customer.post(f"/api/products/{customer.product['id']}/repairs", json={
        "date": (date.today() - timedelta(days=30)).isoformat(), "serviceCenter": "Corner Shop", "authorized": False})
    code = draft(customer)
    claim = customer.post(f"/api/claims/{code}/submit").json()
    assert any(r["rule"] == "unauthorized_repair" and not r["passed"] for r in claim["decision"]["rules"])
    assert claim["decision"]["result"] == "Likely Invalid"


def test_prediction_is_linked_to_model_version(customer):
    from src.core.db import SessionLocal
    from src.core.models import Claim
    code = draft(customer)
    customer.post(f"/api/claims/{code}/submit")
    db = SessionLocal()
    claim = db.query(Claim).filter_by(claim_code=code).one()
    assert {(p.model_version.model_name, p.model_version.version) for p in claim.predictions} == {
        ("python", PYTHON_MODEL_VERSION), ("teachable", TEACHABLE_MODEL_VERSION)}
    db.close()


# ---------- Reviewer actions ----------

def test_override_needs_a_reason_and_is_audited(customer, reviewer):
    customer.post(f"/api/products/{customer.product['id']}/repairs", json={
        "date": (date.today() - timedelta(days=30)).isoformat(), "serviceCenter": "Corner Shop", "authorized": False})
    code = draft(customer)
    assert customer.post(f"/api/claims/{code}/submit").json()["decision"]["result"] == "Likely Invalid"
    staff = new_client()
    staff.post("/api/auth/login", json=reviewer)
    assert staff.post(f"/api/admin/review/{code}/action", json={"action": "approve"}).status_code == 400
    approved = staff.post(f"/api/admin/review/{code}/action", json={"action": "approve", "comment": "Repair shop was authorised after all."}).json()
    assert approved["stage"] == "Approved"
    assert approved["decision"]["result"] == "Likely Invalid"          # original recommendation is kept
    assert any(e["action"] == "reviewer override" for e in approved["auditHistory"])


def test_request_info_lets_customer_upload_and_resubmit(customer, reviewer):
    code = draft(customer)
    customer.post(f"/api/claims/{code}/submit")
    staff = new_client()
    staff.post("/api/auth/login", json=reviewer)
    assert staff.post(f"/api/admin/review/{code}/action", json={"action": "request_info", "comment": "Need a photo"}).json()["status"] == "info"
    assert upload(customer, code, "product_image").status_code == 200
    assert customer.post(f"/api/claims/{code}/submit").status_code == 200


# ---------- Reports and export ----------

def test_claim_report_is_a_pdf(customer):
    code = draft(customer)
    customer.post(f"/api/claims/{code}/submit")
    response = customer.get(f"/api/claims/{code}/report")
    assert response.status_code == 200 and response.content[:4] == b"%PDF"


def test_staff_can_export_csv_and_excel(reviewer):
    staff = new_client()
    staff.post("/api/auth/login", json=reviewer)
    assert staff.get("/api/admin/export?type=claims").text.startswith("Claim ID")
    assert staff.get("/api/admin/export?type=products&format=xlsx").content[:2] == b"PK"   # xlsx is a zip
