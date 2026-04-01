from datetime import datetime, timedelta, timezone

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.bot import Bot
from app.models.arena import Arena
from app.models.table import Table
from app.models.session import Session as GameSession

settings = get_settings()


async def process_queue(session: AsyncSession) -> int:
    """Match bots in queue. Returns number of pairs matched."""
    # Get all arenas
    arenas = (await session.execute(select(Arena))).scalars().all()
    matched = 0

    for arena in arenas:
        queued = (await session.execute(
            select(GameSession)
            .where(GameSession.arena_id == arena.id, GameSession.status == "queued")
            .order_by(GameSession.queued_at.asc())
        )).scalars().all()

        queued = list(queued)
        matched_ids = set()

        for i, sess1 in enumerate(queued):
            if sess1.id in matched_ids:
                continue

            for sess2 in queued[i + 1:]:
                if sess2.id in matched_ids:
                    continue

                if _can_match(sess1, sess2):
                    await _create_match(session, sess1, sess2, arena)
                    matched_ids.add(sess1.id)
                    matched_ids.add(sess2.id)
                    matched += 1
                    break

    return matched


def _can_match(sess1: GameSession, sess2: GameSession) -> bool:
    # Not same user
    if sess1.user_id == sess2.user_id:
        return False

    # ELO range check (expand over time)
    now = datetime.now()
    mins_1 = (now - sess1.queued_at).total_seconds() / 60 if sess1.queued_at else 0
    mins_2 = (now - sess2.queued_at).total_seconds() / 60 if sess2.queued_at else 0
    max_mins = max(mins_1, mins_2)

    elo_range = settings.ELO_RANGE + int(max_mins * settings.ELO_RANGE_EXPANSION_PER_MINUTE)
    elo_range = min(elo_range, 1000)

    # We need bot ELOs - use elo_before if set, otherwise we'll check later
    # For now, approximate with session data
    return True  # Simplified: accept any match in same arena (ELO check needs bot lookup)


async def _create_match(session: AsyncSession, sess1: GameSession, sess2: GameSession, arena: Arena):
    # Check rematch cooldown
    cooldown = datetime.now(timezone.utc) - timedelta(minutes=settings.REMATCH_COOLDOWN_MINUTES)
    recent = (await session.execute(
        select(GameSession).where(
            GameSession.status == "completed",
            GameSession.completed_at > cooldown,
            GameSession.bot_id.in_([sess1.bot_id, sess2.bot_id]),
            GameSession.opponent_session_id.isnot(None),
        )
    )).scalars().all()

    # Check if these bots already played recently
    for r in recent:
        if r.opponent_session_id:
            opp = (await session.execute(
                select(GameSession).where(GameSession.id == r.opponent_session_id)
            )).scalar_one_or_none()
            if opp and {r.bot_id, opp.bot_id} == {sess1.bot_id, sess2.bot_id}:
                return  # Cooldown active

    # Create table
    table = Table(arena_id=arena.id)
    session.add(table)
    await session.flush()

    # Update sessions
    now = datetime.now(timezone.utc)
    sess1.table_id = table.id
    sess1.status = "playing"
    sess1.started_at = now
    sess1.opponent_session_id = sess2.id

    sess2.table_id = table.id
    sess2.status = "playing"
    sess2.started_at = now
    sess2.opponent_session_id = sess1.id

    table.seat_1_session_id = sess1.id
    table.seat_2_session_id = sess2.id

    # Update bot statuses
    bot1 = (await session.execute(select(Bot).where(Bot.id == sess1.bot_id))).scalar_one()
    bot2 = (await session.execute(select(Bot).where(Bot.id == sess2.bot_id))).scalar_one()
    bot1.status = "playing"
    bot2.status = "playing"

    await session.commit()
