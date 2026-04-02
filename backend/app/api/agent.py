"""Agent API — CRUD, history, session logs, and poker skill documentation."""

import json
import pathlib

from fastapi import APIRouter, Depends, Query, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_session
from app.api.deps import get_current_user
from app.models.user import User
from app.models.session import Session as GameSession
from app.models.hand import Hand, HandEvent
from app.schemas.agent import CreateAgentRequest, AgentResponse, AgentListResponse
from app.services import agent_service

router = APIRouter()

# Resolve poker_skill.md path once at import time
_SKILL_PATH = pathlib.Path(__file__).resolve().parents[2] / "poker_skill.md"


@router.post("/agent/create", response_model=AgentResponse, status_code=201)
async def create_agent(
    req: CreateAgentRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Create a new poker agent (max 3 per user)."""
    agent = await agent_service.create_agent(session, user.id, req.name)
    return AgentResponse.from_model(agent)


@router.get("/agent/list", response_model=AgentListResponse)
async def list_agents(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List all agents belonging to the authenticated user."""
    agents = await agent_service.get_agents(session, user.id)
    return AgentListResponse(agents=[AgentResponse.from_model(a) for a in agents])


@router.get("/agent/history")
async def agent_history(
    agent_id: str,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Return paginated session history for an agent."""
    return await agent_service.get_agent_history(
        session, user.id, agent_id, limit, offset
    )


@router.get("/session/{session_id}/log")
async def session_log(
    session_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Return hand-by-hand log with cards and actions for a session.

    Perspective is shown as "me" / "opponent" based on which player
    the authenticated user is.
    """
    gs = (await session.execute(
        select(GameSession).where(GameSession.id == session_id)
    )).scalar_one_or_none()
    if not gs:
        raise HTTPException(404, "Session not found")
    if gs.user_id != user.id:
        raise HTTPException(403, "Not your session")

    # Determine if user is player 1 or player 2
    hands = (await session.execute(
        select(Hand)
        .where((Hand.session_1_id == gs.id) | (Hand.session_2_id == gs.id))
        .options(selectinload(Hand.events))
        .order_by(Hand.hand_number)
    )).scalars().all()

    log = []
    for h in hands:
        is_player_1 = h.session_1_id == gs.id

        def _parse_cards(raw: str | None) -> list[str]:
            if not raw:
                return []
            try:
                return json.loads(raw)
            except Exception:
                return [c.strip() for c in raw.split(",") if c.strip()]

        my_hole = _parse_cards(h.player_1_hole if is_player_1 else h.player_2_hole)
        opp_hole = _parse_cards(h.player_2_hole if is_player_1 else h.player_1_hole)
        my_stack = h.player_1_stack_after if is_player_1 else h.player_2_stack_after
        opp_stack = h.player_2_stack_after if is_player_1 else h.player_1_stack_after

        won = h.winner_session_id == gs.id

        events = []
        for e in sorted(h.events, key=lambda x: x.sequence):
            # player_seat 1 = session_1, 2 = session_2
            if is_player_1:
                who = "me" if e.player_seat == 1 else "opponent"
            else:
                who = "me" if e.player_seat == 2 else "opponent"

            events.append({
                "sequence": e.sequence,
                "street": e.street,
                "player": who,
                "action": e.action,
                "amount": e.amount,
                "pot_after": e.pot_after,
            })

        log.append({
            "hand_number": h.hand_number,
            "my_hole_cards": my_hole,
            "opponent_hole_cards": opp_hole,
            "community_cards": _parse_cards(h.community_cards),
            "pot": h.pot,
            "won": won,
            "winning_hand_rank": h.winning_hand_rank,
            "my_stack_after": my_stack,
            "opponent_stack_after": opp_stack,
            "events": events,
        })

    return {"session_id": session_id, "hands": log, "total_hands": len(log)}


@router.get("/poker-skill")
async def poker_skill(request: Request):
    """Serve the poker skill documentation (public, no auth required)."""
    if not _SKILL_PATH.exists():
        raise HTTPException(404, "Skill file not found")
    content = _SKILL_PATH.read_text(encoding="utf-8")
    url = str(request.base_url) + "api/poker-skill"
    return {"content": content, "url": url}
