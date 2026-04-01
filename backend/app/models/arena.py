from datetime import datetime
from uuid import uuid4

from sqlalchemy import String, Integer, Float, Boolean, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def uuid4_str() -> str:
    return str(uuid4())


class Arena(Base):
    __tablename__ = "arenas"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    buy_in: Mapped[int] = mapped_column(Integer, nullable=False)
    small_blind: Mapped[int] = mapped_column(Integer, nullable=False)
    big_blind: Mapped[int] = mapped_column(Integer, nullable=False)
    reward_multiplier: Mapped[float] = mapped_column(Float, default=1.0)
    is_practice: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
