"""Date handling (SRS 1.8.5). Owner: Ayub."""
from datetime import date, datetime


DATE_FORMATS = [
    "%Y-%m-%d",      # 2026-09-28
    "%d/%m/%Y",      # 28/09/2026
    "%m/%d/%Y",      # 09/28/2026
    "%d-%b-%Y",      # 28-Sep-2026
    "%d-%B-%Y",      # 28-September-2026
    "%Y/%m/%d",      # 2026/09/28
]


def parse_date(text: str) -> date:
    """Parses date string accepting multiple international formats (SRS 1.8.5)."""
    if not text or not str(text).strip():
        raise ValueError("Empty date string cannot be parsed.")

    cleaned = str(text).strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(cleaned, fmt).date()
        except ValueError:
            continue

    raise ValueError(f"Unrecognized date format: '{text}'. Allowed formats: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, DD-Mon-YYYY.")


def warranty_status(
    end_date: date,
    extended: bool = False,
    today: date | None = None,
    alert_days: int = 30
) -> str:
    """Calculates status: 'Active', 'Expiring Soon', 'Expired', or 'Extended'"""
    current_date = today or date.today()
    days_left = (end_date - current_date).days

    if days_left < 0:
        return "Expired"
    if extended:
        return "Extended"
    if days_left <= alert_days:
        return "Expiring Soon"
    return "Active"
