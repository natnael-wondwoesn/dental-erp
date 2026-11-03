"""Deployment history and internal tenant notes for the control plane."""
import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "saas_deployments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("client", sa.String(63), nullable=False),
        sa.Column("version", sa.String(64), nullable=False),
        sa.Column("previous_version", sa.String(128)),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("detail", sa.Text()),
        sa.Column("run_url", sa.String(500)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_saas_deployments_client", "saas_deployments", ["client"])
    op.create_table(
        "saas_tenant_notes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.String(64),
            sa.ForeignKey("saas_tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("author", sa.String(128), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_saas_tenant_notes_tenant_id", "saas_tenant_notes", ["tenant_id"])


def downgrade():
    op.drop_table("saas_tenant_notes")
    op.drop_table("saas_deployments")
