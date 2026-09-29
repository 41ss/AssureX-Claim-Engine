"""Registration, login and profile (SRS i, ii). The session is a signed cookie."""
import re

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.core.db import get_db
from src.core.models import User
from src.core.security import hash_password, verify_password
from src.platform.common import audit, current_user, raise_alert, session_payload
from src.platform.settings import read_settings

router = APIRouter(prefix="/auth")
SELF_REGISTER_ROLES = ("customer", "service_center")   # reviewers and admins are created by an administrator
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class LoginIn(BaseModel):
    email: str
    password: str


class RegisterIn(BaseModel):
    name: str
    email: str
    phone: str = ""
    password: str
    role: str = "customer"


class ProfileIn(BaseModel):
    name: str
    email: str
    phone: str = ""


class PasswordIn(BaseModel):
    currentPassword: str
    newPassword: str


def _check_email(db: Session, email: str, exclude_id: int | None = None) -> str:
    email = email.strip().lower()
    if not EMAIL_PATTERN.match(email):
        raise HTTPException(400, "Enter a valid email address.")
    existing = db.query(User).filter_by(email=email).first()
    if existing and existing.id != exclude_id:
        raise HTTPException(400, "An account with this email already exists.")
    return email


@router.post("/login")
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=body.email.strip().lower()).first()
    if user is None or not verify_password(body.password, user.password_hash):
        if user is not None:
            user.failed_logins += 1
            if user.failed_logins == read_settings()["failedLoginAlertAfter"]:
                raise_alert(db, "repeated_login", f"{user.failed_logins} failed logins in a row for {user.email}.")
            db.commit()
        raise HTTPException(401, "Incorrect email or password. Please try again.")
    user.failed_logins = 0
    request.session["user_id"] = user.id
    audit(db, user, "login", user.email)
    db.commit()
    return session_payload(user)


@router.post("/register")
def register(body: RegisterIn, request: Request, db: Session = Depends(get_db)):
    if body.role not in SELF_REGISTER_ROLES:
        raise HTTPException(400, "Choose customer or service-centre employee.")
    if len(body.password) < 8:
        raise HTTPException(400, "Use a password of at least 8 characters.")
    if not body.name.strip():
        raise HTTPException(400, "Enter your full name.")
    user = User(email=_check_email(db, body.email), password_hash=hash_password(body.password),
                full_name=body.name.strip(), phone=body.phone.strip(), role=body.role)
    db.add(user)
    db.flush()
    audit(db, user, "account_created", user.email, summary=f"{body.role} account")
    db.commit()
    request.session["user_id"] = user.id
    return session_payload(user)


@router.post("/logout")
def logout(request: Request):
    request.session.clear()
    return {"ok": True}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return session_payload(user)


@router.put("/me")
def update_profile(body: ProfileIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not body.name.strip():
        raise HTTPException(400, "Enter your full name.")
    user.email = _check_email(db, body.email, exclude_id=user.id)
    user.full_name = body.name.strip()
    user.phone = body.phone.strip()
    audit(db, user, "profile_updated", user.email)
    db.commit()
    return session_payload(user)


@router.post("/password")
def change_password(body: PasswordIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not verify_password(body.currentPassword, user.password_hash):
        raise HTTPException(400, "Your current password is not correct.")
    if len(body.newPassword) < 8:
        raise HTTPException(400, "Use a new password of at least 8 characters.")
    user.password_hash = hash_password(body.newPassword)
    audit(db, user, "password_changed", user.email)
    db.commit()
    return {"ok": True}
