"""Session manager — create, start, and close game sessions.

Simplified for v3: no batch hand execution.  Hands are played one at a time
via the table_manager + game API.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.config import get_settings
from app.models.agent import Agent
from app.models.arena import Arena
from app.models.session import Session as GameSession
from app.services import wallet_service

logger = logging.getLogger(__name__)
settings = get_settings()


async def create_session(
    session: AsyncSession,
    user_id: str,
    agent_id: str,
    arena_id: str,
) -> GameSession:
    """Validate inputs, lock buy-in, create a queued session."""

    # Validate agent belongs to user
    agent = (await session.execute(
        select(Agent).where(Agent.id == agent_id)
    )).scalar_one_or_none()
    if not agent:
        raise HTTPException(404, "Agent not found")
    if agent.user_id != user_id:
        raise HTTPException(403, "Agent does not belong to you")

    # Agent must be idle
    if agent.status != "idle":
        raise HTTPException(409, f"Agent is currently {agent.status}")

    # Check agent doesn't already have an active session
    existing = (await session.execute(
        select(GameSession).where(
            GameSession.agent_id == agent_id,
            GameSession.status.in_(["queued", "playing"]),
        )
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(409, "Agent already has an active session")

    # Validate arena
    arena = (await session.execute(
        select(Arena).where(Arena.id == arena_id)
    )).scalar_one_or_none()
    if not arena:
        raise HTTPException(404, "Arena not found")

    # Lock buy-in (wallet_service checks balance)
    if arena.buy_in > 0:
        await wallet_service.lock_buy_in(session, user_id, arena.buy_in)

    # Create session
    game_sess = GameSession(
        user_id=user_id,
        agent_id=agent_id,
        arena_id=arena_id,
        status="queued",
        buy_in=arena.buy_in,
        initial_stack=arena.buy_in if arena.buy_in > 0 else 1000,  # practice default
        queued_at=datetime.now(timezone.utc),
    )
    session.add(game_sess)

    # Update agent status
    agent.status = "queued"

    try:
        await session.commit()
        await session.refresh(game_sess)
    except Exception:
        await session.rollback()
        raise

    logger.info(f"Session {game_sess.id} created: agent={agent_id} arena={arena_id}")
    return game_sess


async def start_session(
    session: AsyncSession,
    session_id: str,
    table_id: str,
    opponent_session_id: str,
) -> None:
    """Transition a session from queued to playing."""
    game_sess = (await session.execute(
        select(GameSession).where(GameSession.id == session_id)
    )).scalar_one_or_none()
    if not game_sess:
        return

    game_sess.status = "playing"
    game_sess.table_id = table_id
    game_sess.opponent_session_id = opponent_session_id
    game_sess.started_at = datetime.now(timezone.utc)

    # Update agent status
    agent = (await session.execute(
        select(Agent).where(Agent.id == game_sess.agent_id)
    )).scalar_one_or_none()
    if agent:
        agent.status = "playing"

    await session.commit()


async def close_session(
    session: AsyncSession,
    session_id: str,
    exit_reason: str,
    final_stack: int | None = None,
) -> None:
    """Close a session: settle wallet, update ELO, reset agent.

    Args:
        session: DB session.
        session_id: The game session to close.
        exit_reason: Why the session ended.
        final_stack: Override final stack (if None, uses session.final_stack or initial_stack).
    """
    game_sess = (await session.execute(
        select(GameSession).where(GameSession.id == session_id)
    )).scalar_one_or_none()
    if not game_sess:
        return
    if game_sess.status == "completed":
        return  # already closed

    game_sess.status = "completed"
    game_sess.exit_reason = exit_reason
    game_sess.completed_at = datetime.now(timezone.utc)

    # Determine final stack
    if final_stack is not None:
        game_sess.final_stack = final_stack
    elif game_sess.final_stack is None:
        game_sess.final_stack = game_sess.initial_stack

    effective_stack = game_sess.final_stack

    # Settle wallet
    if game_sess.buy_in > 0:
        arena = (await session.execute(
            select(Arena).where(Arena.id == game_sess.arena_id)
        )).scalar_one_or_none()
        reward_multiplier = arena.reward_multiplier if arena else 1.0

        if exit_reason == "agent_leave" and game_sess.hands_played == 0:
            # Refund buy-in if leaving before any hands
            await wallet_service.unlock_buy_in(session, game_sess.user_id, game_sess.buy_in)
        else:
            await wallet_service.settle_session(
                session, game_sess.user_id, game_sess.buy_in,
                effective_stack, game_sess.id,
                reward_multiplier=reward_multiplier,
            )

    # Update ELO — only if hands were played, opponent exists, and ELO not yet set.
    # Guard prevents double-update when both sessions close in the same tick.
    if game_sess.hands_played > 0 and game_sess.opponent_session_id and game_sess.elo_after is None:
        opp_sess = (await session.execute(
            select(GameSession).where(GameSession.id == game_sess.opponent_session_id)
        )).scalar_one_or_none()
        if opp_sess:
            try:
                from app.services import elo_service
                await elo_service.update_elo(session, game_sess, opp_sess)
            except Exception as e:
                # ELO update failure shouldn't block session close
                logger.warning(f"ELO update failed for session {session_id}: {e}")

    # Update agent stats
    agent = (await session.execute(
        select(Agent).where(Agent.id == game_sess.agent_id)
    )).scalar_one_or_none()
    if agent:
        won = (effective_stack or 0) > game_sess.buy_in
        if game_sess.hands_played > 0:
            if won:
                agent.total_wins += 1
            else:
                agent.total_losses += 1
            agent.total_hands += game_sess.hands_played
        agent.status = "idle"
        agent.consecutive_timeouts = 0

    await session.commit()

    logger.info(
        f"Session {session_id} closed: reason={exit_reason} "
        f"stack={effective_stack} hands={game_sess.hands_played}"
    )


# ------------------------------------------------------------------
# Legacy compatibility stubs
# ------------------------------------------------------------------
# The scheduler tick.py imports execute_hands — provide a no-op stub
# so it doesn't crash on import.  Feature 4 will rewrite the scheduler.


async def execute_hands(session: AsyncSession, table, count: int) -> int:
    """Legacy stub — v3 uses table_manager for hand-by-hand play.

    Returns 0 (no hands executed) so the old scheduler tick is harmless.
    """
    return 0
