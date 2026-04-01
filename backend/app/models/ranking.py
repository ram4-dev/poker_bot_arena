from datetime import datetime
from uuid import uuid4

from sqlalchemy import String, Integer, Float, DateTime, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def uuid4_str() -> str:
    return str(uuid4())


class SeasonRanking(Base):
    __tablename__ = "season_rankings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    season: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(10), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    elo: Mapped[int] = mapped_column(Integer, nullable=False)
    wins: Mapped[int] = mapped_column(Integer, default=0)
    losses: Mapped[int] = mapped_column(Integer, default=0)
    winrate: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("season", "entity_type", "entity_id", name="uq_season_entity"),
    )
