from datetime import datetime
from uuid import uuid4

from sqlalchemy import String, Integer, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def uuid4_str() -> str:
    return str(uuid4())


class Table(Base):
    __tablename__ = "tables"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    arena_id: Mapped[str] = mapped_column(ForeignKey("arenas.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), default="active")
    # "active" | "completed"
    seat_1_session_id: Mapped[str | None] = mapped_column(ForeignKey("sessions.id"), nullable=True)
    seat_2_session_id: Mapped[str | None] = mapped_column(ForeignKey("sessions.id"), nullable=True)
    hands_played: Mapped[int] = mapped_column(Integer, default=0)
    current_hand_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    dealer_seat: Mapped[int] = mapped_column(Integer, default=1)
    # 1 = seat_1 is dealer/SB, 2 = seat_2 is dealer/SB
    pending_action_agent_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    action_deadline: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    arena: Mapped["Arena"] = relationship()  # noqa: F821
    seat_1_session: Mapped["Session | None"] = relationship(foreign_keys=[seat_1_session_id])  # noqa: F821
    seat_2_session: Mapped["Session | None"] = relationship(foreign_keys=[seat_2_session_id])  # noqa: F821
