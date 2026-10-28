"""Owner-granted clinic recovery, backup and license-import permissions."""
import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("saas_tenants", sa.Column("client_options", sa.JSON(), nullable=False, server_default="{}"))

def downgrade():
    op.drop_column("saas_tenants", "client_options")
