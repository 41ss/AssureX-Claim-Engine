"""Creates a fresh assurex.db with demo accounts and one claim for every case the SRS asks
the project to demonstrate (SRS 1.10.8). Run from the repo root:

    python database/seed_db.py

Claims are created through the real API (the same endpoints the web pages call), so each
one goes through OCR, the duplicate checks, both models and the decision engine. Dates are
relative to the day the script runs, so warranties are active or expired as described.
"""
import io
import shutil
import sys
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import pandas as pd  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image, ImageDraw, ImageFont  # noqa: E402

from src.core.config import DATA_DIR, UPLOAD_DIR  # noqa: E402
from src.core.db import SessionLocal, engine, init_db  # noqa: E402
from src.core.models import User  # noqa: E402
from src.core.security import hash_password  # noqa: E402

TODAY = date.today()
ACCOUNTS = [  # email, password, name, role
    ("admin@assurex.com", "Admin123!", "Amara Wekesa", "admin"),
    ("evaluator@assurex.com", "Evaluator123!", "Competition Evaluator", "admin"),
    ("reviewer@assurex.com", "Review123!", "Rita Otieno", "reviewer"),
    ("customer@assurex.com", "Customer123!", "John Mwangi", "customer"),
    ("service@assurex.com", "Service123!", "Brian Kamau (TechCare Service Centre)", "service_center"),
]


def days_ago(n: int) -> str:
    return (TODAY - timedelta(days=n)).isoformat()


def document_png(lines: list[str], tag: str) -> bytes:
    """A readable document image. The tag makes each file unique (a different SHA-256)."""
    font = ImageFont.load_default(size=28)
    img = Image.new("RGB", (900, 70 + 46 * (len(lines) + 1)), "white")
    draw = ImageDraw.Draw(img)
    for i, line in enumerate(lines + [f"ref {tag}"]):
        draw.text((30, 30 + 46 * i), line, fill="black", font=font)
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()


def receipt(product: dict, invoice: str, tag: str, serial: str | None = None) -> bytes:
    return document_png([
        product["retailer"].upper(), f"Retailer: {product['retailer']}", f"Invoice No: {invoice}",
        f"Date: {date.fromisoformat(product['purchaseDate']).strftime('%d/%m/%Y')}", f"Product: {product['name']}",
        f"Model No: {product['model']}", f"Serial No: {serial or product['serialNumber']}",
        f"Warranty: {product['months']} months", f"TOTAL KES {product['purchasePrice']:,.2f}",
    ], tag)


class Api:
    """A logged-in user talking to the running application through its API."""

    def __init__(self, app, email: str, password: str):
        self.client = TestClient(app)
        self.call("post", "/api/auth/login", json={"email": email, "password": password})

    def call(self, method: str, path: str, **kwargs):
        response = getattr(self.client, method)(path, **kwargs)
        if response.status_code >= 400:
            raise RuntimeError(f"{method.upper()} {path} -> {response.status_code}: {response.text}")
        return response.json()

    def product(self, name, category, brand, model, serial, bought_days_ago, months, provider, retailer, price, extended_months=None):
        start = TODAY - timedelta(days=bought_days_ago)
        end = start + timedelta(days=round(months * 30.4))
        body = {"name": name, "category": category, "brand": brand, "model": model, "serialNumber": serial,
                "purchaseDate": start.isoformat(), "purchasePrice": price, "retailer": retailer,
                "warranty": {"provider": provider, "start": start.isoformat(), "expiry": end.isoformat(),
                             "serviceCenter": f"{brand} Authorised Care, Nairobi"}}
        if extended_months:
            body["extendedWarranty"] = {"provider": f"{provider} Extended", "expiry": (end + timedelta(days=round(extended_months * 30.4))).isoformat()}
        created = self.call("post", "/api/products", json=body)
        created.update(retailer=retailer, purchasePrice=price, months=months)
        return created

    def repair(self, product, repair_days_ago, centre, authorized=True, parts="", outcome="Fixed"):
        return self.call("post", f"/api/products/{product['id']}/repairs", json={
            "date": days_ago(repair_days_ago), "serviceCenter": centre, "authorized": authorized,
            "partsReplaced": parts, "outcome": outcome, "cost": 2500})

    def claim(self, product, fault, fault_days_ago, description, documents, damage="none", serial=None, invoice="",
              submit=True, printed_serial=None):
        """Draft -> upload documents -> confirm the OCR values -> submit."""
        draft = self.call("post", "/api/claims", json={
            "productId": product["id"], "faultCategory": fault, "damageType": damage, "faultDate": days_ago(fault_days_ago),
            "description": description, "serialNumber": serial or product["serialNumber"], "invoiceNumber": invoice})
        code = draft["id"]
        for doc_type, content in documents.items():
            doc = self.call("post", f"/api/claims/{code}/documents", data={"doc_type": doc_type},
                            files={"file": (f"{doc_type}.png", content, "image/png")})
            if doc["extracted"]:
                # Like a careful user, fix OCR misreads (e.g. O read for 0) of the serial printed on the document.
                checked = dict(doc["extracted"])
                if checked.get("serial_number"):
                    checked["serial_number"] = printed_serial or product["serialNumber"]
                self.call("put", f"/api/claims/{code}/documents/{doc['id']}/verified", json=checked)
        return self.call("post", f"/api/claims/{code}/submit") if submit else draft


def standard_docs(product, tag, invoice, receipt_serial=None, skip=(), extra=()):
    """Receipt with OCR text, serial photo, product photo, fault evidence (+ extras), minus skipped ones."""
    docs = {
        "receipt": receipt(product, invoice, tag, receipt_serial),
        "serial_photo": document_png([f"Serial No: {receipt_serial or product['serialNumber']}"], tag),
        "product_image": document_png([f"Photo of {product['name']}"], tag),
        "fault_evidence": document_png(["Photo of the fault"], tag),
        "warranty_card": document_png([f"{product['warranty']['provider']} warranty card", f"Serial No: {product['serialNumber']}"], tag),
    }
    for name in extra:
        docs[name] = document_png(["Attached evidence"], tag)
    return {k: v for k, v in docs.items() if k not in skip}


def dataset_claim(api: Api, row: pd.Series, name: str, brand: str):
    """Recreates one dataset test claim as a live claim with the same features."""
    policy_docs = {"consumer_electronics": ["receipt", "serial_photo", "fault_evidence"],
                   "mobile_devices": ["receipt", "serial_photo", "product_image", "fault_evidence"],
                   "small_appliances": ["receipt", "product_image", "serial_photo"]}[row.product_category]
    age, left = int(row.product_age_days), int(row.warranty_days_left)
    start = TODAY - timedelta(days=age)
    product = api.call("post", "/api/products", json={
        "name": name, "category": row.product_category, "brand": brand, "model": f"{brand[:2].upper()}-{row.name[-4:]}",
        "serialNumber": f"SN{row.name[-5:]}X", "purchaseDate": start.isoformat(), "purchasePrice": 30000, "retailer": "Hotpoint Nairobi",
        "warranty": {"provider": f"{brand} Care", "start": start.isoformat(), "expiry": (TODAY + timedelta(days=left)).isoformat()}})
    product.update(retailer="Hotpoint Nairobi", purchasePrice=30000, months=int(row.warranty_months))
    for i in range(int(row.previous_repairs)):
        api.repair(product, age - 20 - 25 * i if age > 30 else 1, f"{brand} Authorised Care")
    serial = product["serialNumber"]
    docs = {d: document_png([f"Serial No: {serial}"] if d == "serial_photo" else ["Attached evidence"], row.name) for d in policy_docs}
    docs["receipt"] = receipt(product, f"INV-{row.name}", row.name)
    for flag, doc in (("warranty_card_present", "warranty_card"), ("product_image_present", "product_image"), ("repair_report_present", "repair_report")):
        if str(row[flag]).lower() == "true":
            docs[doc] = document_png(["Attached evidence"], row.name)
        elif doc in docs and doc not in policy_docs:
            del docs[doc]
    return api.claim(product, row.fault_category, age - int(row.days_purchase_to_fault),
                     f"Recreated from dataset test claim {row.name} ({row.scenario}).", docs)


def reset_database() -> None:
    engine.dispose()
    db_file = ROOT / "assurex.db"
    if db_file.exists():
        db_file.unlink()
    shutil.rmtree(UPLOAD_DIR, ignore_errors=True)
    init_db()
    db = SessionLocal()
    for email, password, name, role in ACCOUNTS:
        db.add(User(email=email, password_hash=hash_password(password), full_name=name, role=role,
                    phone="+254 700 000 000" if role in ("customer", "service_center") else ""))
    db.commit()
    db.close()


def seed() -> list[tuple[str, str, str, str]]:
    reset_database()
    from src.main import app     # imported after the reset so the app opens the new database
    results = []

    def record(case, claim):
        results.append((case, claim["id"], claim["decision"]["result"] or "(draft)", claim["stage"]))

    with TestClient(app):        # runs the app startup, which loads both models once
        john = Api(app, "customer@assurex.com", "Customer123!")
        centre = Api(app, "service@assurex.com", "Service123!")

        phone = john.product("Galaxy A55", "mobile_devices", "Samsung", "SM-A556E", "RF8X20ABC12", 345, 12, "Samsung Care", "TechMart Nairobi", 45999)
        record("Valid claim", john.claim(phone, "battery", 4, "Battery drains from full to empty in about two hours.",
                                         standard_docs(phone, "valid", "INV-2026-00417"), invoice="INV-2026-00417"))

        tv = john.product("Bravia 55\" 4K TV", "consumer_electronics", "Sony", "XR-55A80L", "SNY-88419", 200, 12, "Sony Warranty", "Hotpoint Nairobi", 129999)
        record("Invalid claim (liquid damage)", john.claim(tv, "power_supply", 4, "TV stopped powering on after a drink was spilled on it.",
                                                           standard_docs(tv, "water", "INV-2026-01002"), damage="water"))

        record("Duplicate claim", john.claim(phone, "battery", 1, "Battery drains from full to empty in about two hours.",
                                             {**standard_docs(phone, "dup", "INV-2026-00417", skip=("receipt",)),
                                              "receipt": receipt(phone, "INV-2026-00417", "valid")}, invoice="INV-2026-00417"))

        old_phone = john.product("iPhone 13", "mobile_devices", "Apple", "A2633", "F2LXK9QWJ", 430, 12, "AppleCare", "iStore Sarit", 89999)
        record("Expired warranty", john.claim(old_phone, "display", 5, "Display flickers and shows green lines.",
                                              standard_docs(old_phone, "expired", "INV-2025-03321")))

        kettle = john.product("Electric Kettle 1.7L", "small_appliances", "Ramtons", "RM-448", "RMT-44810", 90, 24, "Ramtons", "Naivas Westlands", 3499)
        record("Missing documents", john.claim(kettle, "heating_element", 2, "Kettle no longer heats the water.",
                                               standard_docs(kettle, "missing", "INV-2026-02210", skip=("product_image", "serial_photo"))))

        laptop = john.product("XPS 15", "consumer_electronics", "Dell", "XPS9530", "DL7H2K9", 120, 12, "Dell Premium Care", "Dell Store Nairobi", 219999)
        record("Contradictory claim (fault before purchase)", john.claim(laptop, "motherboard", 135, "Laptop will not boot; fans spin, no display.",
                                                                        standard_docs(laptop, "contra", "INV-2026-01877")))

        tablet = centre.product("Galaxy Tab S9", "mobile_devices", "Samsung", "SM-X710", "R52W31ZT8", 100, 12, "Samsung Care", "Phone Place Moi Ave", 84999)
        record("Serial-number mismatch", centre.claim(tablet, "charging_port", 3, "Tablet does not charge with any cable.",
                                                      standard_docs(tablet, "serial", "INV-2026-02981", receipt_serial="R52W99XX1"),
                                                      serial="R52W99XX1", printed_serial="R52W99XX1"))

        speaker = centre.product("Flip 6 Speaker", "consumer_electronics", "JBL", "FLIP6", "JBL6TT0012", 180, 12, "JBL Care", "Game Stores Garden City", 15999)
        centre.repair(speaker, 60, "Street-side repair shop, Luthuli Ave", authorized=False, parts="Charging board")
        record("Unauthorised repair", centre.claim(speaker, "ports", 4, "Charging port loose again after an earlier repair.",
                                                   standard_docs(speaker, "unauth", "INV-2026-01544")))

        blender = john.product("Power Blender 600W", "small_appliances", "Von", "VSBL60", "VON60BL77", 732, 24, "Von Hotpoint", "Carrefour Two Rivers", 6999)
        record("Boundary date (within 7-day grace period)", john.claim(blender, "motor_or_drive", 2, "Motor hums but blades do not turn.",
                                                                      standard_docs(blender, "boundary", "INV-2024-04410")))

        test_rows = pd.read_csv(DATA_DIR / "claims_test.csv").set_index("claim_code")
        record("Model disagreement (dataset claim CLM-00332)", dataset_claim(centre, test_rows.loc["CLM-00332"], "OLED Monitor 27\"", "LG"))

        record("Manual review (fault not on covered list)", john.claim(tv, "other", 3, "Remote pairing keeps dropping.",
                                                                       standard_docs(tv, "other", "INV-2026-01002")))
        record("Draft (not submitted yet)", john.claim(laptop, "battery", 2, "Battery swelling slightly.",
                                                       standard_docs(laptop, "draft", "INV-2026-01877", skip=("fault_evidence",)), submit=False))

        # More dataset test claims so the dashboards and charts have data.
        for code in ("CLM-00034", "CLM-00977", "CLM-00353", "CLM-00869", "CLM-00983"):
            record(f"Extra dataset claim {code}", dataset_claim(centre, test_rows.loc[code], f"Device {code[-3:]}", "Hisense"))

        # Reviewer actions: one request for information, one override with a reason.
        rita = Api(app, "reviewer@assurex.com", "Review123!")
        missing = next(r for r in results if r[0] == "Missing documents")
        rita.call("post", f"/api/admin/review/{missing[1]}/action", json={"action": "request_info", "comment": "Please upload a photo of the kettle and its serial plate."})
        overridden = next(r for r in results if r[0].startswith("Model disagreement"))
        rita.call("post", f"/api/admin/review/{overridden[1]}/action", json={"action": "approve", "comment": "Repairs were at an authorised centre and within the limit; power supply fault is covered."})
        final = {c["id"]: c["stage"] for c in rita.call("get", "/api/claims")}
    return [(case, code, decision, final.get(code, status)) for case, code, decision, status in results]


if __name__ == "__main__":
    rows = seed()
    width = max(len(r[0]) for r in rows)
    print(f"{'Case':<{width}}  Claim ID        Decision                 Status")
    for case, code, decision, status in rows:
        print(f"{case:<{width}}  {code:<15} {decision:<24} {status}")
    print("\nLogins: " + "; ".join(f"{e} / {p} ({r})" for e, p, _, r in ACCOUNTS))
