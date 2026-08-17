"""Operational dashboard source transactions.

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-14
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    for table_name, columns, uniques, indexes in [
        (
            "appointments",
            [
                sa.Column("patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False),
                sa.Column("appointment_number", sa.String(32), nullable=False),
                sa.Column("dentist_name", sa.String(180), nullable=False),
                sa.Column("appointment_type", sa.String(120), nullable=False),
                sa.Column("scheduled_start", sa.DateTime(timezone=True), nullable=False),
                sa.Column("duration_minutes", sa.Integer(), nullable=False),
                sa.Column("status", sa.String(30), nullable=False),
                sa.Column("chair_label", sa.String(60)),
                sa.Column("notes", sa.Text()),
                sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            ],
            [("hospital_id", "appointment_number")],
            [("hospital_id", "scheduled_start"), ("patient_id",), ("status",)],
        ),
        (
            "invoices",
            [
                sa.Column("patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False),
                sa.Column("invoice_number", sa.String(32), nullable=False),
                sa.Column("total_amount", sa.Numeric(14, 2), nullable=False),
                sa.Column("balance_due", sa.Numeric(14, 2), nullable=False),
                sa.Column("status", sa.String(30), nullable=False),
                sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
                sa.Column("due_at", sa.DateTime(timezone=True)),
            ],
            [("hospital_id", "invoice_number")],
            [("hospital_id", "issued_at"), ("patient_id",), ("status",)],
        ),
        (
            "payments",
            [
                sa.Column("patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False),
                sa.Column("invoice_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("invoices.id", ondelete="RESTRICT")),
                sa.Column("receipt_number", sa.String(32), nullable=False),
                sa.Column("amount", sa.Numeric(14, 2), nullable=False),
                sa.Column("method", sa.String(30), nullable=False),
                sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
            ],
            [("hospital_id", "receipt_number")],
            [("hospital_id", "received_at"), ("patient_id",), ("invoice_id",)],
        ),
        (
            "lab_orders",
            [
                sa.Column("patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False),
                sa.Column("order_number", sa.String(32), nullable=False),
                sa.Column("appliance_type", sa.String(120), nullable=False),
                sa.Column("vendor_name", sa.String(180), nullable=False),
                sa.Column("status", sa.String(30), nullable=False),
                sa.Column("due_date", sa.Date()),
                sa.Column("cost", sa.Numeric(14, 2), nullable=False),
            ],
            [("hospital_id", "order_number")],
            [("hospital_id", "due_date"), ("patient_id",), ("status",)],
        ),
        (
            "expenses",
            [
                sa.Column("category", sa.String(100), nullable=False),
                sa.Column("description", sa.String(255), nullable=False),
                sa.Column("amount", sa.Numeric(14, 2), nullable=False),
                sa.Column("incurred_at", sa.DateTime(timezone=True), nullable=False),
            ],
            [],
            [("hospital_id", "incurred_at")],
        ),
    ]:
        op.create_table(
            table_name,
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("hospital_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False),
            *columns,
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            *(sa.UniqueConstraint(*columns_) for columns_ in uniques),
        )
        op.create_index(f"ix_{table_name}_hospital_id", table_name, ["hospital_id"])
        for index, columns_ in enumerate(indexes):
            suffix = "_".join(columns_)
            op.create_index(f"ix_{table_name}_{suffix}_{index}", table_name, list(columns_))


def downgrade() -> None:
    for table_name in ["expenses", "lab_orders", "payments", "invoices", "appointments"]:
        op.drop_table(table_name)
