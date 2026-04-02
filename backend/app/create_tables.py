"""Create all tables directly from SQLAlchemy metadata (used instead of alembic for ephemeral SQLite)."""
import asyncio

from app.database import engine, Base

# Import all models so they register with Base.metadata
from app.models import user, agent, arena, table, session, hand, ledger, ranking  # noqa: F401


async def main() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Tables created.")


if __name__ == "__main__":
    asyncio.run(main())
