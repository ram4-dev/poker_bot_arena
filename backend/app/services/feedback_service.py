from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.session import Session as GameSession
from app.models.hand import Hand, HandEvent


TEMPLATES = {
    "big_pot_win": "Won a {pot_size}-chip pot on hand #{hand} with {winning_hand}.",
    "bluff_success": "Successful bluff on hand #{hand}: opponent folded to a {amount}-chip bet on {street}.",
    "all_in_win": "All-in on hand #{hand}: won with {winning_hand}. Pot: {pot_size}.",
    "big_pot_loss": "Lost {pot_size}-chip pot on hand #{hand} due to aggressive play on {street}.",
    "all_in_loss": "Lost all-in on hand #{hand}. Pot: {pot_size} chips.",
    "fold_exploited": "Opponent exploited high fold rate with frequent raises ({fold_count} folds in {total_hands} hands).",
    "aggression_paid": "Consistent aggression forced {fold_count} opponent folds, capturing {total_won} chips without showdown.",
    "left_up": "Left the table at {multiplier}x buy-in ({final_stack} chips). Threshold up reached.",
    "left_down": "Retreated at {multiplier}x buy-in ({final_stack} chips). Threshold down reached.",
    "busted": "Stack reached 0 on hand #{hand}. Full buy-in lost.",
    "max_hands": "Session complete: {hands_played} hands played (limit reached).",
    "comeback": "Key recovery on hand #{hand}: won {pot_size} chips from a short stack.",
    "passive_loss": "Passive play on {street_count} postflop hands resulted in small wins and large losses.",
}


async def generate_feedback(session: AsyncSession, game_session: GameSession) -> dict:
    """Generate complete feedback for a session."""
    hands = (await session.execute(
        select(Hand)
        .where(Hand.session_1_id == game_session.id)
        .options(selectinload(Hand.events))
        .order_by(Hand.hand_number)
    )).scalars().all()

    if not hands:
        # Try session_2_id
        hands = (await session.execute(
            select(Hand)
            .where(Hand.session_2_id == game_session.id)
            .options(selectinload(Hand.events))
            .order_by(Hand.hand_number)
        )).scalars().all()

    key_events = _select_key_events(hands, game_session)
    performance = _generate_performance(hands, game_session)
    insights = _analyze_patterns(hands, game_session)

    return {
        "key_events": key_events,
        "performance": performance,
        "insights": insights,
    }


def _select_key_events(hands: list, game_session) -> list[dict]:
    """Select 3-5 most impactful events by pot size."""
    events = []

    # Sort hands by pot size desc
    sorted_hands = sorted(hands, key=lambda h: h.pot, reverse=True)

    for hand in sorted_hands[:5]:
        is_winner = hand.winner_session_id == game_session.id
        impact = "positive" if is_winner else "negative"

        if hand.pot > 0:
            if is_winner:
                desc = TEMPLATES["big_pot_win"].format(
                    pot_size=hand.pot, hand=hand.hand_number,
                    winning_hand=hand.winning_hand_rank or "best hand"
                )
                event_type = "big_pot_win"
            else:
                desc = TEMPLATES["big_pot_loss"].format(
                    pot_size=hand.pot, hand=hand.hand_number, street="river"
                )
                event_type = "big_pot_loss"

            events.append({
                "hand_number": hand.hand_number,
                "type": event_type,
                "description": desc,
                "impact": impact,
            })

    # Add exit reason event
    if game_session.exit_reason == "stack_zero":
        events.append({
            "hand_number": game_session.hands_played,
            "type": "busted",
            "description": TEMPLATES["busted"].format(hand=game_session.hands_played),
            "impact": "negative",
        })
    elif game_session.exit_reason == "threshold_up":
        events.append({
            "hand_number": game_session.hands_played,
            "type": "left_up",
            "description": TEMPLATES["left_up"].format(
                multiplier=round((game_session.final_stack or 0) / game_session.buy_in, 1) if game_session.buy_in > 0 else 0,
                final_stack=game_session.final_stack or 0,
            ),
            "impact": "positive",
        })

    return events[:5]


def _generate_performance(hands: list, game_session) -> list[dict]:
    """Generate per-hand profit data for bar chart."""
    perf = []
    prev_stack = game_session.initial_stack
    is_seat_1 = True  # Assume seat 1 initially

    for hand in hands:
        if hand.session_1_id == game_session.id:
            current = hand.player_1_stack_after
        else:
            current = hand.player_2_stack_after

        profit = current - prev_stack
        perf.append({"hand": hand.hand_number, "profit": profit})
        prev_stack = current

    return perf


def _analyze_patterns(hands: list, game_session) -> dict | None:
    """Analyze action patterns to generate insights."""
    if not hands:
        return None

    total_hands = len(hands)
    wins = sum(1 for h in hands if h.winner_session_id == game_session.id)
    winrate = wins / total_hands if total_hands > 0 else 0

    # Count actions from events
    fold_count = 0
    raise_count = 0
    total_actions = 0

    for hand in hands:
        for event in hand.events:
            # Determine if this is our player
            is_seat_1 = hand.session_1_id == game_session.id
            our_seat = 1 if is_seat_1 else 2
            if event.player_seat == our_seat:
                total_actions += 1
                if event.action == "fold":
                    fold_count += 1
                elif event.action in ("raise", "all_in"):
                    raise_count += 1

    fold_rate = fold_count / total_actions if total_actions > 0 else 0
    aggression_rate = raise_count / total_actions if total_actions > 0 else 0

    # Generate insights
    if winrate > 0.6:
        strength = f"Strong performance with {round(winrate * 100)}% win rate across {total_hands} hands."
    elif aggression_rate > 0.3:
        strength = f"Aggressive play forced opponents into difficult decisions ({round(aggression_rate * 100)}% raise rate)."
    else:
        strength = f"Played {total_hands} hands with a balanced approach."

    if fold_rate > 0.4:
        vulnerability = f"High fold rate ({round(fold_rate * 100)}%) may allow opponents to exploit with frequent raises."
        advisory = "Consider reducing fold_to_pressure to be less exploitable against aggressive opponents."
    elif aggression_rate < 0.15:
        vulnerability = f"Low aggression ({round(aggression_rate * 100)}% raise rate) makes play predictable."
        advisory = "Consider increasing aggression and bluff_frequency to be less predictable."
    else:
        vulnerability = "No significant vulnerabilities detected in this session."
        advisory = "Continue refining the current strategy based on matchup results."

    return {
        "strength": strength,
        "vulnerability": vulnerability,
        "advisory": advisory,
    }
