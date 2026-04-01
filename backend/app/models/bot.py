from datetime import datetime
from uuid import uuid4

from sqlalchemy import String, Integer, DateTime, JSON, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def uuid4_str() -> str:
    return str(uuid4())


class Bot(Base):
    __tablename__ = "bots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    avatar: Mapped[str] = mapped_column(String(50), default="bot_default")
    status: Mapped[str] = mapped_column(String(20), default="idle")
    elo: Mapped[int] = mapped_column(Integer, default=1000)
    total_wins: Mapped[int] = mapped_column(Integer, default=0)
    total_losses: Mapped[int] = mapped_column(Integer, default=0)
    total_hands: Mapped[int] = mapped_column(Integer, default=0)
    active_version_id: Mapped[str | None] = mapped_column(ForeignKey("bot_versions.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    owner: Mapped["User"] = relationship(back_populates="bots")  # noqa: F821
    versions: Mapped[list["BotVersion"]] = relationship(
        back_populates="bot", foreign_keys="BotVersion.bot_id", order_by="BotVersion.version_number.desc()"
    )
    active_version: Mapped["BotVersion | None"] = relationship(foreign_keys=[active_version_id])


class BotVersion(Base):
    __tablename__ = "bot_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    bot_id: Mapped[str] = mapped_column(ForeignKey("bots.id"), nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    config_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    preset_origin: Mapped[str | None] = mapped_column(String(20), nullable=True)
    wins: Mapped[int] = mapped_column(Integer, default=0)
    losses: Mapped[int] = mapped_column(Integer, default=0)
    hands_played: Mapped[int] = mapped_column(Integer, default=0)
    total_profit: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    bot: Mapped["Bot"] = relationship(back_populates="versions", foreign_keys=[bot_id])

    __table_args__ = (
        UniqueConstraint("bot_id", "version_number", name="uq_bot_version"),
    )
