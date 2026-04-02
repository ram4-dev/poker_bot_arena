import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_session
from app.models.user import User
from app.models.agent import Agent
from app.models.arena import Arena
from app.models.table import Table
from app.models.session import Session as GameSession
from app.models.hand import Hand, HandEvent

router = APIRouter()


def _parse_json_field(value: str | None) -> list[str]:
    """Parse a JSON-encoded string field (cards) into a list."""
    if not value:
        return []
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


async def _build_seat_info(
    db: AsyncSession,
    game_session: GameSession | None,
    table: Table,
    seat_num: int,
) -> dict | None:
    """Build seat info dict for a given session, including current stack."""
    if not game_session:
        return None

    # Load agent and user
    agent_result = await db.execute(
        select(Agent).where(Agent.id == game_session.agent_id)
    )
    agent = agent_result.scalar_one_or_none()

    user_result = await db.execute(
        select(User).where(User.id == game_session.user_id)
    )
    user = user_result.scalar_one_or_none()

    if not agent or not user:
        return None

    # Current stack: from latest hand if available, else initial_stack
    stack = game_session.initial_stack
    latest_hand_result = await db.execute(
        select(Hand)
        .where(Hand.table_id == table.id)
        .order_by(desc(Hand.hand_number))
        .limit(1)
    )
    latest_hand = latest_hand_result.scalar_one_or_none()
    if latest_hand:
        if seat_num == 1 and latest_hand.player_1_stack_after is not None:
            stack = latest_hand.player_1_stack_after
        elif seat_num == 2 and latest_hand.player_2_stack_after is not None:
            stack = latest_hand.player_2_stack_after

    # Winrate
    hands_played = game_session.hands_played or 0
    hands_won = game_session.hands_won or 0
    winrate = round(hands_won / hands_played, 2) if hands_played > 0 else 0.0

    return {
        "session_id": game_session.id,
        "agent_id": agent.id,
        "agent_name": agent.name,
        "username": user.username,
        "elo": agent.elo,
        "stack": stack,
        "initial_stack": game_session.initial_stack,
        "hands_won": hands_won,
        "winrate": winrate,
    }


async def _build_table_info(db: AsyncSession, table: Table) -> dict:
    """Build full table info dict."""
    # Load arena
    arena_result = await db.execute(
        select(Arena).where(Arena.id == table.arena_id)
    )
    arena = arena_result.scalar_one_or_none()

    # Load sessions
    seat_1_session = None
    seat_2_session = None
    if table.seat_1_session_id:
        r = await db.execute(select(GameSession).where(GameSession.id == table.seat_1_session_id))
        seat_1_session = r.scalar_one_or_none()
    if table.seat_2_session_id:
        r = await db.execute(select(GameSession).where(GameSession.id == table.seat_2_session_id))
        seat_2_session = r.scalar_one_or_none()

    seat_1 = await _build_seat_info(db, seat_1_session, table, 1)
    seat_2 = await _build_seat_info(db, seat_2_session, table, 2)

    result = {
        "table_id": table.id,
        "arena": {
            "name": arena.name if arena else "Unknown",
            "slug": arena.slug if arena else "unknown",
            "small_blind": arena.small_blind if arena else 0,
            "big_blind": arena.big_blind if arena else 0,
        },
        "hands_played": table.hands_played,
        "started_at": table.created_at.isoformat() if table.created_at else None,
        "seat_1": seat_1,
        "seat_2": seat_2,
    }

    # For completed tables, determine winner
    if table.status == "completed":
        if seat_1_session and seat_2_session:
            s1_final = seat_1_session.final_stack or 0
            s2_final = seat_2_session.final_stack or 0
            if s1_final > s2_final:
                result["winner"] = "seat_1"
            elif s2_final > s1_final:
                result["winner"] = "seat_2"
            else:
                result["winner"] = "draw"
        else:
            result["winner"] = "draw"

    return result


@router.get("")
async def list_matches(
    session: AsyncSession = Depends(get_session),
):
    """List active matches and recently completed matches (last 30 min)."""
    # Active tables
    active_result = await session.execute(
        select(Table)
        .where(Table.status == "active")
        .order_by(desc(Table.created_at))
    )
    active_tables = active_result.scalars().all()

    active_matches = []
    for table in active_tables:
        info = await _build_table_info(session, table)
        active_matches.append(info)

    # Recently completed (last 30 min)
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=30)
    # SQLite stores datetimes without timezone, so compare naive
    cutoff_naive = cutoff.replace(tzinfo=None)

    completed_result = await session.execute(
        select(Table)
        .where(
            and_(
                Table.status == "completed",
                Table.completed_at > cutoff_naive,
            )
        )
        .order_by(desc(Table.completed_at))
    )
    completed_tables = completed_result.scalars().all()

    recently_completed = []
    for table in completed_tables:
        info = await _build_table_info(session, table)
        recently_completed.append(info)

    return {
        "active": active_matches,
        "recently_completed": recently_completed,
        "total_active": len(active_matches),
    }


@router.get("/{table_id}/live")
async def match_live(
    table_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Get live data for a specific table/match."""
    table_result = await session.execute(
        select(Table).where(Table.id == table_id)
    )
    table = table_result.scalar_one_or_none()
    if not table:
        raise HTTPException(404, "Table not found")

    info = await _build_table_info(session, table)
    info["status"] = table.status

    # Recent hands (last 10) with events
    hands_result = await session.execute(
        select(Hand)
        .where(Hand.table_id == table_id)
        .order_by(desc(Hand.hand_number))
        .limit(10)
    )
    hands = hands_result.scalars().all()

    recent_hands = []
    for hand in reversed(hands):  # chronological order
        # Load events
        events_result = await session.execute(
            select(HandEvent)
            .where(HandEvent.hand_id == hand.id)
            .order_by(HandEvent.sequence)
        )
        events = events_result.scalars().all()

        # Determine winner_seat
        winner_seat = None
        if hand.winner_session_id:
            if hand.winner_session_id == table.seat_1_session_id:
                winner_seat = 1
            elif hand.winner_session_id == table.seat_2_session_id:
                winner_seat = 2

        recent_hands.append({
            "hand_id": hand.id,
            "hand_number": hand.hand_number,
            "phase": hand.phase,
            "pot": hand.pot,
            "community_cards": _parse_json_field(hand.community_cards),
            "winner_seat": winner_seat,
            "winning_hand_rank": hand.winning_hand_rank,
            "player_1_stack_after": hand.player_1_stack_after,
            "player_2_stack_after": hand.player_2_stack_after,
            "player_1_hole": _parse_json_field(hand.player_1_hole),
            "player_2_hole": _parse_json_field(hand.player_2_hole),
            "events": [
                {
                    "sequence": ev.sequence,
                    "street": ev.street,
                    "player_seat": ev.player_seat,
                    "action": ev.action,
                    "amount": ev.amount,
                    "pot_after": ev.pot_after,
                }
                for ev in events
            ],
        })

    info["recent_hands"] = recent_hands
    return info
