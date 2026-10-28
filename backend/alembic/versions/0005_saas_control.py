"""Vendor-owned tenant subscriptions and payment audit.

Revision ID: 0005
Revises: bfec8e166498
"""

import sqlalchemy as sa

from alembic import op

revision = "0005"
down_revision = "bfec8e166498"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "saas_tenants",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("name", sa.String(180), nullable=False),
        sa.Column("slug", sa.String(63), nullable=False, unique=True),
        sa.Column("hostname", sa.String(253), unique=True),
        sa.Column("customer_id", sa.String(128), nullable=False),
        sa.Column("mode", sa.String(16), nullable=False),
        sa.Column("plan_name", sa.String(100), nullable=False),
        sa.Column("branding", sa.JSON(), nullable=False),
        sa.Column("modules", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("access_until", sa.DateTime(timezone=True)),
        sa.Column("grace_until", sa.DateTime(timezone=True)),
        sa.Column("scheduled_modules", sa.JSON()),
        sa.Column("scheduled_at", sa.DateTime(timezone=True)),
        sa.Column("suspension_reason", sa.Text()),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("anchor_day", sa.Integer(), nullable=False),
        sa.Column("monthly_fee", sa.Numeric(14, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_table(
        "saas_payments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.String(64),
            sa.ForeignKey("saas_tenants.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("reference", sa.String(120), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("months", sa.Integer(), nullable=False),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("verified_by", sa.String(128), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.UniqueConstraint("tenant_id", "reference"),
    )
    op.create_index("ix_saas_payments_tenant_id", "saas_payments", ["tenant_id"])
    op.create_table(
        "saas_audit_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.String(64),
            sa.ForeignKey("saas_tenants.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("actor", sa.String(128), nullable=False),
        sa.Column("action", sa.String(60), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("ix_saas_audit_events_tenant_id", "saas_audit_events", ["tenant_id"])


def downgrade():
    op.drop_table("saas_audit_events")
    op.drop_table("saas_payments")
    op.drop_table("saas_tenants")
