"""Database tables (SRS xlvi). Shared file: ask Victor, Keagan or Cyrus before changing."""
from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.db import Base


def _now():
    return datetime.utcnow()


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(255), default="")
    phone: Mapped[str] = mapped_column(String(50), default="")
    # customer | service_center | reviewer | admin
    role: Mapped[str] = mapped_column(String(30), default="customer")
    failed_logins: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class Product(Base):
    __tablename__ = "products"
    id: Mapped[int] = mapped_column(primary_key=True)
    product_code: Mapped[str] = mapped_column(String(40), unique=True)  # the "Product ID" shown to users
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(100))
    brand: Mapped[str] = mapped_column(String(100))
    model_number: Mapped[str] = mapped_column(String(100))
    serial_number: Mapped[str] = mapped_column(String(100))
    purchase_date: Mapped[date] = mapped_column(Date)
    retailer: Mapped[str] = mapped_column(String(255), default="")
    purchase_price: Mapped[float] = mapped_column(Float, default=0.0)
    warranty_months: Mapped[int] = mapped_column(Integer)

    warranties: Mapped[list["Warranty"]] = relationship(back_populates="product")
    repairs: Mapped[list["RepairRecord"]] = relationship(order_by="RepairRecord.repair_date")
    owner: Mapped["User"] = relationship()


class Warranty(Base):
    __tablename__ = "warranties"
    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    kind: Mapped[str] = mapped_column(String(30), default="standard")  # standard | extended
    provider: Mapped[str] = mapped_column(String(255), default="")
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    coverage_conditions: Mapped[str] = mapped_column(Text, default="")
    exclusions: Mapped[str] = mapped_column(Text, default="")
    service_center: Mapped[str] = mapped_column(String(255), default="")  # name and contact

    product: Mapped[Product] = relationship(back_populates="warranties")


class Document(Base):
    __tablename__ = "documents"
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id"), nullable=True)
    claim_id: Mapped[int | None] = mapped_column(ForeignKey("claims.id"), nullable=True)
    # receipt | invoice | warranty_card | product_image | damage_image | fault_video
    # serial_photo | diagnostic_report | repair_report
    doc_type: Mapped[str] = mapped_column(String(40))
    file_path: Mapped[str] = mapped_column(String(500))
    original_name: Mapped[str] = mapped_column(String(255), default="")
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    sha256: Mapped[str] = mapped_column(String(64), index=True)  # duplicate-document check (xxxi)
    duplicate_of: Mapped[str] = mapped_column(String(40), default="")  # claim code that already used this file
    extracted: Mapped[dict] = mapped_column(JSON, default=dict)  # OCR output (vi)
    verified: Mapped[dict] = mapped_column(JSON, default=dict)   # user-corrected values (vii)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class Claim(Base):
    __tablename__ = "claims"
    id: Mapped[int] = mapped_column(primary_key=True)
    claim_code: Mapped[str] = mapped_column(String(40), unique=True)  # the "Claim ID" shown to users
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    invoice_number: Mapped[str] = mapped_column(String(100), default="")
    serial_number: Mapped[str] = mapped_column(String(100), default="")
    fault_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    fault_category: Mapped[str] = mapped_column(String(100), default="")
    fault_description: Mapped[str] = mapped_column(Text, default="")
    damage_type: Mapped[str] = mapped_column(String(30), default="none")  # none | physical | water | other
    previous_replacement: Mapped[bool] = mapped_column(default=False)
    replacement_details: Mapped[str] = mapped_column(Text, default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    # config.CLAIM_STATUSES: Draft, Submitted, Under Evaluation, Additional Information Required,
    # Manual Review, Approved, Rejected, Closed (SRS xxxviii)
    status: Mapped[str] = mapped_column(String(50), default="Draft")
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    final_decision: Mapped[str] = mapped_column(String(50), default="")  # Likely Valid | Likely Invalid | Manual Review Required
    # Result of the last evaluation, kept for filtering and for the claim page:
    consistency: Mapped[str] = mapped_column(String(40), default="")      # Strong Match ... Uncertain Result
    top_confidence: Mapped[float] = mapped_column(Float, default=0.0)     # Python model top-class confidence
    confidence_gap: Mapped[float] = mapped_column(Float, default=0.0)
    risk_level: Mapped[str] = mapped_column(String(10), default="")       # low | medium | high
    card_path: Mapped[str] = mapped_column(String(500), default="")
    decision_detail: Mapped[dict] = mapped_column(JSON, default=dict)     # explanation, factors, contradictions ...
    summary: Mapped[str] = mapped_column(Text, default="")                # AI-generated claim summary (xxxii)
    evaluated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reviewer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    predictions: Mapped[list["Prediction"]] = relationship(back_populates="claim", order_by="Prediction.id")
    rule_results: Mapped[list["RuleResult"]] = relationship(back_populates="claim")
    documents: Mapped[list["Document"]] = relationship(order_by="Document.id")
    product: Mapped[Product] = relationship()
    user: Mapped[User] = relationship(foreign_keys=[user_id])
    reviews: Mapped[list["ReviewAction"]] = relationship(order_by="ReviewAction.id")


class RepairRecord(Base):
    __tablename__ = "repair_records"
    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    repair_date: Mapped[date] = mapped_column(Date)
    service_center: Mapped[str] = mapped_column(String(255), default="")
    authorized_center: Mapped[bool] = mapped_column(default=True)
    fault: Mapped[str] = mapped_column(String(255), default="")
    parts_replaced: Mapped[str] = mapped_column(String(255), default="")
    outcome: Mapped[str] = mapped_column(String(100), default="")
    cost: Mapped[float] = mapped_column(Float, default=0.0)
    product_replaced: Mapped[bool] = mapped_column(default=False)


class ModelVersion(Base):
    """Every prediction points at the exact model that made it (xlviii)."""
    __tablename__ = "model_versions"
    id: Mapped[int] = mapped_column(primary_key=True)
    model_name: Mapped[str] = mapped_column(String(50))  # python | teachable
    version: Mapped[str] = mapped_column(String(50))
    file_path: Mapped[str] = mapped_column(String(500))
    metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class Prediction(Base):
    __tablename__ = "predictions"
    id: Mapped[int] = mapped_column(primary_key=True)
    claim_id: Mapped[int] = mapped_column(ForeignKey("claims.id"))
    model_version_id: Mapped[int] = mapped_column(ForeignKey("model_versions.id"))
    label: Mapped[str] = mapped_column(String(50))
    probabilities: Mapped[dict] = mapped_column(JSON)  # {"Valid Claim": 0.8, ...}
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    model_version: Mapped["ModelVersion"] = relationship()

    claim: Mapped[Claim] = relationship(back_populates="predictions")


class RuleResult(Base):
    __tablename__ = "rule_results"
    id: Mapped[int] = mapped_column(primary_key=True)
    claim_id: Mapped[int] = mapped_column(ForeignKey("claims.id"))
    rule: Mapped[str] = mapped_column(String(100))
    passed: Mapped[bool]
    severity: Mapped[str] = mapped_column(String(20), default="info")  # info | warning | blocking
    message: Mapped[str] = mapped_column(Text, default="")

    claim: Mapped[Claim] = relationship(back_populates="rule_results")


class ReviewAction(Base):
    __tablename__ = "review_actions"
    id: Mapped[int] = mapped_column(primary_key=True)
    claim_id: Mapped[int] = mapped_column(ForeignKey("claims.id"))
    reviewer_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(50))  # comment | request_info | approve | reject | override
    comment: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    reviewer: Mapped[User] = relationship()


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(120), default="")
    message: Mapped[str] = mapped_column(Text)
    claim_code: Mapped[str] = mapped_column(String(40), default="")
    read: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class Alert(Base):
    """Admin-facing monitoring alerts (l)."""
    __tablename__ = "alerts"
    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(50))  # failed_upload | repeated_login | duplicate_document | model_failure ...
    detail: Mapped[str] = mapped_column(Text, default="")
    resolved: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(100))
    target: Mapped[str] = mapped_column(String(100), default="")
    detail: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
