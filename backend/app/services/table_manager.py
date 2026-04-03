"""Table manager — bridge between the Game API and the HoldemHand engine.

Holds active HoldemHand instances in memory (keyed by table_id).
Provides get_game_state, process_action, start_new_hand, complete_hand,
handle_timeout and process_leave.
"""

import json
import logging
from datetime import datetime, timedelta, timezone
from dataclasses import asdict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.engine.holdem import HoldemHand
from app.engine.types import HandResult
from app.models.agent import Agent
from app.models.arena import Arena
from app.models.hand import Hand, HandEvent as HandEventModel
from app.models.session import Session as GameSession
from app.models.table import Table

logger = logging.getLogger(__name__)
settings = get_settings()

# Module-level dict holding active HoldemHand instances by table_id
_active_hands: dict[str, HoldemHand] = {}


# ------------------------------------------------------------------
# Public API
# ------------------------------------------------------------------


async def get_game_state(session: AsyncSession, agent_id: str) -> dict:
    """Return the current game state for the given agent.

    Returns a dict with either:
      - "status": "idle"       — agent has no active session
      - "status": "queued"     — agent is waiting for a match
      - "status": "waiting"    — playing, but not agent's turn
      - "status": "your_turn"  — it is the agent's turn; includes full game state
      - "status": "hand_complete" — hand just finished, next hand not yet started
    """
    # Find agent's active session
    game_sess = await _get_active_session(session, agent_id)
    if not game_sess:
        return {"status": "idle"}
    if game_sess.status == "queued":
        return {"status": "queued", "arena_id": game_sess.arena_id}

    # Session is "playing" — look up the table
    table = await _get_table(session, game_sess.table_id)
    if not table or table.status == "completed":
        return {"status": "idle"}

    # Is there an active hand in memory?
    hand = _active_hands.get(table.id)
    if not hand:
        # No hand in memory — might need to start one
        return {
            "status": "hand_complete",
            "table_id": table.id,
            "hands_played": game_sess.hands_played,
            "my_stack": game_sess.final_stack if game_sess.final_stack is not None else game_sess.initial_stack,
        }

    # There is an active hand — check whose turn it is
    if table.pending_action_agent_id == agent_id:
        state = hand.get_state(agent_id)
        # Enrich with session stats
        state.session = {
            "hands_played": game_sess.hands_played,
            "initial_stack": game_sess.initial_stack,
            "current_profit": _calc_profit(game_sess),
        }
        state.timeout_seconds = settings.ACTION_TIMEOUT_SECONDS
        return {
            "status": "your_turn",
            "game_state": asdict(state),
        }
    else:
        return {
            "status": "waiting",
            "hand_id": hand.hand_id,
            "table_id": table.id,
            "hands_played": game_sess.hands_played,
        }


async def process_action(
    session: AsyncSession,
    agent_id: str,
    hand_id: str,
    action: str,
    amount: int = 0,
) -> dict:
    """Validate and apply an action from an agent.

    Returns a dict describing the result.
    """
    game_sess = await _get_active_session(session, agent_id)
    if not game_sess or game_sess.status != "playing":
        return {"error": "No active session"}

    table = await _get_table(session, game_sess.table_id)
    if not table:
        return {"error": "Table not found"}

    hand = _active_hands.get(table.id)
    if not hand:
        return {"error": "No active hand on this table"}

    if hand.hand_id != hand_id:
        return {"error": f"Hand mismatch: expected {hand.hand_id}"}

    if table.pending_action_agent_id != agent_id:
        return {"error": "Not your turn"}

    # Check deadline (handle naive datetimes from SQLite)
    deadline = table.action_deadline
    if deadline and deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    if deadline and datetime.now(timezone.utc) > deadline:
        # Timeout — auto-fold
        await handle_timeout(session, table.id, agent_id)
        return {"error": "Action timed out, auto-folded"}

    # Apply the action via engine
    result = hand.apply_action(agent_id, action, amount)

    if not result.valid:
        return {"error": result.error, "valid": False}

    # Reset consecutive timeouts on successful action
    agent = (await session.execute(select(Agent).where(Agent.id == agent_id))).scalar_one()
    agent.consecutive_timeouts = 0

    # Persist the event
    event_count = await _count_hand_events(session, hand.hand_id)
    event = HandEventModel(
        hand_id=hand.hand_id,
        sequence=event_count,
        street=hand.current_phase().value if not result.hand_complete else "complete",
        player_seat=_agent_seat(table, agent_id),
        action=action.lower(),
        amount=amount,
        pot_after=hand.current_pot(),
    )
    session.add(event)

    if result.hand_complete:
        await _on_hand_complete(session, table, hand)
        return {"valid": True, "hand_complete": True}
    else:
        # Update pending action to next actor
        table.pending_action_agent_id = result.next_actor
        table.action_deadline = datetime.now(timezone.utc) + timedelta(
            seconds=settings.ACTION_TIMEOUT_SECONDS
        )
        # Persist community cards mid-hand so the live viewer can show them
        # progressively (flop/turn/river) without waiting for hand completion.
        if hand.get_community_cards():
            hand_record = (await session.execute(
                select(Hand).where(Hand.id == hand.hand_id)
            )).scalar_one_or_none()
            if hand_record:
                hand_record.community_cards = json.dumps(hand.get_community_cards())
        await session.commit()
        return {"valid": True, "hand_complete": False, "next_actor": result.next_actor}


async def start_new_hand(session: AsyncSession, table_id: str) -> str | None:
    """Create a new HoldemHand on the given table.

    Returns the hand_id or None if a hand cannot be started.
    Idempotent: returns existing hand_id if one is already active in memory.
    """
    # If a hand is already running in memory, return it (prevents duplicates
    # from concurrent calls, e.g. both agents calling get_state simultaneously).
    existing = _active_hands.get(table_id)
    if existing:
        return existing.hand_id

    table = await _get_table(session, table_id)
    if not table or table.status != "active":
        return None

    # If DB shows a current hand but it's not in memory (server restart),
    # clear it so we can start fresh rather than getting stuck.
    if table.current_hand_id:
        table.current_hand_id = None
        table.pending_action_agent_id = None
        table.action_deadline = None

    sess1 = await _get_session_by_id(session, table.seat_1_session_id)
    sess2 = await _get_session_by_id(session, table.seat_2_session_id)

    if not sess1 or not sess2:
        return None
    if sess1.status != "playing" or sess2.status != "playing":
        return None

    # Determine stacks
    stack1 = sess1.final_stack if sess1.final_stack is not None else sess1.initial_stack
    stack2 = sess2.final_stack if sess2.final_stack is not None else sess2.initial_stack

    if stack1 <= 0 or stack2 <= 0:
        return None

    # Get arena blinds
    arena = (await session.execute(select(Arena).where(Arena.id == table.arena_id))).scalar_one()

    # Create DB Hand record
    hand_number = table.hands_played + 1
    hand_record = Hand(
        table_id=table.id,
        session_1_id=sess1.id,
        session_2_id=sess2.id,
        hand_number=hand_number,
        phase="preflop",
        pot=0,
    )
    session.add(hand_record)
    await session.flush()

    # Alternate dealer
    dealer_seat = table.dealer_seat

    # Create engine hand
    engine_hand = HoldemHand(
        hand_id=hand_record.id,
        agent1_id=sess1.agent_id,
        agent2_id=sess2.agent_id,
        stack1=stack1,
        stack2=stack2,
        small_blind=arena.small_blind,
        big_blind=arena.big_blind,
        dealer_seat=dealer_seat,
    )

    _active_hands[table.id] = engine_hand

    # Determine who acts first
    first_actor = engine_hand.current_actor()

    # Update table state
    table.current_hand_id = hand_record.id
    table.pending_action_agent_id = first_actor
    table.action_deadline = datetime.now(timezone.utc) + timedelta(
        seconds=settings.ACTION_TIMEOUT_SECONDS
    )

    # Persist blind events
    for evt in engine_hand.get_events():
        event_count = await _count_hand_events(session, hand_record.id)
        he = HandEventModel(
            hand_id=hand_record.id,
            sequence=event_count,
            street=evt["phase"],
            player_seat=_agent_seat_by_agent(table, sess1, sess2, evt["agent_id"]),
            action=evt["action"],
            amount=evt["amount"],
            pot_after=evt["pot_after"],
        )
        session.add(he)

    await session.commit()

    logger.info(f"Started hand {hand_record.id} on table {table.id} (hand #{hand_number})")
    return hand_record.id


async def complete_hand(session: AsyncSession, table_id: str, result: HandResult) -> None:
    """Persist hand result and update session stacks.

    Does NOT start the next hand — caller or scheduler is responsible for that.
    """
    table = await _get_table(session, table_id)
    if not table:
        return

    sess1 = await _get_session_by_id(session, table.seat_1_session_id)
    sess2 = await _get_session_by_id(session, table.seat_2_session_id)
    if not sess1 or not sess2:
        return

    # Update the Hand DB record
    hand_record = (await session.execute(
        select(Hand).where(Hand.id == result.hand_id)
    )).scalar_one_or_none()

    if hand_record:
        hand_record.phase = "complete"
        hand_record.winner_session_id = _agent_to_session_id(
            sess1, sess2, result.winner_agent_id
        )
        hand_record.pot = result.pot
        hand_record.community_cards = json.dumps(result.community_cards) if result.community_cards else None
        hand_record.player_1_hole = json.dumps(result.player1_hole_cards) if result.player1_hole_cards else None
        hand_record.player_2_hole = json.dumps(result.player2_hole_cards) if result.player2_hole_cards else None
        hand_record.player_1_stack_after = result.player1_stack_after
        hand_record.player_2_stack_after = result.player2_stack_after
        hand_record.winning_hand_rank = result.winning_hand_rank

    # Update session stacks and hand counts
    sess1.final_stack = result.player1_stack_after
    sess2.final_stack = result.player2_stack_after
    sess1.hands_played += 1
    sess2.hands_played += 1
    table.hands_played += 1

    # Track wins
    if result.winner_agent_id == sess1.agent_id:
        sess1.hands_won += 1
    elif result.winner_agent_id == sess2.agent_id:
        sess2.hands_won += 1

    # Clear table's current hand tracking
    table.current_hand_id = None
    table.pending_action_agent_id = None
    table.action_deadline = None

    # Alternate dealer for next hand
    table.dealer_seat = 2 if table.dealer_seat == 1 else 1

    # Remove engine hand from memory
    _active_hands.pop(table_id, None)

    await session.commit()

    logger.info(
        f"Hand {result.hand_id} complete on table {table_id}. "
        f"Winner: {result.winner_agent_id or 'tie'}. Pot: {result.pot}"
    )


async def handle_timeout(session: AsyncSession, table_id: str, agent_id: str) -> None:
    """Auto-fold for the timed-out agent. Increment timeout counters."""
    hand = _active_hands.get(table_id)
    if not hand:
        return

    table = await _get_table(session, table_id)
    if not table:
        return

    # Apply fold
    result = hand.apply_action(agent_id, "fold")
    if not result.valid:
        logger.warning(f"Timeout fold failed for agent {agent_id}: {result.error}")
        return

    # Persist fold event
    event_count = await _count_hand_events(session, hand.hand_id)
    event = HandEventModel(
        hand_id=hand.hand_id,
        sequence=event_count,
        street="complete",
        player_seat=_agent_seat(table, agent_id),
        action="fold_timeout",
        amount=0,
        pot_after=hand.current_pot(),
    )
    session.add(event)

    # Update agent timeout counters
    agent = (await session.execute(select(Agent).where(Agent.id == agent_id))).scalar_one_or_none()
    if agent:
        agent.consecutive_timeouts += 1

    # Update session timeout count
    game_sess = await _get_active_session(session, agent_id)
    if game_sess:
        game_sess.timeout_count += 1

    # Check if agent should be kicked for excessive timeouts
    if agent and agent.consecutive_timeouts >= settings.CONSECUTIVE_TIMEOUT_LIMIT:
        logger.warning(f"Agent {agent_id} exceeded timeout limit, will be kicked")
        # Complete the hand first, then the session will be closed by the caller
        if result.hand_complete:
            await _on_hand_complete(session, table, hand)
        # Mark for kick — caller should close the session with "timeout_exceeded"
        return

    if result.hand_complete:
        await _on_hand_complete(session, table, hand)
    else:
        await session.commit()


async def process_leave(session: AsyncSession, agent_id: str) -> dict | None:
    """Process a voluntary leave request from an agent.

    Returns session result dict or None if no active session.
    """
    game_sess = await _get_active_session(session, agent_id)
    if not game_sess:
        return None

    if game_sess.status == "queued":
        # Cancel the queued session
        from app.services import session_manager
        await session_manager.close_session(session, game_sess.id, "agent_leave")
        return {
            "hands_played": 0,
            "buy_in": game_sess.buy_in,
            "final_stack": game_sess.buy_in,  # refund
            "profit": 0,
            "elo_change": 0,
        }

    if game_sess.status == "playing":
        table = await _get_table(session, game_sess.table_id)

        # If there's an active hand, fold it first
        if table and table.id in _active_hands:
            hand = _active_hands[table.id]
            if not hand.is_complete():
                hand.apply_action(agent_id, "fold")
                if hand.is_complete():
                    await _on_hand_complete(session, table, hand)

        # Close the session
        final_stack = game_sess.final_stack if game_sess.final_stack is not None else game_sess.initial_stack
        from app.services import session_manager
        await session_manager.close_session(session, game_sess.id, "agent_leave", final_stack)

        # Close opponent session too
        if game_sess.opponent_session_id:
            opp_sess = await _get_session_by_id(session, game_sess.opponent_session_id)
            if opp_sess and opp_sess.status == "playing":
                opp_final = opp_sess.final_stack if opp_sess.final_stack is not None else opp_sess.initial_stack
                await session_manager.close_session(session, opp_sess.id, "opponent_exit", opp_final)

        # Close table
        if table and table.status == "active":
            table.status = "completed"
            table.completed_at = datetime.now(timezone.utc)
            _active_hands.pop(table.id, None)
            await session.commit()

        elo_change = (game_sess.elo_after or game_sess.elo_before or 0) - (game_sess.elo_before or 0)
        return {
            "hands_played": game_sess.hands_played,
            "buy_in": game_sess.buy_in,
            "final_stack": final_stack,
            "profit": final_stack - game_sess.buy_in,
            "elo_change": elo_change,
        }

    return None


# ------------------------------------------------------------------
# Internal helpers
# ------------------------------------------------------------------


async def _on_hand_complete(session: AsyncSession, table: Table, hand: HoldemHand) -> None:
    """Called when a hand finishes — persist result, do NOT start next hand."""
    result = hand.get_result()
    await complete_hand(session, table.id, result)


async def _get_active_session(session: AsyncSession, agent_id: str) -> GameSession | None:
    """Find the agent's active (queued or playing) session."""
    result = await session.execute(
        select(GameSession).where(
            GameSession.agent_id == agent_id,
            GameSession.status.in_(["queued", "playing"]),
        )
    )
    return result.scalar_one_or_none()


async def _get_table(session: AsyncSession, table_id: str | None) -> Table | None:
    if not table_id:
        return None
    result = await session.execute(select(Table).where(Table.id == table_id))
    return result.scalar_one_or_none()


async def _get_session_by_id(session: AsyncSession, session_id: str | None) -> GameSession | None:
    if not session_id:
        return None
    result = await session.execute(select(GameSession).where(GameSession.id == session_id))
    return result.scalar_one_or_none()


async def _count_hand_events(session: AsyncSession, hand_id: str) -> int:
    from sqlalchemy import func
    result = await session.execute(
        select(func.count()).select_from(HandEventModel).where(HandEventModel.hand_id == hand_id)
    )
    return result.scalar() or 0


def _agent_seat(table: Table, agent_id: str) -> int:
    """Determine seat number (1 or 2) from agent_id via the public engine API."""
    hand = _active_hands.get(table.id)
    if hand:
        return hand.seat_for_agent(agent_id)
    return 1


def _agent_seat_by_agent(
    table: Table,
    sess1: GameSession,
    sess2: GameSession,
    agent_id: str,
) -> int:
    """Determine seat number from agent_id given both sessions."""
    if sess1.agent_id == agent_id:
        return 1
    return 2


def _agent_to_session_id(
    sess1: GameSession,
    sess2: GameSession,
    agent_id: str | None,
) -> str | None:
    """Map agent_id to session_id."""
    if agent_id is None:
        return None
    if sess1.agent_id == agent_id:
        return sess1.id
    if sess2.agent_id == agent_id:
        return sess2.id
    return None


def _calc_profit(game_sess: GameSession) -> int:
    stack = game_sess.final_stack if game_sess.final_stack is not None else game_sess.initial_stack
    return stack - game_sess.buy_in
