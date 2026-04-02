from datetime import datetime, timedelta, timezone

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.agent import Agent
from app.models.arena import Arena
from app.models.table import Table
from app.models.session import Session as GameSession
from app.services import table_manager

settings = get_settings()


async def process_queue(session: AsyncSession) -> int:
    """Match agents in queue by arena. Returns number of pairs matched."""
    arenas = (await session.execute(select(Arena))).scalars().all()
    matched_count = 0

    for arena in arenas:
        queued = (await session.execute(
            select(GameSession)
            .where(GameSession.arena_id == arena.id, GameSession.status == "queued")
            .order_by(GameSession.queued_at.asc())
        )).scalars().all()

        queued = list(queued)
        matched_ids = set()

        for i, s1 in enumerate(queued):
            if s1.id in matched_ids:
                continue

            for s2 in queued[i + 1:]:
                if s2.id in matched_ids:
                    continue

                if await _can_match(session, s1, s2):
                    await _create_match(session, s1, s2, arena)
                    matched_ids.add(s1.id)
                    matched_ids.add(s2.id)
                    matched_count += 1
                    break

    return matched_count


async def _can_match(db: AsyncSession, s1: GameSession, s2: GameSession) -> bool:
    """Check if two queued sessions can be matched."""
    # 1. No same user
    if s1.user_id == s2.user_id:
        return False

    # 2. Rematch cooldown (5 min) - check if these agents played recently
    if await _has_recent_match(db, s1.agent_id, s2.agent_id):
        return False

    # 3. ELO range with progressive expansion
    now = datetime.now(timezone.utc)
    # Handle naive datetimes from SQLite (no timezone info)
    q1 = s1.queued_at.replace(tzinfo=timezone.utc) if s1.queued_at and s1.queued_at.tzinfo is None else s1.queued_at
    q2 = s2.queued_at.replace(tzinfo=timezone.utc) if s2.queued_at and s2.queued_at.tzinfo is None else s2.queued_at
    wait_min_s1 = (now - q1).total_seconds() / 60 if q1 else 0
    wait_min_s2 = (now - q2).total_seconds() / 60 if q2 else 0
    wait_min = max(wait_min_s1, wait_min_s2)

    allowed_range = min(
        settings.MATCHMAKER_ELO_RANGE_BASE + int(wait_min * settings.MATCHMAKER_ELO_EXPANSION_PER_MINUTE),
        settings.MATCHMAKER_ELO_RANGE_CAP,
    )

    agent1 = (await db.execute(select(Agent).where(Agent.id == s1.agent_id))).scalar_one()
    agent2 = (await db.execute(select(Agent).where(Agent.id == s2.agent_id))).scalar_one()

    return abs(agent1.elo - agent2.elo) <= allowed_range


async def _has_recent_match(db: AsyncSession, agent1_id: str, agent2_id: str) -> bool:
    """Check if two agents played each other within the rematch cooldown window."""
    cooldown = datetime.now(timezone.utc) - timedelta(minutes=settings.REMATCH_COOLDOWN_MINUTES)

    # Find recent completed sessions for either agent
    recent = (await db.execute(
        select(GameSession).where(
            GameSession.agent_id.in_([agent1_id, agent2_id]),
            GameSession.status == "completed",
            GameSession.completed_at > cooldown,
            GameSession.opponent_session_id.isnot(None),
        )
    )).scalars().all()

    for r in recent:
        if r.opponent_session_id:
            opp = (await db.execute(
                select(GameSession).where(GameSession.id == r.opponent_session_id)
            )).scalar_one_or_none()
            if opp and {r.agent_id, opp.agent_id} == {agent1_id, agent2_id}:
                return True

    return False


async def _create_match(db: AsyncSession, s1: GameSession, s2: GameSession, arena: Arena):
    """Create a table and start a match between two queued sessions."""
    # Create table
    table = Table(arena_id=arena.id, dealer_seat=1, status="active")
    db.add(table)
    await db.flush()

    # Update sessions
    now = datetime.now(timezone.utc)
    s1.table_id = table.id
    s1.status = "playing"
    s1.started_at = now
    s1.opponent_session_id = s2.id

    s2.table_id = table.id
    s2.status = "playing"
    s2.started_at = now
    s2.opponent_session_id = s1.id

    table.seat_1_session_id = s1.id
    table.seat_2_session_id = s2.id

    # Update agent statuses
    agent1 = (await db.execute(select(Agent).where(Agent.id == s1.agent_id))).scalar_one()
    agent2 = (await db.execute(select(Agent).where(Agent.id == s2.agent_id))).scalar_one()
    agent1.status = "playing"
    agent2.status = "playing"

    await db.flush()

    # Start first hand
    await table_manager.start_new_hand(db, table.id)
    await db.commit()
