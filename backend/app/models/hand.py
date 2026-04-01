from datetime import datetime
from uuid import uuid4

from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def uuid4_str() -> str:
    return str(uuid4())


class Hand(Base):
    __tablename__ = "hands"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    table_id: Mapped[str] = mapped_column(ForeignKey("tables.id"), nullable=False, index=True)
    session_1_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"), nullable=False)
    session_2_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"), nullable=False)
    hand_number: Mapped[int] = mapped_column(Integer, nullable=False)
    winner_session_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    pot: Mapped[int] = mapped_column(Integer, nullable=False)
    community_cards: Mapped[str | None] = mapped_column(String(100), nullable=True)
    player_1_hole: Mapped[str | None] = mapped_column(String(20), nullable=True)
    player_2_hole: Mapped[str | None] = mapped_column(String(20), nullable=True)
    player_1_stack_after: Mapped[int] = mapped_column(Integer, nullable=False)
    player_2_stack_after: Mapped[int] = mapped_column(Integer, nullable=False)
    winning_hand_rank: Mapped[str | None] = mapped_column(String(30), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    session: Mapped["Session"] = relationship(  # noqa: F821
        back_populates="hands", foreign_keys=[session_1_id]
    )
    events: Mapped[list["HandEvent"]] = relationship(back_populates="hand")


class HandEvent(Base):
    __tablename__ = "hand_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    hand_id: Mapped[str] = mapped_column(ForeignKey("hands.id"), nullable=False, index=True)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    street: Mapped[str] = mapped_column(String(10), nullable=False)
    player_seat: Mapped[int] = mapped_column(Integer, nullable=False)
    action: Mapped[str] = mapped_column(String(10), nullable=False)
    amount: Mapped[int] = mapped_column(Integer, default=0)
    pot_after: Mapped[int] = mapped_column(Integer, nullable=False)
    hand_strength: Mapped[float | None] = mapped_column(Float, nullable=True)
    hole_cards: Mapped[str | None] = mapped_column(String(20), nullable=True)  # JSON "SA,HK"

    hand: Mapped["Hand"] = relationship(back_populates="events")
