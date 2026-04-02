from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.api.deps import get_current_user
from app.models.user import User
from app.models.agent import Agent
from app.models.arena import Arena
from app.models.session import Session as GameSession
from app.models.table import Table
from app.schemas.arena import QueueRequest, ArenaResponse, ArenaStatsResponse, QueueResponse
from app.services import wallet_service

router = APIRouter()


@router.get("")
async def list_arenas(session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    arenas = (await session.execute(select(Arena).order_by(Arena.buy_in))).scalars().all()
    result = []
    for arena in arenas:
        q_count = (await session.execute(
            select(func.count()).select_from(GameSession).where(
                GameSession.arena_id == arena.id, GameSession.status == "queued"
            )
        )).scalar()
        t_count = (await session.execute(
            select(func.count()).select_from(Table).where(
                Table.arena_id == arena.id, Table.status == "active"
            )
        )).scalar()
        result.append(ArenaResponse(
            id=arena.id, name=arena.name, slug=arena.slug,
            buy_in=arena.buy_in, small_blind=arena.small_blind, big_blind=arena.big_blind,
            is_practice=arena.is_practice, reward_multiplier=arena.reward_multiplier,
            stats=ArenaStatsResponse(
                bots_in_queue=q_count, active_tables=t_count,
                estimated_reward=int(arena.buy_in * 1.5),
            ),
        ))
    return {"arenas": result}


@router.post("/{arena_id}/queue", status_code=201)
async def queue_bot(
    arena_id: str, req: QueueRequest,
    user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session),
):
    arena = (await session.execute(select(Arena).where(Arena.id == arena_id))).scalar_one_or_none()
    if not arena:
        raise HTTPException(404, "Arena not found")

    agent = (await session.execute(select(Agent).where(Agent.id == req.agent_id))).scalar_one_or_none()
    if not agent or agent.user_id != user.id:
        raise HTTPException(404, "Agent not found")
    if agent.status != "idle":
        raise HTTPException(400, "Agent is not idle")

    # Lock buy-in (skip for practice)
    if arena.buy_in > 0:
        await wallet_service.lock_buy_in(session, user.id, arena.buy_in)

    game_session = GameSession(
        user_id=user.id,
        agent_id=agent.id,
        arena_id=arena.id,
        buy_in=arena.buy_in,
        initial_stack=arena.buy_in if arena.buy_in > 0 else 1000,
    )
    session.add(game_session)
    agent.status = "queued"
    await session.commit()
    await session.refresh(game_session)

    return QueueResponse(
        session_id=game_session.id, status="queued",
        arena=arena.name, bot_name=agent.name,
    )


@router.delete("/{arena_id}/queue/{session_id}")
async def dequeue_bot(
    arena_id: str, session_id: str,
    user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session),
):
    game_session = (await session.execute(
        select(GameSession).where(GameSession.id == session_id)
    )).scalar_one_or_none()
    if not game_session:
        raise HTTPException(404, "Session not found")
    if game_session.user_id != user.id:
        raise HTTPException(403, "Not your session")
    if game_session.status != "queued":
        raise HTTPException(400, "Session is not in queued status")

    # Refund buy-in
    if game_session.buy_in > 0:
        await wallet_service.unlock_buy_in(session, user.id, game_session.buy_in)

    game_session.status = "cancelled"
    agent = (await session.execute(select(Agent).where(Agent.id == game_session.agent_id))).scalar_one()
    agent.status = "idle"
    await session.commit()

    return {"message": "Bot removed from queue", "refunded": game_session.buy_in}
