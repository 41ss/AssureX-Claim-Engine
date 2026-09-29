"""Warranty policies, product registration, warranty records and repair history (SRS iii, iv, viii, xiii, xxvi)."""
from datetime import date

import yaml
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.core.config import POLICIES_DIR
from src.core.db import get_db
from src.core.models import Claim, Product, RepairRecord, User, Warranty
from src.platform.common import audit, current_user, is_staff
from src.platform.serialize import product_json, repair_json
from src.platform.settings import alert_days
from src.teachable.dates import parse_date

router = APIRouter()


class WarrantyIn(BaseModel):
    provider: str
    start: str
    expiry: str
    serviceCenter: str = ""
    coverage: str = ""
    exclusions: str = ""


class ExtendedIn(BaseModel):
    provider: str
    expiry: str


class ProductIn(BaseModel):
    name: str
    category: str
    brand: str
    model: str
    serialNumber: str
    purchaseDate: str
    purchasePrice: float = 0
    retailer: str = ""
    warranty: WarrantyIn
    extendedWarranty: ExtendedIn | None = None


class RepairIn(BaseModel):
    date: str
    serviceCenter: str
    partsReplaced: str = ""
    outcome: str = ""
    cost: float = 0
    authorized: bool = True
    productReplaced: bool = False


def load_policies() -> list[dict]:
    """Every policies/*.yaml file, in the shape the claim form uses."""
    policies = []
    for path in sorted(POLICIES_DIR.glob("*.yaml")):
        p = yaml.safe_load(path.read_text(encoding="utf-8"))
        policies.append({
            "category": p["product_category"], "coverageMonths": p["coverage_duration_months"],
            "gracePeriodDays": p.get("grace_period_days", 0), "reportingPeriodDays": p.get("claim_reporting_period_days"),
            "coveredFaults": p.get("covered_faults", []), "exclusions": p.get("exclusions", []),
            "mandatoryDocuments": p.get("mandatory_documents", []), "optionalDocuments": p.get("optional_documents", []),
        })
    return policies


def to_date(text: str, label: str) -> date:
    """Accepts every format in src/teachable/dates.py; a clear message otherwise (SRS xv)."""
    try:
        return parse_date(text)
    except ValueError:
        raise HTTPException(400, f"{label} is not a valid date.")


def get_product(db: Session, code: str, user: User) -> Product:
    product = db.query(Product).filter_by(product_code=code).first()
    if product is None or (product.owner_id != user.id and not is_staff(user)):
        raise HTTPException(404, "Product not found.")
    return product


def next_product_code(db: Session) -> str:
    return f"PRD-{1001 + db.query(Product).count()}"


@router.get("/policies")
def policies(user: User = Depends(current_user)):
    return load_policies()


@router.get("/products")
def list_products(search: str = "", warrantyStatus: str = "all", user: User = Depends(current_user), db: Session = Depends(get_db)):
    query = db.query(Product)
    if not is_staff(user):
        query = query.filter(Product.owner_id == user.id)
    today, days = date.today(), alert_days()
    rows = []
    for p in query.order_by(Product.id.desc()).all():
        text = f"{p.product_code} {p.name} {p.serial_number} {p.brand} {p.model_number}".lower()
        if search and search.lower() not in text:
            continue
        data = product_json(p, today, days, db.query(Claim).filter_by(product_id=p.id).count())
        if warrantyStatus != "all" and data["warranty"]["status"] != warrantyStatus:
            continue
        rows.append(data)
    return rows


@router.get("/products/{code}")
def one_product(code: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    product = get_product(db, code, user)
    return product_json(product, date.today(), alert_days(), db.query(Claim).filter_by(product_id=product.id).count())


@router.post("/products")
def register_product(body: ProductIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if body.category not in {p["category"] for p in load_policies()}:
        raise HTTPException(400, "Choose one of the listed product categories.")
    for label, value in (("Product name", body.name), ("Brand", body.brand), ("Model number", body.model),
                         ("Serial number", body.serialNumber), ("Warranty provider", body.warranty.provider)):
        if not value.strip():
            raise HTTPException(400, f"{label} is required.")
    if body.purchasePrice < 0:
        raise HTTPException(400, "Purchase price cannot be negative.")
    purchase = to_date(body.purchaseDate, "Purchase date")
    start, end = to_date(body.warranty.start, "Warranty start date"), to_date(body.warranty.expiry, "Warranty expiry")
    if purchase > date.today():
        raise HTTPException(400, "The purchase date cannot be in the future.")
    if end <= start:
        raise HTTPException(400, "The warranty expiry must be after its start date.")

    product = Product(product_code=next_product_code(db), owner_id=user.id, name=body.name.strip(), category=body.category,
                      brand=body.brand.strip(), model_number=body.model.strip(), serial_number=body.serialNumber.strip(),
                      purchase_date=purchase, retailer=body.retailer.strip(), purchase_price=body.purchasePrice,
                      warranty_months=round((end - start).days / 30))
    db.add(product)
    db.flush()
    db.add(Warranty(product_id=product.id, kind="standard", provider=body.warranty.provider.strip(), start_date=start, end_date=end,
                    coverage_conditions=body.warranty.coverage, exclusions=body.warranty.exclusions,
                    service_center=body.warranty.serviceCenter))
    if body.extendedWarranty:
        ext_end = to_date(body.extendedWarranty.expiry, "Extended warranty expiry")
        if ext_end <= end:
            raise HTTPException(400, "The extended warranty must end after the standard warranty.")
        db.add(Warranty(product_id=product.id, kind="extended", provider=body.extendedWarranty.provider.strip(),
                        start_date=end, end_date=ext_end))
    audit(db, user, "product_registered", product.product_code, summary=f"{product.name} ({product.serial_number})")
    db.commit()
    db.refresh(product)
    return product_json(product, date.today(), alert_days())


@router.post("/products/{code}/repairs")
def add_repair(code: str, body: RepairIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    product = get_product(db, code, user)
    if not body.serviceCenter.strip():
        raise HTTPException(400, "Enter the service centre.")
    repair = RepairRecord(product_id=product.id, repair_date=to_date(body.date, "Repair date"), service_center=body.serviceCenter.strip(),
                          authorized_center=body.authorized, parts_replaced=body.partsReplaced, outcome=body.outcome,
                          cost=max(body.cost, 0), product_replaced=body.productReplaced)
    db.add(repair)
    audit(db, user, "repair_recorded", product.product_code,
          summary=f"{repair.repair_date} at {repair.service_center} ({'authorised' if body.authorized else 'unauthorised'})")
    db.commit()
    return repair_json(repair)
