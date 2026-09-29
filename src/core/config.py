"""App-wide settings. Paths are relative to the repo root."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

DATABASE_URL = os.environ.get("ASSUREX_DATABASE_URL", f"sqlite:///{ROOT / 'assurex.db'}")
# Signs the login-session cookie. Set ASSUREX_SECRET_KEY in production; the default is for local runs only.
SECRET_KEY = os.environ.get("ASSUREX_SECRET_KEY", "assurex-local-development-key")
UPLOAD_DIR = Path(os.environ.get("ASSUREX_UPLOAD_DIR", ROOT / "uploads"))   # uploads and rendered cards
CARD_DIR = UPLOAD_DIR / "cards"      # Claim Summary Cards rendered for live claims
MODEL_DIR = ROOT / "model"          # saved Python model, encoders, Teachable Machine export
# Model versions used for new predictions (SRS xlviii). Older predictions keep the version that made them.
PYTHON_MODEL_VERSION = "v2"         # model/python_v2.joblib
TEACHABLE_MODEL_VERSION = "v2"      # model/teachable_v2/
DATA_DIR = ROOT / "data"
REPORTS_DIR = ROOT / "reports"
POLICIES_DIR = ROOT / "policies"    # one warranty-policy file per product category (SRS xxvi)
THRESHOLDS_FILE = ROOT / "config" / "thresholds.yaml"
TEMPLATES_DIR = ROOT / "templates"
STATIC_DIR = ROOT / "static"

CLAIM_CLASSES = ("Valid Claim", "Invalid Claim", "Manual Review")
FINAL_DECISIONS = ("Likely Valid", "Likely Invalid", "Manual Review Required")
CLAIM_STATUSES = (
    "Draft", "Submitted", "Under Evaluation", "Additional Information Required",
    "Manual Review", "Approved", "Rejected", "Closed",
)
ROLES = ("customer", "service_center", "reviewer", "admin")

ALLOWED_UPLOAD_TYPES = {".pdf", ".jpg", ".jpeg", ".png"}
ALLOWED_VIDEO_TYPES = {".mp4"}              # fault videos (SRS xii)
VIDEO_DOC_TYPES = {"fault_video", "fault_evidence"}
MAX_UPLOAD_MB = 10
MAX_VIDEO_MB = 50
