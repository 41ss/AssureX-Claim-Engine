"""App-wide settings. Paths are relative to the repo root."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

DATABASE_URL = f"sqlite:///{ROOT / 'assurex.db'}"
UPLOAD_DIR = ROOT / "uploads"
MODEL_DIR = ROOT / "model"          # saved Python model, encoders, Teachable Machine export
DATA_DIR = ROOT / "data"
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

ALLOWED_UPLOAD_TYPES = {".pdf", ".jpg", ".jpeg", ".png"}
MAX_UPLOAD_MB = 10
