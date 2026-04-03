import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.table import Table
from app.models.session import Session as GameSession
from app.services import matchmaker, table_manager, session_manager, elo_service
from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()


async def scheduler_tick(session: AsyncSession) -> dict:
    """Main scheduler loop. 5-step tick: match, timeouts, next hands, settle, cleanup."""
    stats = {"matched": 0, "timeouts": 0, "hands_started": 0, "settled": 0, "cleaned": 0, "failed_settlements": 0}

    # 1. MATCH QUEUE
    stats["matched"] = await matchmaker.process_queue(session)

    # 2. DETECT TIMEOUTS
    stats["timeouts"] = await _process_timeouts(session)

    # 3. START NEXT HANDS (tables where hand completed but both agents still active)
    stats["hands_started"] = await _start_pending_hands(session)

    # 4. SETTLE completed sessions
    settled, failed = await _settle_completed_sessions(session)
    stats["settled"] = settled
    stats["failed_settlements"] = failed

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
            hand_id = await table_manager.start_new_hand(db, table.id)
            if hand_id:
                count += 1
            else:
                # start_new_hand returned None — likely a player has stack <= 0.
                # Close both sessions and mark the table completed.
                await _complete_finished_table(db, table)

    return count


async def _complete_finished_table(db: AsyncSession, table: Table) -> None:
    """Close a table where no new hand can start (e.g. stack_zero). Idempotent."""
    sess1 = (await db.execute(
        select(GameSession).where(GameSession.id == table.seat_1_session_id)
    )).scalar_one_or_none()
    sess2 = (await db.execute(
        select(GameSession).where(GameSession.id == table.seat_2_session_id)
    )).scalar_one_or_none()

    for gs in [sess1, sess2]:
        if gs and gs.status != "completed":
            final = gs.final_stack if gs.final_stack is not None else gs.initial_stack
            try:
                await session_manager.close_session(db, gs.id, "stack_zero", final)
            except Exception as e:
                logger.exception(
                    "Failed closing session during stack_zero",
                    extra={"session_id": str(gs.id), "table_id": str(table.id)},
                )

    table.status = "completed"
    table.completed_at = datetime.now(timezone.utc)
    await db.commit()
    logger.info(f"Table {table.id} closed (stack_zero) by scheduler.")


async def _settle_completed_sessions(db: AsyncSession) -> tuple[int, int]:
    """Apply ELO to completed sessions that were closed without it (recovery path).

    This handles cases where close_session completed but ELO was skipped
    (e.g. opponent session not yet closed). Calls elo_service directly
    since close_session returns early for already-completed sessions.

    Returns (settled_count, failed_count).
    """
    sessions = (await db.execute(
        select(GameSession).where(
            GameSession.status == "completed",
            GameSession.final_stack.isnot(None),
            GameSession.elo_after.is_(None),
            GameSession.hands_played > 0,
            GameSession.opponent_session_id.isnot(None),
        )
    )).scalars().all()

    count = 0
    failed = 0
    for gs in sessions:
        opp = (await db.execute(
            select(GameSession).where(GameSession.id == gs.opponent_session_id)
        )).scalar_one_or_none()
        if not opp:
            continue
        # Only update if both sides are complete and opponent also has final_stack
        if opp.final_stack is None:
            continue
        try:
            await elo_service.update_elo(db, gs, opp)
            await db.commit()
            count += 1
        except Exception as e:
            await db.rollback()
            failed += 1
            logger.warning(
                "ELO recovery failed",
                extra={"session_id": str(gs.id), "error": str(e)},
            )

    return count, failed


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
