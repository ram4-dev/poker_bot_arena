"""v3 schema: Bot→Agent migration, timeout tracking, 3-street holdem

Revision ID: a1b2c3d4e5f6
Revises: 74a8b70cf1d3
Create Date: 2026-04-01 22:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "74a8b70cf1d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Create agents table first ---
    op.create_table(
        "agents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("status", sa.String(20), server_default="idle"),
        sa.Column("elo", sa.Integer, server_default="1000"),
        sa.Column("total_wins", sa.Integer, server_default="0"),
        sa.Column("total_losses", sa.Integer, server_default="0"),
        sa.Column("total_hands", sa.Integer, server_default="0"),
        sa.Column("consecutive_timeouts", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    # --- Alter sessions BEFORE dropping bots (avoids FK reflection error) ---
    # SQLite doesn't support DROP COLUMN, so we use batch mode
    with op.batch_alter_table("sessions", recreate="always") as batch_op:
        batch_op.drop_column("bot_id")
        batch_op.drop_column("bot_version_id")
        batch_op.add_column(sa.Column("agent_id", sa.String(36), sa.ForeignKey("agents.id"), nullable=True))
        batch_op.add_column(sa.Column("timeout_count", sa.Integer, server_default="0"))
        batch_op.create_index("ix_sessions_agent_id", ["agent_id"])

    # --- Now safe to drop old bot tables (no more FKs pointing to them) ---
    op.drop_table("bot_versions")
    op.drop_table("bots")

    # --- Alter tables: add timeout tracking fields ---
    with op.batch_alter_table("tables") as batch_op:
        batch_op.add_column(sa.Column("current_hand_id", sa.String(36), nullable=True))
        batch_op.add_column(sa.Column("dealer_seat", sa.Integer, server_default="1"))
        batch_op.add_column(sa.Column("pending_action_agent_id", sa.String(36), nullable=True))
        batch_op.add_column(sa.Column("action_deadline", sa.DateTime, nullable=True))

    # --- Alter hands: add phase, current_bet, pot_main ---
    with op.batch_alter_table("hands") as batch_op:
        batch_op.add_column(sa.Column("phase", sa.String(20), server_default="preflop"))
        batch_op.add_column(sa.Column("current_bet", sa.Integer, server_default="0"))
        batch_op.add_column(sa.Column("pot_main", sa.Integer, server_default="0"))


def downgrade() -> None:
    # --- Revert hands ---
    with op.batch_alter_table("hands") as batch_op:
        batch_op.drop_column("pot_main")
        batch_op.drop_column("current_bet")
        batch_op.drop_column("phase")

    # --- Revert tables ---
    with op.batch_alter_table("tables") as batch_op:
        batch_op.drop_column("action_deadline")
        batch_op.drop_column("pending_action_agent_id")
        batch_op.drop_column("dealer_seat")
        batch_op.drop_column("current_hand_id")

    # --- Revert sessions ---
    with op.batch_alter_table("sessions") as batch_op:
        batch_op.drop_index("ix_sessions_agent_id")
        batch_op.drop_column("timeout_count")
        batch_op.drop_column("agent_id")
        batch_op.add_column(sa.Column("bot_id", sa.String(36), nullable=True))
        batch_op.add_column(sa.Column("bot_version_id", sa.String(36), nullable=True))

    # --- Drop agents, recreate bots ---
    op.drop_table("agents")

    op.create_table(
        "bots",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("avatar", sa.String(50), server_default="bot_default"),
        sa.Column("status", sa.String(20), server_default="idle"),
        sa.Column("elo", sa.Integer, server_default="1000"),
        sa.Column("total_wins", sa.Integer, server_default="0"),
        sa.Column("total_losses", sa.Integer, server_default="0"),
        sa.Column("total_hands", sa.Integer, server_default="0"),
        sa.Column("active_version_id", sa.String(36), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "bot_versions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("bot_id", sa.String(36), sa.ForeignKey("bots.id"), nullable=False),
        sa.Column("version_number", sa.Integer, nullable=False),
        sa.Column("config_json", sa.JSON, nullable=False),
        sa.Column("preset_origin", sa.String(20), nullable=True),
        sa.Column("wins", sa.Integer, server_default="0"),
        sa.Column("losses", sa.Integer, server_default="0"),
        sa.Column("hands_played", sa.Integer, server_default="0"),
        sa.Column("total_profit", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
