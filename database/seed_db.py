from datetime import date, datetime, timedelta
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.core.db import SessionLocal, init_db
from src.core.models import (
    Claim, ModelVersion, Notification, Prediction, Product,
    RepairRecord, RuleResult, User, Warranty
)
from src.core.security import hash_password


def seed():
    init_db()
    db = SessionLocal()

    # Clear existing data
    db.query(RuleResult).delete()
    db.query(Prediction).delete()
    db.query(Claim).delete()
    db.query(RepairRecord).delete()
    db.query(Warranty).delete()
    db.query(Product).delete()
    db.query(ModelVersion).delete()
    db.query(Notification).delete()
    db.query(User).delete()
    db.commit()

    print("Seeding Users...")
    users = [
        User(
            email="admin@assurex.com",
            password_hash=hash_password("Admin123!"),
            full_name="System Administrator",
            role="admin",
        ),
        User(
            email="evaluator@assurex.com",
            password_hash=hash_password("Eval123!"),
            full_name="Competition Evaluator",
            role="reviewer",
        ),
        User(
            email="reviewer@assurex.com",
            password_hash=hash_password("Review123!"),
            full_name="Senior Claim Reviewer",
            role="reviewer",
        ),
        User(
            email="customer@example.com",
            password_hash=hash_password("Customer123!"),
            full_name="John Doe",
            phone="+254700000000",
            role="customer",
        ),
    ]
    db.add_all(users)
    db.commit()

    customer = db.query(User).filter_by(email="customer@example.com").first()

    print("Seeding Model Versions (SRS xlviii)...")
    models = [
        ModelVersion(
            model_name="python",
            version="v1",
            file_path="model/python_v1.joblib",
            metrics={"test_accuracy": 0.9511, "algorithm": "RandomForest"},
        ),
        ModelVersion(
            model_name="teachable",
            version="v1",
            file_path="model/teachable_v1",
            metrics={"type": "image_classification"},
        ),
    ]
    db.add_all(models)
    db.commit()

    py_model = db.query(ModelVersion).filter_by(model_name="python").first()
    tm_model = db.query(ModelVersion).filter_by(model_name="teachable").first()

    print("Seeding Products & Warranties...")
    today = date.today()

    p1 = Product(
        product_code="PRD-1001",
        owner_id=customer.id,
        name="Bravia 55' 4K OLED TV",
        category="consumer_electronics",
        brand="Sony",
        model_number="XR-55A80L",
        serial_number="SN-SNY-88419",
        purchase_date=today - timedelta(days=120),
        retailer="Sony Brand Store",
        purchase_price=1299.99,
        warranty_months=12,
    )
    p2 = Product(
        product_code="PRD-1002",
        owner_id=customer.id,
        name="Galaxy S24 Ultra",
        category="mobile_devices",
        brand="Samsung",
        model_number="SM-S928B",
        serial_number="SN-SAM-99120",
        purchase_date=today - timedelta(days=400),
        retailer="Samsung Experience Store",
        purchase_price=1199.99,
        warranty_months=12,
    )
    db.add_all([p1, p2])
    db.commit()

    w1 = Warranty(
        product_id=p1.id,
        kind="standard",
        provider="Sony Electronics Warranty Corp",
        start_date=p1.purchase_date,
        end_date=p1.purchase_date + timedelta(days=365),
        coverage_conditions="Covers display, power, and manufacturing defects.",
        exclusions="Physical drop, liquid damage, burn-in.",
        service_center="Sony Authorized Care Nairobi",
    )
    w2 = Warranty(
        product_id=p2.id,
        kind="standard",
        provider="Samsung Care",
        start_date=p2.purchase_date,
        end_date=p2.purchase_date + timedelta(days=365),
        coverage_conditions="Standard manufacturer hardware coverage.",
        exclusions="Liquid damage, screen cracks.",
        service_center="Samsung Care Centre",
    )
    db.add_all([w1, w2])
    db.commit()

    print("Seeding Claims & Evaluation Results...")
    # Claim 1: Likely Valid
    c1 = Claim(
        claim_code="CLM-2026-0001",
        user_id=customer.id,
        product_id=p1.id,
        invoice_number="INV-2024-8891",
        serial_number=p1.serial_number,
        fault_date=today - timedelta(days=15),
        fault_category="display",
        fault_description="Flickering vertical lines appeared on panel.",
        damage_type="none",
        status="Approved",
        final_decision="Likely Valid",
        decision_reasons=["Both models agree on Valid Claim (Strong Match).", "Warranty active with 245 days remaining."],
        summary="Claim verified. Display fault covered under active warranty. Full documentation verified.",
    )
    # Claim 2: Likely Invalid (Expired & Liquid Damage)
    c2 = Claim(
        claim_code="CLM-2026-0002",
        user_id=customer.id,
        product_id=p2.id,
        invoice_number="INV-2023-1102",
        serial_number=p2.serial_number,
        fault_date=today - timedelta(days=10),
        fault_category="motherboard",
        fault_description="Device completely unresponsive after water contact.",
        damage_type="water",
        status="Rejected",
        final_decision="Likely Invalid",
        decision_reasons=["Liquid/water damage detected; excluded under warranty policy.", "Warranty expired 35 days ago."],
        summary="Claim rejected due to policy exclusions and warranty expiration.",
    )
    db.add_all([c1, c2])
    db.commit()

    # Link Predictions
    pred1_py = Prediction(
        claim_id=c1.id,
        model_version_id=py_model.id,
        label="Valid Claim",
        probabilities={"Valid Claim": 0.94, "Invalid Claim": 0.03, "Manual Review": 0.03},
    )
    pred1_tm = Prediction(
        claim_id=c1.id,
        model_version_id=tm_model.id,
        label="Valid Claim",
        probabilities={"Valid Claim": 0.91, "Invalid Claim": 0.04, "Manual Review": 0.05},
    )
    db.add_all([pred1_py, pred1_tm])
    db.commit()

    print("Database seeding completed successfully: assurex.db ready.")
    db.close()


if __name__ == "__main__":
    seed()
