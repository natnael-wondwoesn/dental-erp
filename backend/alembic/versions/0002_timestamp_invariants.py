"""Make audit and entity timestamps required.

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-13
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    for table_name, columns in {
        "hospitals": ("created_at", "updated_at"),
        "users": ("created_at", "updated_at"),
        "patients": ("created_at", "updated_at"),
        "audit_logs": ("created_at",),
    }.items():
        for column_name in columns:
            op.alter_column(
                table_name,
                column_name,
                existing_type=sa.DateTime(timezone=True),
                nullable=False,
            )


def downgrade() -> None:
    for table_name, columns in {
        "hospitals": ("created_at", "updated_at"),
        "users": ("created_at", "updated_at"),
        "patients": ("created_at", "updated_at"),
        "audit_logs": ("created_at",),
    }.items():
        for column_name in columns:
            op.alter_column(
                table_name,
                column_name,
                existing_type=sa.DateTime(timezone=True),
                nullable=True,
            )
