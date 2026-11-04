"""Add Feishu group delivery targets to schedules and triggers.

Revision ID: f065_feishu_group_target
Revises: f064_tool_call_tenants
Create Date: 2026-08-18 16:00:00
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "f065_feishu_group_target"
down_revision: str | Sequence[str] | None = "f064_tool_call_tenants"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _columns(table_name: str) -> set[str]:
    """The columns a table has now."""
    inspector = sa.inspect(op.get_bind())
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    # The initial schema revision creates every table from the current models,
    # so on a fresh database the column is already there. Adding it again
    # would fail, so the revision is idempotent.
    if "delivery_target_id" not in _columns("agent_schedules"):
        op.add_column(
            "agent_schedules",
            sa.Column("delivery_target_id", postgresql.UUID(as_uuid=True), nullable=True),
        )
    if "delivery_target_id" not in _columns("agent_triggers"):
        op.add_column(
            "agent_triggers",
            sa.Column("delivery_target_id", postgresql.UUID(as_uuid=True), nullable=True),
        )


def downgrade() -> None:
    if "delivery_target_id" in _columns("agent_triggers"):
        op.drop_column("agent_triggers", "delivery_target_id")
    if "delivery_target_id" in _columns("agent_schedules"):
        op.drop_column("agent_schedules", "delivery_target_id")
