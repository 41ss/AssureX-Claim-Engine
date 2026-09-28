from pathlib import Path
import re
import shutil
from PIL import Image

try:
    import pytesseract
    # Check common Windows install path if not in PATH
    default_win_tesseract = Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe")
    if not shutil.which("tesseract") and default_win_tesseract.exists():
        pytesseract.pytesseract.tesseract_cmd = str(default_win_tesseract)
    HAS_TESSERACT = bool(shutil.which("tesseract") or default_win_tesseract.exists())
except ImportError:
    HAS_TESSERACT = False


def extract_text_from_file(file_path: Path) -> str:
    """Reads raw text from image or text document."""
    if not file_path.exists():
        return ""
    if file_path.suffix.lower() in (".txt", ".json", ".csv"):
        return file_path.read_text(encoding="utf-8", errors="ignore")
    if file_path.suffix.lower() in (".png", ".jpg", ".jpeg") and HAS_TESSERACT:
        try:
            with Image.open(file_path) as img:
                return pytesseract.image_to_string(img)
        except Exception:
            return ""
    return ""


def extract_fields(file_path: Path) -> dict:
    """Extracts purchase date, invoice number, product, serial, retailer, price from receipt."""
    text = extract_text_from_file(file_path)

    # Heuristic Regex Extraction
    inv_match = re.search(r"(?:INV|INVOICE|RECEIPT)[-#:\s]*([A-Z0-9-]+)", text, re.IGNORECASE)
    date_match = re.search(r"(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})", text)
    sn_match = re.search(r"(?:SN|SERIAL|S/N)[-#:\s]*([A-Z0-9-]+)", text, re.IGNORECASE)
    price_match = re.search(r"[\$€£]?\s*(\d+[\.,]\d{2})", text)

    return {
        "invoice_number": inv_match.group(1).strip() if inv_match else "",
        "purchase_date": date_match.group(1).strip() if date_match else "",
        "serial_number": sn_match.group(1).strip() if sn_match else "",
        "purchase_price": float(price_match.group(1).replace(",", "")) if price_match else 0.0,
        "retailer": "Official Retailer" if "official" in text.lower() else "",
        "raw_text_length": len(text),
    }
