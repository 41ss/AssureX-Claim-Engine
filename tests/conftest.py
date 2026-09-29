"""Test setup: every test run uses its own empty database and uploads folder, never assurex.db or uploads/."""
import os
import tempfile
from pathlib import Path

_DB_FILE = Path(tempfile.mkdtemp()) / "test.db"
os.environ["ASSUREX_DATABASE_URL"] = f"sqlite:///{_DB_FILE}"
os.environ["ASSUREX_UPLOAD_DIR"] = str(_DB_FILE.parent / "uploads")   # never the real uploads/ folder
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from src.core.db import SessionLocal, init_db  # noqa: E402
from src.core.models import User  # noqa: E402
from src.core.security import hash_password  # noqa: E402
from src.main import app  # noqa: E402

init_db()


@pytest.fixture(scope="session")
def reviewer():
    """A reviewer account (reviewers cannot self-register)."""
    db = SessionLocal()
    if not db.query(User).filter_by(email="reviewer@test.com").first():
        db.add(User(email="reviewer@test.com", password_hash=hash_password("Review123!"), full_name="Rita Reviewer", role="reviewer"))
        db.commit()
    db.close()
    return {"email": "reviewer@test.com", "password": "Review123!"}


def new_client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def customer():
    """A logged-in customer with one registered phone (bought 100 days ago, 12-month warranty)."""
    from datetime import date, timedelta
    client = new_client()
    email = f"user{os.urandom(4).hex()}@test.com"
    assert client.post("/api/auth/register", json={"name": "Test User", "email": email, "password": "Password1",
                                                   "role": "customer"}).status_code == 200
    bought = date.today() - timedelta(days=100)
    product = client.post("/api/products", json={
        "name": "Test Phone", "category": "mobile_devices", "brand": "Acme", "model": "AC-100",
        "serialNumber": f"SN{os.urandom(3).hex().upper()}", "purchaseDate": bought.isoformat(), "purchasePrice": 500,
        "retailer": "Shop", "warranty": {"provider": "Acme Care", "start": bought.isoformat(),
                                         "expiry": (bought + timedelta(days=365)).isoformat()}}).json()
    client.product = product
    return client


def png_bytes(tag: str) -> bytes:
    """A small, unique PNG (different tag -> different SHA-256)."""
    import io
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (120, 40), "white")
    ImageDraw.Draw(img).text((5, 10), tag, fill="black")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()
