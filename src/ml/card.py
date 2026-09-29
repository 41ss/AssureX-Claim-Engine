"""Claim Summary Card renderer (SRS xx).

The card is a square document: one row per claim fact, each with a coloured status chip
large enough for the Teachable Machine model to see at its 224x224 input size. Chip colours
describe the claim facts against the category's warranty policy (e.g. repairs over the
policy limit are red). The card never shows a model prediction, a confidence score or the
final decision.
"""
from pathlib import Path

import yaml
from PIL import Image, ImageDraw, ImageFont

from src.core.config import DATA_DIR, POLICIES_DIR
from src.core.contracts import ClaimFeatures

CARDS_DIR = DATA_DIR / "cards"
CARD_SIZE = 448          # square, so Teachable Machine's square crop keeps the whole card
# Validation, test and live claims are rendered in this variation. The Teachable Machine model
# (trained on both) scored 92.9% on dark validation cards against 81.3% on light ones.
EVALUATION_VARIATION = 1

# Status fills are the same in every variation; only background, font and spacing change.
STATUS_COLOURS = {
    "ok": (22, 163, 74),       # green
    "warn": (217, 119, 6),     # amber
    "bad": (220, 38, 38),      # red
    "info": (37, 99, 235),     # blue, a neutral fact
}

VARIATIONS = [
    {"page": (255, 255, 255), "rule": (226, 232, 240), "text": (15, 23, 42),
     "muted": (100, 116, 139), "font": 14, "margin": 16},
    {"page": (15, 23, 42), "rule": (51, 65, 85), "text": (241, 245, 249),
     "muted": (148, 163, 184), "font": 15, "margin": 24},
]


def load_policy(category: str) -> dict:
    path = POLICIES_DIR / f"{category}.yaml"
    if not path.exists():
        path = POLICIES_DIR / "consumer_electronics.yaml"
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def warranty_tile(f: ClaimFeatures, grace_days: int) -> tuple[str, str, str]:
    left = f.warranty_days_left
    if left < -grace_days:
        return "WARRANTY", f"EXPIRED {-left}d", "bad"
    if left < 0:
        return "WARRANTY", f"GRACE {-left}d", "warn"
    if left <= 30:
        return "WARRANTY", f"ENDS {left}d", "warn"
    return "WARRANTY", f"ACTIVE {left}d", "ok"


def timing_tile(f: ClaimFeatures) -> tuple[str, str, str]:
    if f.days_purchase_to_fault < 0:
        return "FAULT DATE", "BEFORE BUY", "bad"
    if f.days_purchase_to_fault > f.product_age_days:
        return "FAULT DATE", "AFTER CLAIM", "bad"
    return "FAULT DATE", f"DAY {f.days_purchase_to_fault}", "ok"


def repairs_tile(f: ClaimFeatures, max_repairs: int) -> tuple[str, str, str]:
    text = f"{f.previous_repairs} / MAX {max_repairs}"
    if f.previous_repairs > max_repairs:
        return "REPAIRS", text, "bad"
    if f.previous_repairs == max_repairs:
        return "REPAIRS", text, "warn"
    return "REPAIRS", text, "ok"


def document_tile(name: str, key: str, present: bool, mandatory: list[str]) -> tuple[str, str, str]:
    if present:
        return name, "PRESENT", "ok"
    return name, "MISSING", "bad" if key in mandatory else "warn"


def build_rows(f: ClaimFeatures) -> list[tuple[str, str, str]]:
    """Returns (label, value, status) for each of the 12 rows."""
    policy = load_policy(f.product_category)
    mandatory = policy.get("mandatory_documents", [])
    max_repairs = policy.get("repair_conditions", {}).get("max_covered_repairs", 3)

    if f.physical_damage:
        damage = ("DAMAGE", "PHYSICAL", "bad")
    elif f.water_damage:
        damage = ("DAMAGE", "WATER", "bad")
    else:
        damage = ("DAMAGE", "NONE", "ok")

    return [
        warranty_tile(f, policy.get("grace_period_days", 0)),
        ("FAULT", f.fault_category.replace("_", " ").upper()[:18], "info"),
        damage,
        timing_tile(f),
        repairs_tile(f, max_repairs),
        ("REPLACED", "YES" if f.product_replaced_before else "NO",
         "warn" if f.product_replaced_before else "ok"),
        ("SERIAL", "MATCH" if f.serial_matches else "MISMATCH", "ok" if f.serial_matches else "bad"),
        ("MISSING DOCS", str(f.missing_documents), "bad" if f.missing_documents else "ok"),
        document_tile("RECEIPT", "receipt", f.receipt_present, mandatory),
        document_tile("WARRANTY CARD", "warranty_card", f.warranty_card_present, mandatory),
        document_tile("PRODUCT IMAGE", "product_image", f.product_image_present, mandatory),
        document_tile("REPAIR REPORT", "repair_report", f.repair_report_present, mandatory),
    ]


def render_card(features: ClaimFeatures, variation: int = 0, output_dir: Path | None = None) -> Path:
    """Draws one Claim Summary Card and saves it as <claim_code>_v<variation>.png."""
    target_dir = output_dir or (CARDS_DIR / "tmp")
    target_dir.mkdir(parents=True, exist_ok=True)
    out_path = target_dir / f"{features.claim_code}_v{variation}.png"

    style = VARIATIONS[variation % len(VARIATIONS)]
    m = style["margin"]
    title_font = ImageFont.load_default(size=style["font"] + 2)
    small_font = ImageFont.load_default(size=style["font"] - 3)
    font = ImageFont.load_default(size=style["font"])

    img = Image.new("RGB", (CARD_SIZE, CARD_SIZE), style["page"])
    draw = ImageDraw.Draw(img)

    draw.text((m, m - 4), "CLAIM SUMMARY CARD", font=title_font, fill=style["text"])
    draw.text((m, m + style["font"] + 2),
              f"{features.claim_code}  |  {features.product_category.replace('_', ' ').title()}"
              f"  |  age {features.product_age_days}d  |  {features.warranty_months}-month warranty",
              font=small_font, fill=style["muted"])
    top = m + 2 * style["font"] + 12
    draw.line([(m, top - 4), (CARD_SIZE - m, top - 4)], fill=style["text"], width=2)

    rows = build_rows(features)
    row_h = (CARD_SIZE - top - m) / len(rows)
    chip_w = 200
    for i, (label, value, status) in enumerate(rows):
        y0 = top + i * row_h
        if i:
            draw.line([(m, y0), (CARD_SIZE - m, y0)], fill=style["rule"], width=1)
        draw.text((m + 2, y0 + (row_h - style["font"]) / 2 - 1), label.title(), font=font, fill=style["text"])
        x1 = CARD_SIZE - m
        draw.rounded_rectangle([x1 - chip_w, y0 + 3, x1, y0 + row_h - 3], radius=6, fill=STATUS_COLOURS[status])
        draw.text((x1 - chip_w + 10, y0 + (row_h - style["font"]) / 2 - 1), value, font=font, fill=(255, 255, 255))

    img.save(out_path, format="PNG")
    return out_path
