from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.table import Table
from app.services import matchmaker, session_manager

settings = get_settings()


async def scheduler_tick(session: AsyncSession) -> dict:
    """Main scheduler loop. Idempotent."""
    # Step 1: Match bots in queue
    matched = await matchmaker.process_queue(session)

    # Step 2: Execute hands on active tables
    active_tables = (await session.execute(
        select(Table).where(Table.status == "active")
    )).scalars().all()

    total_hands = 0
    sessions_completed = 0

    for table in active_tables:
        hands = await session_manager.execute_hands(session, table, settings.HANDS_PER_TICK)
        total_hands += hands

    # Step 3: Count completed sessions this tick
    # (session_manager handles closing internally)

    return {
        "matched": matched,
        "hands_executed": total_hands,
        "active_tables": len(active_tables),
    }
