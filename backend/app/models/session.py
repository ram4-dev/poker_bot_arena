from datetime import datetime
from uuid import uuid4

from sqlalchemy import String, Integer, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def uuid4_str() -> str:
    return str(uuid4())


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    agent_id: Mapped[str] = mapped_column(ForeignKey("agents.id"), nullable=False, index=True)
    arena_id: Mapped[str] = mapped_column(ForeignKey("arenas.id"), nullable=False, index=True)
    table_id: Mapped[str | None] = mapped_column(ForeignKey("tables.id"), nullable=True)
    opponent_session_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="queued")
    # "queued" | "playing" | "completed" | "cancelled"
    buy_in: Mapped[int] = mapped_column(Integer, nullable=False)
    initial_stack: Mapped[int] = mapped_column(Integer, nullable=False)
    final_stack: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hands_played: Mapped[int] = mapped_column(Integer, default=0)
    hands_won: Mapped[int] = mapped_column(Integer, default=0)
    timeout_count: Mapped[int] = mapped_column(Integer, default=0)
    exit_reason: Mapped[str | None] = mapped_column(String(30), nullable=True)
    # "stack_zero" | "agent_leave" | "timeout_exceeded" | "opponent_exit"
    elo_before: Mapped[int | None] = mapped_column(Integer, nullable=True)
    elo_after: Mapped[int | None] = mapped_column(Integer, nullable=True)
    queued_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship()  # noqa: F821
    agent: Mapped["Agent"] = relationship(back_populates="sessions")  # noqa: F821
    arena: Mapped["Arena"] = relationship()  # noqa: F821
    hands: Mapped[list["Hand"]] = relationship(  # noqa: F821
        back_populates="session", foreign_keys="Hand.session_1_id"
    )
