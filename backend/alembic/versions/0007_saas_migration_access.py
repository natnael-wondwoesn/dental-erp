"""Preserve explicitly grandfathered access across manual suspension."""

import sqlalchemy as sa

from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "saas_tenants",
        sa.Column("resume_status", sa.String(16), nullable=False, server_default="active"),
    )


def downgrade():
    op.drop_column("saas_tenants", "resume_status")
