"""Database tests: tables, relationships and stored passwords (SRS xlvi)."""
from datetime import date, timedelta

from src.core.db import SessionLocal
from src.core.models import Claim, Product, User, Warranty
from src.core.security import hash_password, verify_password


def test_user_product_warranty_claim_are_linked():
    db = SessionLocal()
    user = User(email="db-test@test.com", password_hash=hash_password("Password1"), full_name="Db Test", role="customer")
    db.add(user)
    db.flush()
    product = Product(product_code="PRD-DB-1", owner_id=user.id, name="Kettle", category="small_appliances", brand="B",
                      model_number="K1", serial_number="S-1", purchase_date=date.today() - timedelta(days=10), warranty_months=24)
    db.add(product)
    db.flush()
    db.add(Warranty(product_id=product.id, start_date=product.purchase_date, end_date=product.purchase_date + timedelta(days=730)))
    claim = Claim(claim_code="CLM-DB-1", user_id=user.id, product_id=product.id, fault_category="electrical")
    db.add(claim)
    db.commit()

    stored = db.query(Claim).filter_by(claim_code="CLM-DB-1").one()
    assert stored.product.name == "Kettle" and stored.user.email == "db-test@test.com"
    assert stored.status == "Draft" and len(stored.product.warranties) == 1
    assert stored.user.password_hash != "Password1" and verify_password("Password1", stored.user.password_hash)
    db.close()


def test_claim_codes_are_unique():
    import pytest
    from sqlalchemy.exc import IntegrityError
    db = SessionLocal()
    user = db.query(User).first()
    product = db.query(Product).first()
    db.add(Claim(claim_code="CLM-DUP-1", user_id=user.id, product_id=product.id))
    db.add(Claim(claim_code="CLM-DUP-1", user_id=user.id, product_id=product.id))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
    db.close()
