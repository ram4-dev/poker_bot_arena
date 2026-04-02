"""Game API — REST endpoints for external agents to play poker via HTTP polling."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_session
from app.models.agent import Agent
from app.models.session import Session as GameSession
from app.models.user import User
from app.schemas.game import (
    JoinArenaRequest,
    JoinArenaResponse,
    ActionRequest,
    LeaveRequest,
    SessionResultResponse,
)
from app.services import session_manager, table_manager

logger = logging.getLogger(__name__)

router = APIRouter()


# ------------------------------------------------------------------
# POST /arena/join
# ------------------------------------------------------------------


@router.post("/arena/join", response_model=JoinArenaResponse)
async def join_arena(
    req: JoinArenaRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Queue an agent to play in an arena."""
    # Validate agent belongs to user
    agent = (await session.execute(
        select(Agent).where(Agent.id == req.agent_id)
    )).scalar_one_or_none()
    if not agent:
        raise HTTPException(404, "Agent not found")
    if agent.user_id != user.id:
        raise HTTPException(403, "Agent does not belong to you")

    # Create session (validates balance, locks buy-in, etc.)
    game_sess = await session_manager.create_session(
        session, user.id, req.agent_id, req.arena_id
    )

    # Count position in queue for this arena
    result = await session.execute(
        select(func.count()).select_from(GameSession).where(
            GameSession.arena_id == req.arena_id,
            GameSession.status == "queued",
            GameSession.queued_at <= game_sess.queued_at,
        )
    )
    position = result.scalar() or 1

    return JoinArenaResponse(status="queued", position=position)


# ------------------------------------------------------------------
# GET /game/state
# ------------------------------------------------------------------


@router.get("/game/state")
async def get_game_state(
    agent_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Poll the current game state for an agent.

    Returns different payloads depending on the agent's status:
    - idle / queued / waiting / your_turn / hand_complete
    """
    # Validate agent belongs to user
    agent = (await session.execute(
        select(Agent).where(Agent.id == agent_id)
    )).scalar_one_or_none()
    if not agent:
        raise HTTPException(404, "Agent not found")
    if agent.user_id != user.id:
        raise HTTPException(403, "Agent does not belong to you")

    state = await table_manager.get_game_state(session, agent_id)

    # If status is "hand_complete", auto-start a new hand
    if state.get("status") == "hand_complete":
        game_sess = (await session.execute(
            select(GameSession).where(
                GameSession.agent_id == agent_id,
                GameSession.status == "playing",
            )
        )).scalar_one_or_none()

        if game_sess and game_sess.table_id:
            hand_id = await table_manager.start_new_hand(session, game_sess.table_id)
            if hand_id:
                # Re-fetch state now that a new hand is started
                state = await table_manager.get_game_state(session, agent_id)

    return state


# ------------------------------------------------------------------
# POST /game/action
# ------------------------------------------------------------------


@router.post("/game/action")
async def submit_action(
    req: ActionRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Submit a poker action (fold, check, call, raise, all_in)."""
    # Validate agent belongs to user
    agent = (await session.execute(
        select(Agent).where(Agent.id == req.agent_id)
    )).scalar_one_or_none()
    if not agent:
        raise HTTPException(404, "Agent not found")
    if agent.user_id != user.id:
        raise HTTPException(403, "Agent does not belong to you")

    result = await table_manager.process_action(
        session, req.agent_id, req.hand_id, req.action, req.amount
    )

    if "error" in result and not result.get("valid", True):
        raise HTTPException(400, result["error"])
    if "error" in result and "valid" not in result:
        raise HTTPException(409, result["error"])

    # If hand completed, auto-start next hand
    if result.get("hand_complete"):
        game_sess = (await session.execute(
            select(GameSession).where(
                GameSession.agent_id == req.agent_id,
                GameSession.status == "playing",
            )
        )).scalar_one_or_none()

        if game_sess and game_sess.table_id:
            next_hand_id = await table_manager.start_new_hand(session, game_sess.table_id)
            result["next_hand_id"] = next_hand_id

    return result


# ------------------------------------------------------------------
# POST /game/leave
# ------------------------------------------------------------------


@router.post("/game/leave")
async def leave_table(
    req: LeaveRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Voluntarily leave the current table / cancel queue."""
    # Validate agent belongs to user
    agent = (await session.execute(
        select(Agent).where(Agent.id == req.agent_id)
    )).scalar_one_or_none()
    if not agent:
        raise HTTPException(404, "Agent not found")
    if agent.user_id != user.id:
        raise HTTPException(403, "Agent does not belong to you")

    result = await table_manager.process_leave(session, req.agent_id)
    if result is None:
        raise HTTPException(404, "No active session for this agent")

    return SessionResultResponse(**result)
