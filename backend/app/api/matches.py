"""Matches endpoint: live spectator view of active and recent tables."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.api.deps import get_current_user
from app.models.user import User
from app.models.bot import Bot
from app.models.arena import Arena
from app.models.table import Table
from app.models.session import Session as GameSession
from app.models.hand import Hand, HandEvent

router = APIRouter()


async def _build_seat(session: AsyncSession, game_session: GameSession, table: Table) -> dict:
    bot = (await session.execute(select(Bot).where(Bot.id == game_session.bot_id))).scalar_one()
    user = (await session.execute(select(User).where(User.id == game_session.user_id))).scalar_one()

    # Current stack from last hand
    is_seat_1 = table.seat_1_session_id == game_session.id
    last_hand = (await session.execute(
        select(Hand)
        .where(Hand.table_id == table.id)
        .order_by(desc(Hand.hand_number))
        .limit(1)
    )).scalar_one_or_none()

    if last_hand:
        stack = last_hand.player_1_stack_after if is_seat_1 else last_hand.player_2_stack_after
    else:
        stack = game_session.initial_stack

    total_hands = game_session.hands_played or 0
    hands_won = game_session.hands_won or 0
    winrate = round(hands_won / total_hands, 2) if total_hands > 0 else 0.0

    return {
        "session_id": game_session.id,
        "bot_id": bot.id,
        "bot_name": bot.name,
        "username": user.username,
        "elo": bot.elo,
        "stack": stack,
        "initial_stack": game_session.initial_stack,
        "hands_won": hands_won,
        "winrate": winrate,
    }


@router.get("")
async def list_matches(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    # Active tables
    active_tables = (await session.execute(
        select(Table).where(Table.status == "active").order_by(Table.created_at)
    )).scalars().all()

    active = []
    for table in active_tables:
        if not table.seat_1_session_id or not table.seat_2_session_id:
            continue
        s1 = (await session.execute(select(GameSession).where(GameSession.id == table.seat_1_session_id))).scalar_one_or_none()
        s2 = (await session.execute(select(GameSession).where(GameSession.id == table.seat_2_session_id))).scalar_one_or_none()
        if not s1 or not s2:
            continue
        arena = (await session.execute(select(Arena).where(Arena.id == table.arena_id))).scalar_one()

        active.append({
            "table_id": table.id,
            "arena": {"name": arena.name, "slug": arena.slug, "small_blind": arena.small_blind, "big_blind": arena.big_blind},
            "hands_played": table.hands_played,
            "started_at": table.created_at.isoformat(),
            "seat_1": await _build_seat(session, s1, table),
            "seat_2": await _build_seat(session, s2, table),
        })

    # Recently completed (last 30 min)
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=30)
    recent_tables = (await session.execute(
        select(Table)
        .where(Table.status == "completed", Table.completed_at >= cutoff)
        .order_by(desc(Table.completed_at))
        .limit(20)
    )).scalars().all()

    recently_completed = []
    for table in recent_tables:
        if not table.seat_1_session_id or not table.seat_2_session_id:
            continue
        s1 = (await session.execute(select(GameSession).where(GameSession.id == table.seat_1_session_id))).scalar_one_or_none()
        s2 = (await session.execute(select(GameSession).where(GameSession.id == table.seat_2_session_id))).scalar_one_or_none()
        if not s1 or not s2:
            continue
        arena = (await session.execute(select(Arena).where(Arena.id == table.arena_id))).scalar_one()

        # Determine winner
        seat1_profit = (s1.final_stack or 0) - s1.initial_stack
        seat2_profit = (s2.final_stack or 0) - s2.initial_stack
        if seat1_profit > seat2_profit:
            winner = "seat_1"
        elif seat2_profit > seat1_profit:
            winner = "seat_2"
        else:
            winner = "draw"

        recently_completed.append({
            "table_id": table.id,
            "arena": {"name": arena.name, "slug": arena.slug, "small_blind": arena.small_blind, "big_blind": arena.big_blind},
            "hands_played": table.hands_played,
            "completed_at": table.completed_at.isoformat() if table.completed_at else None,
            "winner": winner,
            "seat_1": await _build_seat(session, s1, table),
            "seat_2": await _build_seat(session, s2, table),
        })

    return {
        "active": active,
        "recently_completed": recently_completed,
        "total_active": len(active),
    }


@router.get("/{table_id}/live")
async def match_live(
    table_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    table = (await session.execute(select(Table).where(Table.id == table_id))).scalar_one_or_none()
    if not table:
        from fastapi import HTTPException
        raise HTTPException(404, "Table not found")

    arena = (await session.execute(select(Arena).where(Arena.id == table.arena_id))).scalar_one()

    s1 = s2 = None
    if table.seat_1_session_id:
        s1 = (await session.execute(select(GameSession).where(GameSession.id == table.seat_1_session_id))).scalar_one_or_none()
    if table.seat_2_session_id:
        s2 = (await session.execute(select(GameSession).where(GameSession.id == table.seat_2_session_id))).scalar_one_or_none()

    seat_1 = await _build_seat(session, s1, table) if s1 else None
    seat_2 = await _build_seat(session, s2, table) if s2 else None

    # Last 10 hands with events
    recent_hands_rows = (await session.execute(
        select(Hand)
        .where(Hand.table_id == table_id)
        .order_by(desc(Hand.hand_number))
        .limit(10)
    )).scalars().all()

    recent_hands = []
    for h in reversed(recent_hands_rows):
        events_rows = (await session.execute(
            select(HandEvent)
            .where(HandEvent.hand_id == h.id)
            .order_by(HandEvent.sequence)
        )).scalars().all()

        winner_seat = None
        if h.winner_session_id == table.seat_1_session_id:
            winner_seat = 1
        elif h.winner_session_id == table.seat_2_session_id:
            winner_seat = 2

        import json as _json
        try:
            community = _json.loads(h.community_cards) if h.community_cards else []
        except Exception:
            community = []

        def _parse(raw: str | None) -> list[str]:
            if not raw:
                return []
            try:
                return _json.loads(raw)
            except Exception:
                return [c.strip() for c in raw.split(",") if c.strip()]

        recent_hands.append({
            "hand_number": h.hand_number,
            "pot": h.pot,
            "community_cards": community,
            "winner_seat": winner_seat,
            "winning_hand_rank": h.winning_hand_rank,
            "player_1_stack_after": h.player_1_stack_after,
            "player_2_stack_after": h.player_2_stack_after,
            "player_1_hole": _parse(h.player_1_hole),
            "player_2_hole": _parse(h.player_2_hole),
            "events": [
                {
                    "sequence": e.sequence,
                    "street": e.street,
                    "player_seat": e.player_seat,
                    "action": e.action,
                    "amount": e.amount,
                    "pot_after": e.pot_after,
                    "hand_strength": e.hand_strength,
                    "hole_cards": _parse(e.hole_cards),
                }
                for e in events_rows
            ],
        })

    return {
        "table_id": table.id,
        "status": table.status,
        "arena": {
            "name": arena.name,
            "slug": arena.slug,
            "small_blind": arena.small_blind,
            "big_blind": arena.big_blind,
        },
        "hands_played": table.hands_played,
        "seat_1": seat_1,
        "seat_2": seat_2,
        "recent_hands": recent_hands,
    }
