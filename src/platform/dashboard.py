"""Dashboard, notification and report endpoints (SRS xxxix-xliii)."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from src.core.config import REPORTS_DIR
from src.core.db import get_db
from src.core.models import Notification, User
from src.platform import stats
from src.platform.common import current_user
from src.platform.settings import alert_days

router = APIRouter()


@router.get("/dashboard/stats")
def dashboard_stats(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return stats.user_stats(db, user, alert_days())


@router.get("/dashboard/trend")
def dashboard_trend(range: str = "7d", user: User = Depends(current_user), db: Session = Depends(get_db)):
    return stats.claims_trend(db, user, range)


@router.get("/dashboard/by-product")
def dashboard_by_product(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return stats.claims_by_category(db, user)


@router.get("/notifications")
def notifications(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return stats.notifications(db, user, alert_days())


@router.post("/notifications/read")
def mark_read(user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.query(Notification).filter_by(user_id=user.id, read=False).update({"read": True})
    db.commit()
    return {"ok": True}


@router.get("/reports/model-performance")
def model_performance(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return stats.model_performance(db)


@router.get("/reports/analytics")
def analytics(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return stats.analytics(db, user, alert_days())


@router.get("/reports")
def reports(user: User = Depends(current_user)):
    return stats.report_list()


@router.get("/reports/files/{name}")
def report_file(name: str, user: User = Depends(current_user)):
    allowed = {row["id"] for row in stats.report_list()}
    if name not in allowed:     # only the listed report files, never an arbitrary path
        raise HTTPException(404, "Report not found.")
    return FileResponse(REPORTS_DIR / name, filename=name)
