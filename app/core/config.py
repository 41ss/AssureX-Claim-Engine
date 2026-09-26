"""App-wide settings. Paths are relative to the repo root."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

DATABASE_URL = f"sqlite:///{ROOT / 'assurex.db'}"
UPLOAD_DIR = ROOT / "uploads"
MODELS_DIR = ROOT / "models"
DATA_DIR = ROOT / "data"
POLICIES_FILE = ROOT / "app" / "decision" / "policies.yaml"

CLAIM_CLASSES = ("Valid Claim", "Invalid Claim", "Manual Review")

ALLOWED_UPLOAD_TYPES = {".pdf", ".jpg", ".jpeg", ".png"}
MAX_UPLOAD_MB = 10
