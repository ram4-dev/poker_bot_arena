from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

# Render (and some providers) give postgres:// — normalize to postgresql+asyncpg://
def _normalize_db_url(url: str) -> str:
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://") and "+asyncpg" not in url:
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url

_db_url = _normalize_db_url(settings.DATABASE_URL)
_is_sqlite = _db_url.startswith("sqlite")
engine = create_async_engine(
    _db_url,
    echo=False,
    **({} if _is_sqlite else {"pool_pre_ping": True, "pool_size": 5, "max_overflow": 10}),
)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session
