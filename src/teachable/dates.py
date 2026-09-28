"""Date handling (viii, ix, and the "another date format" change). Owner: Ayub."""
from datetime import date


def parse_date(text: str) -> date:
    """Accept every date format we support and return a date. Raise ValueError otherwise."""
    raise NotImplementedError("teachable.dates: not built yet (Ayub)")


def warranty_status(end_date: date, extended: bool = False, today: date | None = None,
                    alert_days: int = 30) -> str:
    """Return "Active", "Expiring Soon", "Expired" or "Extended" (SRS viii).

    alert_days comes from config/thresholds.yaml and is set by an administrator (SRS ix).
    """
    raise NotImplementedError("teachable.dates: not built yet (Ayub)")
