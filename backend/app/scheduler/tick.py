from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.table import Table
from app.models.session import Session as GameSession
from app.services import matchmaker, table_manager, session_manager
from app.config import get_settings

settings = get_settings()


async def scheduler_tick(session: AsyncSession) -> dict:
    """Main scheduler loop. 5-step tick: match, timeouts, next hands, settle, cleanup."""
    stats = {"matched": 0, "timeouts": 0, "hands_started": 0, "settled": 0, "cleaned": 0}

    # 1. MATCH QUEUE
    stats["matched"] = await matchmaker.process_queue(session)

    # 2. DETECT TIMEOUTS
    stats["timeouts"] = await _process_timeouts(session)

    # 3. START NEXT HANDS (tables where hand completed but both agents still active)
    stats["hands_started"] = await _start_pending_hands(session)

    # 4. SETTLE completed sessions
    stats["settled"] = await _settle_completed_sessions(session)

    # 5. CLEANUP empty tables
    stats["cleaned"] = await _cleanup_empty_tables(session)

    return stats


async def _process_timeouts(db: AsyncSession) -> int:
    """Detect and handle tables where action deadline has passed."""
    now = datetime.now(timezone.utc)
    tables = (await db.execute(
        select(Table).where(
            Table.action_deadline.isnot(None),
            Table.action_deadline < now,
            Table.status == "active",
        )
    )).scalars().all()

    count = 0
    for table in tables:
        if table.pending_action_agent_id:
            await table_manager.handle_timeout(db, table.id, table.pending_action_agent_id)
            count += 1

    return count


async def _start_pending_hands(db: AsyncSession) -> int:
    """Start new hands on active tables that have no current hand but both seats occupied."""
    tables = (await db.execute(
        select(Table).where(
            Table.status == "active",
            Table.current_hand_id.is_(None),
        )
    )).scalars().all()

    count = 0
    for table in tables:
        if table.seat_1_session_id and table.seat_2_session_id:
            await table_manager.start_new_hand(db, table.id)
            count += 1

    return count


async def _settle_completed_sessions(db: AsyncSession) -> int:
    """Settle completed sessions that haven't had ELO calculated yet."""
    sessions = (await db.execute(
        select(GameSession).where(
            GameSession.status == "completed",
            GameSession.final_stack.isnot(None),
            GameSession.elo_after.is_(None),
        )
    )).scalars().all()

    count = 0
    for gs in sessions:
        try:
            await session_manager.close_session(db, gs.id, gs.exit_reason or "normal", gs.final_stack)
            count += 1
        except Exception:
            pass  # Already settled or error

    return count


async def _cleanup_empty_tables(db: AsyncSession) -> int:
    """Mark tables with no seated players as completed."""
    tables = (await db.execute(
        select(Table).where(
            Table.status == "active",
            Table.seat_1_session_id.is_(None),
            Table.seat_2_session_id.is_(None),
        )
    )).scalars().all()

    count = 0
    for table in tables:
        table.status = "completed"
        table.completed_at = datetime.now(timezone.utc)
        count += 1

    if count > 0:
        await db.commit()

    return count
