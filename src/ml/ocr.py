"""Receipt and invoice reading (SRS vi). Owner: Victor.

Text comes from Tesseract OCR for images, and from the PDF's own text layer for PDFs
(scanned PDFs with no text layer are rendered to an image and OCR'd). Regular expressions
then pick out the fields. A field that is not found is returned empty - never guessed -
so the user can type it in on the verification step (SRS vii).
"""
from pathlib import Path
import re
import shutil

from PIL import Image

from src.teachable.dates import parse_date

try:
    import pytesseract
    # Windows installs Tesseract here and often does not add it to PATH.
    _WIN_TESSERACT = Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe")
    if not shutil.which("tesseract") and _WIN_TESSERACT.exists():
        pytesseract.pytesseract.tesseract_cmd = str(_WIN_TESSERACT)
    HAS_TESSERACT = bool(shutil.which("tesseract") or _WIN_TESSERACT.exists())
except ImportError:
    HAS_TESSERACT = False

FIELDS = ("invoice_number", "purchase_date", "product_name", "model_number",
          "serial_number", "retailer", "purchase_amount", "warranty_months")


class OcrUnavailable(RuntimeError):
    """Tesseract is not installed, so images cannot be read."""


def _ocr_image(img: Image.Image) -> str:
    if not HAS_TESSERACT:
        raise OcrUnavailable("Text recognition is not available on this server.")
    return pytesseract.image_to_string(img.convert("L"))


def extract_text(file_path: Path) -> str:
    """Returns all text found in an image or PDF."""
    suffix = file_path.suffix.lower()
    if suffix in (".png", ".jpg", ".jpeg"):
        with Image.open(file_path) as img:
            return _ocr_image(img)
    if suffix == ".pdf":
        import fitz  # PyMuPDF
        with fitz.open(file_path) as pdf:
            text = "\n".join(page.get_text() for page in pdf)
            if text.strip():
                return text
            # Scanned PDF: no text layer, so OCR the first page as an image.
            pix = pdf[0].get_pixmap(dpi=200)
            return _ocr_image(Image.frombytes("RGB", (pix.width, pix.height), pix.samples))
    return ""


def _first(patterns: list[str], text: str) -> str:
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        if match:
            return match.group(1).strip(" :#-\t")
    return ""


def _normalise_date(raw: str) -> str:
    """Any supported date format -> YYYY-MM-DD, or '' if it cannot be read."""
    try:
        return parse_date(raw).isoformat()
    except ValueError:
        return ""


# Invoice, model and serial numbers always contain at least one digit; requiring one stops
# ordinary words ("Serial photo") being read as a serial number.
CODE_WITH_DIGIT = r"([A-Z0-9-/]*\d[A-Z0-9-/]*)"


def parse_fields(text: str) -> dict:
    """Picks the receipt fields out of raw text. Every key in FIELDS is always present."""
    label_value = r"[:#\s]+([^\n]+)"
    date_raw = _first([
        r"(?:purchase|invoice|receipt|sale)?\s*date" + label_value,
        r"(\d{4}[-/]\d{2}[-/]\d{2})",
        r"(\d{2}[-/]\d{2}[-/]\d{4})",
        r"(\d{1,2}-[A-Za-z]{3,9}-\d{4})",
    ], text)
    date_match = re.search(r"\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4}|\d{1,2}-[A-Za-z]{3,9}-\d{4}", date_raw)
    amount_raw = _first([
        r"(?:grand\s+total|total|amount(?:\s+paid)?)[:\s]*(?:KES|KSH|USD|\$|€|£)?\s*([\d,]+(?:\.\d{2})?)",
    ], text)
    warranty_raw = _first([r"warranty[^\n\d]{0,20}(\d{1,2})\s*(?:months|month|mo)",
                           r"warranty[^\n\d]{0,20}(\d)\s*(?:years|year|yr)"], text)
    warranty_months = ""
    if warranty_raw:
        is_years = re.search(r"warranty[^\n\d]{0,20}\d\s*(?:years|year|yr)", text, re.IGNORECASE)
        warranty_months = str(int(warranty_raw) * 12) if is_years else warranty_raw

    return {
        "invoice_number": _first([r"(?:invoice|inv|receipt)\s*(?:no\.?|number|#)[:#\s]*" + CODE_WITH_DIGIT], text),
        "purchase_date": _normalise_date(date_match.group(0)) if date_match else "",
        "product_name": _first([r"(?:product|item|description)" + label_value], text),
        "model_number": _first([r"model\s*(?:no\.?|number)?[:#\s]+" + CODE_WITH_DIGIT], text),
        "serial_number": _first([r"(?:serial\s*(?:no\.?|number)?|s/n|\bsn)[:#\s]+" + CODE_WITH_DIGIT], text),
        "retailer": _first([r"(?:retailer|store|sold\s+by|seller)" + label_value], text),
        "purchase_amount": amount_raw.replace(",", ""),
        "warranty_months": warranty_months,
    }


def extract_fields(file_path: Path) -> dict:
    """Reads a receipt or invoice. Returns {"fields": {...}, "message": str}.

    The message tells the user what happened (text read, nothing found, OCR unavailable),
    without technical detail (SRS xlix).
    """
    empty = {key: "" for key in FIELDS}
    try:
        text = extract_text(file_path)
    except OcrUnavailable as exc:
        return {"fields": empty, "message": f"{exc} Please type the details in."}
    except Exception:
        return {"fields": empty, "message": "We couldn't read this document. Please type the details in."}
    if not text.strip():
        return {"fields": empty, "message": "No text was found in this document. Please type the details in."}
    fields = parse_fields(text)
    found = sum(1 for v in fields.values() if v)
    return {"fields": fields, "message": f"Read {found} of {len(FIELDS)} fields - check them and fill in anything missing."}
