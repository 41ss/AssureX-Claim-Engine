from src.core.db import SessionLocal
from src.core.models import Claim, Product, User
from src.core.security import verify_password


def test_seed_database_entities():
    db = SessionLocal()
    # Check users
    admin = db.query(User).filter_by(email="admin@assurex.com").first()
    assert admin is not None
    assert admin.role == "admin"
    assert verify_password("Admin123!", admin.password_hash)

    # Check products
    products = db.query(Product).all()
    assert len(products) >= 2

    # Check claims with relationships
    claims = db.query(Claim).all()
    assert len(claims) >= 2
    claim1 = db.query(Claim).filter_by(claim_code="CLM-2026-0001").first()
    assert claim1.final_decision == "Likely Valid"
    assert len(claim1.predictions) == 2

    db.close()
