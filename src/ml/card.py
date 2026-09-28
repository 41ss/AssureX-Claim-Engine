from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from src.core.config import DATA_DIR
from src.core.contracts import ClaimFeatures
CARDS_DIR = DATA_DIR / "cards"


def get_card_theme(variation: int) -> dict:
    """Returns visual theme styling. Enables multi-variation training."""
    if variation % 2 == 1:
        # Dark Slate Theme
        return {
            "bg": (15, 23, 42),
            "card_bg": (30, 41, 59),
            "border": (71, 85, 105),
            "text_primary": (248, 250, 252),
            "text_muted": (148, 163, 184),
            "accent": (56, 189, 248),
            "flag_bad": (239, 68, 68),
            "flag_good": (34, 197, 94),
        }
    # Light Modern Theme 
    return {
        "bg": (248, 250, 252),
        "card_bg": (255, 255, 255),
        "border": (203, 213, 225),
        "text_primary": (15, 23, 42),
        "text_muted": (100, 116, 139),
        "accent": (2, 132, 199),
        "flag_bad": (220, 38, 38),
        "flag_good": (22, 163, 74),
    }


def render_card(features: ClaimFeatures, variation: int = 0, output_dir: Path | None = None) -> Path:
    """Renders one visual Claim Summary Card and saves to disk as PNG."""
    target_dir = output_dir or (CARDS_DIR / "tmp")
    target_dir.mkdir(parents=True, exist_ok=True)
    out_path = target_dir / f"{features.claim_code}_v{variation}.png"
    # Canvas Dimensions
    width, height = 520, 680
    theme = get_card_theme(variation)
    img = Image.new("RGB", (width, height), theme["bg"])
    draw = ImageDraw.Draw(img)
    font = ImageFont.load_default()
    # Outer Card Container
    draw.rounded_rectangle([(16, 16), (width - 16, height - 16)], radius=12, fill=theme["card_bg"], outline=theme["border"], width=2)
    # Header Banner
    draw.rectangle([(16, 16), (width - 16, 75)], fill=theme["bg"])
    draw.line([(16, 75), (width - 16, 75)], fill=theme["border"], width=2)
    draw.text((32, 28), "ASSUREX CLAIM SUMMARY CARD", font=font, fill=theme["accent"])
    draw.text((32, 48), f"CLAIM ID: {features.claim_code}  |  CAT: {features.product_category.upper()}", font=font, fill=theme["text_primary"])
    #  Product & Warranty
    y = 95
    draw.text((32, y), "-- PRODUCT & WARRANTY STATUS --", font=font, fill=theme["accent"])
    y += 24
    draw.text((36, y), f"Product Age:          {features.product_age_days} days", font=font, fill=theme["text_primary"])
    y += 20
    draw.text((36, y), f"Warranty Duration:    {features.warranty_months} months", font=font, fill=theme["text_primary"])
    y += 20
    status_str = f"EXPIRED ({abs(features.warranty_days_left)}d ago)" if features.warranty_days_left < 0 else f"ACTIVE ({features.warranty_days_left}d left)"
    status_color = theme["flag_bad"] if features.warranty_days_left < 0 else theme["flag_good"]
    draw.text((36, y), f"Warranty Window:      {status_str}", font=font, fill=status_color)
    # Fault & Damage
    y += 35
    draw.line([(32, y), (width - 32, y)], fill=theme["border"], width=1)
    y += 15
    draw.text((32, y), "-- REPORTED FAULT & DAMAGE --", font=font, fill=theme["accent"])
    y += 24
    draw.text((36, y), f"Reported Fault:       {features.fault_category}", font=font, fill=theme["text_primary"])
    y += 20
    draw.text((36, y), f"Purchase to Fault:    {features.days_purchase_to_fault} days", font=font, fill=theme["text_primary"])
    y += 20
    phys_color = theme["flag_bad"] if features.physical_damage else theme["flag_good"]
    water_color = theme["flag_bad"] if features.water_damage else theme["flag_good"]
    draw.text((36, y), f"Physical Damage:      {'YES' if features.physical_damage else 'NO'}", font=font, fill=phys_color)
    y += 20
    draw.text((36, y), f"Liquid/Water Damage:  {'YES' if features.water_damage else 'NO'}", font=font, fill=water_color)
    #  Repair History
    y += 35
    draw.line([(32, y), (width - 32, y)], fill=theme["border"], width=1)
    y += 15
    draw.text((32, y), "-- REPAIR & REPLACEMENT HISTORY --", font=font, fill=theme["accent"])
    y += 24
    draw.text((36, y), f"Prior Repair Count:   {features.previous_repairs}", font=font, fill=theme["text_primary"])
    y += 20
    draw.text((36, y), f"Replaced Previously:  {'YES' if features.product_replaced_before else 'NO'}", font=font, fill=theme["text_primary"])
    # Evidence & Document Checklist
    y += 35
    draw.line([(32, y), (width - 32, y)], fill=theme["border"], width=1)
    y += 15
    draw.text((32, y), "-- EVIDENCE & VERIFICATION --", font=font, fill=theme["accent"])
    y += 24
    docs = [
        ("Purchase Receipt", features.receipt_present),
        ("Warranty Card", features.warranty_card_present),
        ("Product Image", features.product_image_present),
        ("Repair Report", features.repair_report_present),
    ]
    for doc_name, present in docs:
        color = theme["flag_good"] if present else theme["flag_bad"]
        symbol = "[OK] PRESENT" if present else "[X]  MISSING"
        draw.text((36, y), f"{doc_name:<20}: {symbol}", font=font, fill=color)
        y += 18
    # Integrity Verification
    y += 10
    serial_color = theme["flag_good"] if features.serial_matches else theme["flag_bad"]
    serial_str = "MATCHED (VERIFIED)" if features.serial_matches else "MISMATCH / UNCONFIRMED"
    draw.text((36, y), f"Serial Number Check : {serial_str}", font=font, fill=serial_color)
    y += 20
    docs_color = theme["flag_good"] if features.missing_documents == 0 else theme["flag_bad"]
    draw.text((36, y), f"Missing Doc Count   : {features.missing_documents}", font=font, fill=docs_color)
    img.save(out_path, format="PNG")
    return out_path
