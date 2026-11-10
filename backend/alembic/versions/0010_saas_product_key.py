"""Add product_key to saas_tenants so the commercial plane is multi-product.

Additive and backward-compatible: existing rows backfill to "dental-erp" via the
server default, so dental tenants are unchanged during a mixed-version rollout.
"""
import sqlalchemy as sa
from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "saas_tenants",
        sa.Column(
            "product_key",
            sa.String(length=32),
            nullable=False,
            server_default="dental-erp",
        ),
    )


def downgrade():
    op.drop_column("saas_tenants", "product_key")
