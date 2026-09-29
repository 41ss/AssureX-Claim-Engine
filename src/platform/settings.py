"""Admin-editable settings stored in config/thresholds.yaml (SRS ix, xxiv).

Values are changed in place with regular expressions so the comments in the file,
which explain each threshold, are kept.
"""
import re

import yaml

from src.core.config import THRESHOLDS_FILE


def read_settings() -> dict:
    cfg = yaml.safe_load(THRESHOLDS_FILE.read_text(encoding="utf-8"))
    ladder = {rule["status"]: rule for rule in cfg.get("consistency", [])}
    return {
        "warrantyExpiryAlertDays": cfg.get("warranty_expiry_alert_days", 30),
        "failedLoginAlertAfter": cfg.get("failed_login_alert_after", 5),
        "minConfidence": cfg.get("min_confidence", 0.6),
        "strongMatch": {"maxDifference": ladder["Strong Match"]["max_difference"],
                        "minTopConfidence": ladder["Strong Match"]["min_top_confidence"]},
        "acceptableMatch": {"maxDifference": ladder["Acceptable Match"]["max_difference"],
                            "minTopConfidence": ladder["Acceptable Match"]["min_top_confidence"]},
    }


def _check_fraction(name: str, value) -> float:
    value = float(value)
    if not 0 <= value <= 1:
        raise ValueError(f"{name} must be between 0 and 1.")
    return value


def write_settings(new: dict) -> dict:
    """Validates and saves the settings, returning what was saved."""
    days = int(new["warrantyExpiryAlertDays"])
    if not 1 <= days <= 365:
        raise ValueError("The expiry alert must be between 1 and 365 days.")
    min_conf = _check_fraction("Minimum confidence", new["minConfidence"])
    strong = {k: _check_fraction("Strong Match values", v) for k, v in new["strongMatch"].items()}
    accept = {k: _check_fraction("Acceptable Match values", v) for k, v in new["acceptableMatch"].items()}

    text = THRESHOLDS_FILE.read_text(encoding="utf-8")
    text = re.sub(r"(?m)^(warranty_expiry_alert_days:\s*)[\d.]+", rf"\g<1>{days}", text)
    text = re.sub(r"(?m)^(min_confidence:\s*)[\d.]+", rf"\g<1>{min_conf}", text)
    for status, values in (("Strong Match", strong), ("Acceptable Match", accept)):
        block = re.compile(rf"(- status: {status}\n\s+max_difference:\s*)[\d.]+(\n\s+min_top_confidence:\s*)[\d.]+")
        text = block.sub(rf"\g<1>{values['maxDifference']}\g<2>{values['minTopConfidence']}", text)
    THRESHOLDS_FILE.write_text(text, encoding="utf-8")
    return read_settings()


def alert_days() -> int:
    return read_settings()["warrantyExpiryAlertDays"]
