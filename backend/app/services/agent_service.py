"""Service layer for agent CRUD and stats management."""

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.agent import Agent
from app.models.session import Session as GameSession
from app.models.arena import Arena

settings = get_settings()


async def create_agent(db: AsyncSession, user_id: str, name: str) -> Agent:
    """Create a new agent. Enforces MAX_AGENTS_PER_USER limit."""
    count = (await db.execute(
        select(func.count()).select_from(Agent).where(Agent.user_id == user_id)
    )).scalar()

    if count >= settings.MAX_AGENTS_PER_USER:
        raise HTTPException(
            400,
            f"Maximum {settings.MAX_AGENTS_PER_USER} agents per user reached",
        )

    agent = Agent(
        user_id=user_id,
        name=name,
        status="idle",
        elo=settings.ELO_INITIAL,
    )
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return agent


async def get_agents(db: AsyncSession, user_id: str) -> list[Agent]:
    """Return all agents belonging to a user."""
    result = await db.execute(
        select(Agent).where(Agent.user_id == user_id).order_by(Agent.created_at.desc())
    )
    return list(result.scalars().all())


async def get_agent_history(
    db: AsyncSession,
    user_id: str,
    agent_id: str,
    limit: int = 20,
    offset: int = 0,
) -> dict:
    """Return paginated session history for an agent with rival info and stats."""
    # Verify ownership
    agent = (await db.execute(
        select(Agent).where(Agent.id == agent_id)
    )).scalar_one_or_none()
    if not agent or agent.user_id != user_id:
        raise HTTPException(404, "Agent not found")

    # Count total
    total = (await db.execute(
        select(func.count()).select_from(GameSession).where(
            GameSession.agent_id == agent_id,
        )
    )).scalar()

    # Fetch sessions
    sessions = (await db.execute(
        select(GameSession)
        .where(GameSession.agent_id == agent_id)
        .order_by(GameSession.queued_at.desc())
        .limit(limit)
        .offset(offset)
    )).scalars().all()

    items = []
    for gs in sessions:
        # Get arena name
        arena = (await db.execute(
            select(Arena).where(Arena.id == gs.arena_id)
        )).scalar_one_or_none()

        # Get opponent info
        rival_name = None
        if gs.opponent_session_id:
            opp_sess = (await db.execute(
                select(GameSession).where(GameSession.id == gs.opponent_session_id)
            )).scalar_one_or_none()
            if opp_sess:
                opp_agent = (await db.execute(
                    select(Agent).where(Agent.id == opp_sess.agent_id)
                )).scalar_one_or_none()
                rival_name = opp_agent.name if opp_agent else None

        profit = (gs.final_stack - gs.buy_in) if gs.final_stack is not None else None
        elo_change = (
            (gs.elo_after - gs.elo_before)
            if gs.elo_after is not None and gs.elo_before is not None
            else None
        )

        items.append({
            "session_id": gs.id,
            "arena_name": arena.name if arena else "",
            "rival_name": rival_name,
            "status": gs.status,
            "profit": profit,
            "hands_played": gs.hands_played,
            "hands_won": gs.hands_won,
            "elo_change": elo_change,
            "exit_reason": gs.exit_reason,
            "completed_at": gs.completed_at.isoformat() if gs.completed_at else None,
        })

    return {"items": items, "total": total, "limit": limit, "offset": offset}


async def update_agent_stats(
    db: AsyncSession, agent_id: str, won: bool, hands: int, profit: int
) -> None:
    """Update win/loss/hands counters after a session completes."""
    agent = (await db.execute(
        select(Agent).where(Agent.id == agent_id)
    )).scalar_one_or_none()
    if not agent:
        return

    if won:
        agent.total_wins += 1
    else:
        agent.total_losses += 1
    agent.total_hands += hands
    await db.commit()


async def set_status(db: AsyncSession, agent_id: str, status: str) -> None:
    """Update the agent's status field."""
    agent = (await db.execute(
        select(Agent).where(Agent.id == agent_id)
    )).scalar_one_or_none()
    if not agent:
        return
    agent.status = status
    await db.commit()


async def increment_timeout(db: AsyncSession, agent_id: str) -> int:
    """Increment consecutive_timeouts. Returns new count."""
    agent = (await db.execute(
        select(Agent).where(Agent.id == agent_id)
    )).scalar_one_or_none()
    if not agent:
        return 0
    agent.consecutive_timeouts += 1
    await db.commit()
    return agent.consecutive_timeouts


async def reset_timeouts(db: AsyncSession, agent_id: str) -> None:
    """Reset consecutive_timeouts to 0."""
    agent = (await db.execute(
        select(Agent).where(Agent.id == agent_id)
    )).scalar_one_or_none()
    if not agent:
        return
    agent.consecutive_timeouts = 0
    await db.commit()
