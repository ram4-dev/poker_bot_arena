import asyncio
import random

from pypokerengine.api.game import setup_config, start_poker

from app.engine.types import BotConfig, HandResult, HandEvent, SessionResult
from app.engine.configurable_bot import ConfigurableBot
from app.engine.hand_evaluator import get_hand_rank_name


def run_session(
    config_1: BotConfig,
    config_2: BotConfig,
    buy_in: int,
    small_blind: int,
    big_blind: int,
    max_hands: int | None = None,
    seed: int | None = None,
) -> SessionResult:
    if seed is not None:
        random.seed(seed)

    action_counter = [0]  # shared counter — resets per hand in loop below
    bot_1 = ConfigurableBot(config_1, name="player_1", action_counter=action_counter)
    bot_2 = ConfigurableBot(config_2, name="player_2", action_counter=action_counter)

    stack_1 = buy_in
    stack_2 = buy_in
    hand_results: list[HandResult] = []
    exit_reason = "max_hands"

    effective_max = max_hands or min(config_1.session_max_hands, config_2.session_max_hands)

    for hand_num in range(1, effective_max + 1):
        if stack_1 <= 0 or stack_2 <= 0:
            exit_reason = "stack_zero"
            break

        # Minimum stacks needed: at least big blind
        if stack_1 < big_blind or stack_2 < big_blind:
            exit_reason = "stack_zero"
            break

        action_counter[0] = 0  # reset per hand
        bot_1.set_context(hand_num, buy_in)
        bot_2.set_context(hand_num, buy_in)

        # Setup one hand
        game_config = setup_config(
            max_round=1,
            initial_stack=max(stack_1, stack_2),  # PyPokerEngine needs same stacks
            small_blind_amount=small_blind,
        )
        game_config.register_player(name="player_1", algorithm=bot_1)
        game_config.register_player(name="player_2", algorithm=bot_2)

        # PyPokerEngine requires equal initial stacks, so we track real stacks ourselves
        result = start_poker(game_config, verbose=0)

        # Extract results from PyPokerEngine
        players = result.get("players", {})
        p1_info = None
        p2_info = None
        for p in players.values() if isinstance(players, dict) else players:
            if isinstance(p, dict):
                if p.get("name") == "player_1":
                    p1_info = p
                elif p.get("name") == "player_2":
                    p2_info = p

        # Calculate delta from the PyPokerEngine result
        if p1_info and p2_info:
            p1_result_stack = p1_info.get("stack", max(stack_1, stack_2))
            p2_result_stack = p2_info.get("stack", max(stack_1, stack_2))
            initial = max(stack_1, stack_2)
            p1_delta = p1_result_stack - initial
            p2_delta = p2_result_stack - initial
        else:
            p1_delta = 0
            p2_delta = 0

        # Apply deltas to real stacks
        stack_1 += p1_delta
        stack_2 += p2_delta

        # Ensure non-negative
        stack_1 = max(0, stack_1)
        stack_2 = max(0, stack_2)

        # Determine winner
        if p1_delta > 0:
            winner = "player_1"
        elif p2_delta > 0:
            winner = "player_2"
        else:
            winner = "draw"

        pot = abs(p1_delta) + abs(p2_delta) if p1_delta != 0 else 0

        # Capture community cards and hole cards before clearing events
        community_cards = bot_1.get_community_cards()
        p1_hole = list(bot_1._hole_card) if bot_1._hole_card else []
        p2_hole = list(bot_2._hole_card) if bot_2._hole_card else []

        # Collect events from bots — sort by global_seq to get real action order
        events_1 = bot_1.get_events()
        events_2 = bot_2.get_events()
        all_events = []
        for e in sorted(events_1 + events_2, key=lambda x: x["global_seq"]):
            all_events.append(HandEvent(
                hand_number=e["hand_number"],
                street=e["street"],
                player=e["player"],
                action=e["action"],
                amount=e["amount"],
                pot_after=e["pot_after"],
                stack_after=e["stack_after"],
                hand_strength=e.get("hand_strength", 0.0),
                hole_cards=e.get("hole_cards", []),
            ))

        # Winning hand rank (requires community cards)
        winning_hand_rank = None
        if community_cards:
            winner_hole = p1_hole if winner == "player_1" else p2_hole
            winning_hand_rank = get_hand_rank_name(winner_hole, community_cards) if winner_hole else None

        hand_result = HandResult(
            hand_number=hand_num,
            winner=winner,
            pot=pot,
            player_1_stack=stack_1,
            player_2_stack=stack_2,
            events=all_events,
            community_cards=community_cards,
            player_1_hole=p1_hole,
            player_2_hole=p2_hole,
            winning_hand_rank=winning_hand_rank,
        )
        hand_results.append(hand_result)

        # Check exit conditions (only after min_hands_before_leave)
        if hand_num >= config_1.min_hands_before_leave:
            if buy_in > 0 and stack_1 >= buy_in * config_1.leave_threshold_up:
                exit_reason = "threshold_up"
                break
            if buy_in > 0 and stack_1 <= buy_in * config_1.leave_threshold_down:
                exit_reason = "threshold_down"
                break

        if hand_num >= config_2.min_hands_before_leave:
            if buy_in > 0 and stack_2 >= buy_in * config_2.leave_threshold_up:
                exit_reason = "threshold_up"
                break
            if buy_in > 0 and stack_2 <= buy_in * config_2.leave_threshold_down:
                exit_reason = "threshold_down"
                break

    return SessionResult(
        hands_played=len(hand_results),
        player_1_final_stack=stack_1,
        player_2_final_stack=stack_2,
        hand_results=hand_results,
        exit_reason=exit_reason,
        player_1_config=config_1,
        player_2_config=config_2,
    )


async def run_session_async(
    config_1: BotConfig,
    config_2: BotConfig,
    buy_in: int,
    small_blind: int,
    big_blind: int,
    max_hands: int | None = None,
    seed: int | None = None,
) -> SessionResult:
    return await asyncio.to_thread(
        run_session, config_1, config_2, buy_in, small_blind, big_blind, max_hands, seed
    )
