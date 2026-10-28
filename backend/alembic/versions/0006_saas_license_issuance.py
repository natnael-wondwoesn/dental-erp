"""Durable offline license binding, sequence and replay audit."""

import sqlalchemy as sa

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "saas_license_issuances",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.String(64),
            sa.ForeignKey("saas_tenants.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("installation_id", sa.String(128), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("request_id", sa.String(128), nullable=False, unique=True),
        sa.Column("nonce", sa.String(128), nullable=False, unique=True),
        sa.Column("fingerprint", sa.String(64), nullable=False),
        sa.Column("document", sa.Text(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("installation_id", "sequence"),
    )
    op.create_index("ix_saas_license_issuances_tenant_id", "saas_license_issuances", ["tenant_id"])
    op.create_index(
        "ix_saas_license_issuances_installation_id", "saas_license_issuances", ["installation_id"]
    )


def downgrade():
    op.drop_table("saas_license_issuances")
