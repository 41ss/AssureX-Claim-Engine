"""Create all tables in assurex.db. Run from the repo root: python database/init_db.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.core.db import init_db  # noqa: E402

if __name__ == "__main__":
    init_db()
    print("Database ready: assurex.db")
