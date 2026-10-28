from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class SaaSTenant(Base):
    __tablename__ = "saas_tenants"

    # Also accepts migration-era CUID clinic IDs. Never cast these to UUID.
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(180))
    slug: Mapped[str] = mapped_column(String(63), unique=True)
    hostname: Mapped[str | None] = mapped_column(String(253), unique=True)
    customer_id: Mapped[str] = mapped_column(String(128))
    mode: Mapped[str] = mapped_column(String(16), default="hosted")
    plan_name: Mapped[str] = mapped_column(String(100), default="Custom")
    branding: Mapped[dict] = mapped_column(JSON, default=dict)
    modules: Mapped[list] = mapped_column(JSON, default=list)
    client_options: Mapped[dict] = mapped_column(JSON, default=dict, server_default="{}")
    status: Mapped[str] = mapped_column(String(16), default="active")
    resume_status: Mapped[str] = mapped_column(String(16), default="active")
    access_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    grace_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    scheduled_modules: Mapped[list | None] = mapped_column(JSON)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    suspension_reason: Mapped[str | None] = mapped_column(Text)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    anchor_day: Mapped[int] = mapped_column(Integer, default=1)
    monthly_fee: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    currency: Mapped[str] = mapped_column(String(3), default="ETB")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SaaSPayment(Base):
    __tablename__ = "saas_payments"
    __table_args__ = (UniqueConstraint("tenant_id", "reference"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("saas_tenants.id", ondelete="RESTRICT"), index=True
    )
    reference: Mapped[str] = mapped_column(String(120))
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    currency: Mapped[str] = mapped_column(String(3))
    months: Mapped[int] = mapped_column(Integer)
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    verified_by: Mapped[str] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SaaSAuditEvent(Base):
    __tablename__ = "saas_audit_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("saas_tenants.id", ondelete="RESTRICT"), index=True
    )
    actor: Mapped[str] = mapped_column(String(128))
    action: Mapped[str] = mapped_column(String(60))
    details: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SaaSLicenseIssuance(Base):
    __tablename__ = "saas_license_issuances"
    __table_args__ = (UniqueConstraint("installation_id", "sequence"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("saas_tenants.id", ondelete="RESTRICT"), index=True
    )
    installation_id: Mapped[str] = mapped_column(String(128), index=True)
    sequence: Mapped[int] = mapped_column(Integer)
    request_id: Mapped[str] = mapped_column(String(128), unique=True)
    nonce: Mapped[str] = mapped_column(String(128), unique=True)
    fingerprint: Mapped[str] = mapped_column(String(64))
    document: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
