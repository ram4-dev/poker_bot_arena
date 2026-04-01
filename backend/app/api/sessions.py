import json

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_session
from app.api.deps import get_current_user
from app.models.user import User
from app.models.bot import Bot
from app.models.session import Session as GameSession
from app.models.hand import Hand, HandEvent
from app.models.arena import Arena
from app.schemas.session import (
    SessionSummaryResponse, SessionDetailResponse, PaginatedSessionsResponse,
    HandResponse, HandEventResponse, KeyEventResponse, InsightsResponse,
)
from app.services import feedback_service

router = APIRouter()


@router.get("")
async def list_sessions(
    status: str | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    query = select(GameSession).where(GameSession.user_id == user.id)
    count_q = select(func.count()).select_from(GameSession).where(GameSession.user_id == user.id)

    if status:
        query = query.where(GameSession.status == status)
        count_q = count_q.where(GameSession.status == status)

    total = (await session.execute(count_q)).scalar()
    results = (await session.execute(
        query.order_by(GameSession.queued_at.desc()).limit(limit).offset(offset)
    )).scalars().all()

    items = []
    for gs in results:
        bot = (await session.execute(select(Bot).where(Bot.id == gs.bot_id))).scalar_one()
        opp_name = None
        if gs.opponent_session_id:
            opp_sess = (await session.execute(
                select(GameSession).where(GameSession.id == gs.opponent_session_id)
            )).scalar_one_or_none()
            if opp_sess:
                opp_bot = (await session.execute(select(Bot).where(Bot.id == opp_sess.bot_id))).scalar_one_or_none()
                opp_name = opp_bot.name if opp_bot else None

        profit = (gs.final_stack - gs.buy_in) if gs.final_stack is not None else None
        elo_change = (gs.elo_after - gs.elo_before) if gs.elo_after is not None and gs.elo_before is not None else None

        arena = (await session.execute(select(Arena).where(Arena.id == gs.arena_id))).scalar_one_or_none()
        items.append(SessionSummaryResponse(
            id=gs.id, arena_name=arena.name if arena else "", bot_name=bot.name,
            opponent_bot_name=opp_name, status=gs.status,
            profit=profit, hands_played=gs.hands_played, hands_won=gs.hands_won,
            exit_reason=gs.exit_reason, elo_change=elo_change,
            completed_at=gs.completed_at,
        ))

    return PaginatedSessionsResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/{session_id}")
async def get_session_detail(
    session_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    gs = (await session.execute(
        select(GameSession).where(GameSession.id == session_id)
    )).scalar_one_or_none()
    if not gs:
        raise HTTPException(404, "Session not found")
    if gs.user_id != user.id:
        raise HTTPException(403, "Not your session")

    bot = (await session.execute(select(Bot).where(Bot.id == gs.bot_id))).scalar_one()
    from app.models.bot import BotVersion
    ver = (await session.execute(select(BotVersion).where(BotVersion.id == gs.bot_version_id))).scalar_one()
    from app.models.arena import Arena
    arena = (await session.execute(select(Arena).where(Arena.id == gs.arena_id))).scalar_one()

    opp_name = None
    opp_user = None
    if gs.opponent_session_id:
        opp_sess = (await session.execute(select(GameSession).where(GameSession.id == gs.opponent_session_id))).scalar_one_or_none()
        if opp_sess:
            opp_bot = (await session.execute(select(Bot).where(Bot.id == opp_sess.bot_id))).scalar_one_or_none()
            opp_name = opp_bot.name if opp_bot else None
            opp_u = (await session.execute(select(User).where(User.id == opp_sess.user_id))).scalar_one_or_none()
            opp_user = opp_u.username if opp_u else None

    # Load hands
    hands = (await session.execute(
        select(Hand)
        .where((Hand.session_1_id == gs.id) | (Hand.session_2_id == gs.id))
        .options(selectinload(Hand.events))
        .order_by(Hand.hand_number)
    )).scalars().all()

    hand_responses = []
    for h in hands:
        import json as _json
        def _parse_cards(raw: str | None) -> list[str]:
            if not raw:
                return []
            try:
                return _json.loads(raw)
            except Exception:
                return [c.strip() for c in raw.split(",") if c.strip()]

        events = [HandEventResponse(
            sequence=e.sequence, street=e.street, player_seat=e.player_seat,
            action=e.action, amount=e.amount, pot_after=e.pot_after,
            hand_strength=e.hand_strength,
            hole_cards=_parse_cards(e.hole_cards),
        ) for e in sorted(h.events, key=lambda x: x.sequence)]
        hand_responses.append(HandResponse(
            hand_number=h.hand_number, pot=h.pot,
            winner_session_id=h.winner_session_id,
            community_cards=_parse_cards(h.community_cards),
            winning_hand_rank=h.winning_hand_rank,
            player_1_stack_after=h.player_1_stack_after,
            player_2_stack_after=h.player_2_stack_after,
            player_1_hole=_parse_cards(h.player_1_hole),
            player_2_hole=_parse_cards(h.player_2_hole),
            events=events,
        ))

    # Generate feedback
    feedback = await feedback_service.generate_feedback(session, gs)

    profit = (gs.final_stack - gs.buy_in) if gs.final_stack is not None else 0
    elo_change = (gs.elo_after - gs.elo_before) if gs.elo_after and gs.elo_before else 0
    winrate = gs.hands_won / gs.hands_played if gs.hands_played > 0 else 0
    outcome = "victory" if profit > 0 else "defeat" if profit < 0 else "draw"

    kpis = {
        "profit": profit,
        "winrate": round(winrate, 2),
        "elo_change": elo_change,
        "hands_played": gs.hands_played,
        "hands_won": gs.hands_won,
    }

    insights = None
    if feedback.get("insights"):
        insights = InsightsResponse(**feedback["insights"])

    key_events = [KeyEventResponse(**ke) for ke in feedback.get("key_events", [])]

    rivals = []
    if opp_name:
        rivals.append({"bot_name": opp_name, "user": opp_user, "outcome": outcome})

    return SessionDetailResponse(
        id=gs.id, status=gs.status,
        arena_name=arena.name, bot_name=bot.name,
        bot_version=ver.version_number,
        opponent_bot_name=opp_name, opponent_user=opp_user,
        outcome=outcome, kpis=kpis,
        key_events=key_events,
        performance=feedback.get("performance", []),
        insights=insights, rivals=rivals,
        hands=hand_responses,
    )
