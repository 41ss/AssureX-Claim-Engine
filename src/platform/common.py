"""Shared helpers for the API routes: who is logged in, role checks, audit log,
notifications and admin alerts."""
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from src.core.db import get_db
from src.core.models import Alert, AuditLog, Notification, User

STAFF_ROLES = ("reviewer", "admin")


def user_code(user: User) -> str:
    """The User ID shown in the app (SRS ii)."""
    return f"USR-{user.id:04d}"


def session_payload(user: User) -> dict:
    """What the browser keeps about the logged-in user."""
    initials = "".join(part[0] for part in user.full_name.split()[:2]).upper() or user.email[0].upper()
    return {"id": user_code(user), "name": user.full_name, "email": user.email, "phone": user.phone,
            "role": user.role, "avatarInitials": initials}


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """The logged-in user, from the signed session cookie. 401 if not logged in."""
    user_id = request.session.get("user_id")
    user = db.get(User, user_id) if user_id else None
    if user is None:
        raise HTTPException(status_code=401, detail="Please log in to continue.")
    return user


def staff_user(user: User = Depends(current_user)) -> User:
    if user.role not in STAFF_ROLES:
        raise HTTPException(status_code=403, detail="Only reviewers and administrators can do this.")
    return user


def admin_user(user: User = Depends(current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can do this.")
    return user


def is_staff(user: User) -> bool:
    return user.role in STAFF_ROLES


def audit(db: Session, user: User | None, action: str, target: str = "", **detail) -> None:
    """Records an important action (SRS xlvii). The caller commits."""
    db.add(AuditLog(user_id=user.id if user else None, action=action, target=target, detail=detail))


def notify(db: Session, user_id: int, title: str, message: str, claim_code: str = "") -> None:
    """In-app notification for a user (SRS xxxix). The caller commits."""
    db.add(Notification(user_id=user_id, title=title, message=message, claim_code=claim_code))


def raise_alert(db: Session, kind: str, detail: str) -> None:
    """Monitoring alert for administrators (SRS l). The caller commits."""
    db.add(Alert(kind=kind, detail=detail))
