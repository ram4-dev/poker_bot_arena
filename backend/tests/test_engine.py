"""Comprehensive unit tests for the Bot Arena poker engine v2.

Covers: Deck, Evaluator (hand rankings + compare_hands), and HoldemHand state machine.
"""

import pytest

from app.engine.deck import Deck, FULL_DECK
from app.engine.evaluator import (
    evaluate_hand,
    compare_hands,
    HIGH_CARD,
    PAIR,
    TWO_PAIR,
    THREE_OF_A_KIND,
    STRAIGHT,
    FLUSH,
    FULL_HOUSE,
    FOUR_OF_A_KIND,
    STRAIGHT_FLUSH,
    ROYAL_FLUSH,
)
from app.engine.holdem import HoldemHand
from app.engine.types import GamePhase


# ======================================================================
# Deck Tests
# ======================================================================

class TestDeck:
    def test_full_deck_has_52_cards(self):
        assert len(FULL_DECK) == 52

    def test_full_deck_all_unique(self):
        assert len(set(FULL_DECK)) == 52

    def test_deal_returns_correct_count(self):
        deck = Deck(seed=1)
        cards = deck.deal(5)
        assert len(cards) == 5

    def test_deal_reduces_remaining(self):
        deck = Deck(seed=1)
        assert deck.remaining() == 52
        deck.deal(5)
        assert deck.remaining() == 47

    def test_deal_all_52_cards(self):
        deck = Deck(seed=42)
        all_dealt = deck.deal(52)
        assert len(all_dealt) == 52
        assert len(set(all_dealt)) == 52
        assert deck.remaining() == 0

    def test_deal_too_many_raises_error(self):
        deck = Deck(seed=1)
        deck.deal(50)
        with pytest.raises(ValueError, match="Not enough cards"):
            deck.deal(5)

    def test_deterministic_with_same_seed(self):
        d1 = Deck(seed=99)
        d2 = Deck(seed=99)
        cards1 = d1.deal(10)
        cards2 = d2.deal(10)
        assert cards1 == cards2

    def test_different_seeds_produce_different_order(self):
        d1 = Deck(seed=1)
        d2 = Deck(seed=2)
        cards1 = d1.deal(52)
        cards2 = d2.deal(52)
        assert cards1 != cards2
        # Same set of cards though
        assert set(cards1) == set(cards2)

    def test_no_seed_is_random(self):
        """Without a seed, two decks should (almost certainly) differ."""
        d1 = Deck()
        d2 = Deck()
        cards1 = d1.deal(52)
        cards2 = d2.deal(52)
        # Astronomically unlikely to be identical
        assert cards1 != cards2

    def test_deal_one_at_a_time(self):
        deck = Deck(seed=7)
        first = deck.deal(1)
        second = deck.deal(1)
        assert first != second
        assert deck.remaining() == 50


# ======================================================================
# Evaluator Tests
# ======================================================================

class TestEvaluateHand:
    def test_royal_flush(self):
        hole = ["Ah", "Kh"]
        community = ["Qh", "Jh", "Th"]
        score, name = evaluate_hand(hole, community)
        assert name == "royal_flush"
        assert score[0] == ROYAL_FLUSH

    def test_straight_flush(self):
        hole = ["9s", "8s"]
        community = ["7s", "6s", "5s"]
        score, name = evaluate_hand(hole, community)
        assert name == "straight_flush"
        assert score[0] == STRAIGHT_FLUSH

    def test_four_of_a_kind(self):
        hole = ["Kh", "Kd"]
        community = ["Kc", "Ks", "2d"]
        score, name = evaluate_hand(hole, community)
        assert name == "four_of_a_kind"
        assert score[0] == FOUR_OF_A_KIND

    def test_full_house(self):
        hole = ["Ah", "Ad"]
        community = ["Ac", "Kh", "Kd"]
        score, name = evaluate_hand(hole, community)
        assert name == "full_house"
        assert score[0] == FULL_HOUSE

    def test_flush(self):
        hole = ["Ah", "9h"]
        community = ["6h", "3h", "2h"]
        score, name = evaluate_hand(hole, community)
        assert name == "flush"
        assert score[0] == FLUSH

    def test_straight(self):
        hole = ["9h", "8d"]
        community = ["7c", "6s", "5h"]
        score, name = evaluate_hand(hole, community)
        assert name == "straight"
        assert score[0] == STRAIGHT

    def test_ace_low_straight(self):
        hole = ["Ah", "2d"]
        community = ["3c", "4s", "5h"]
        score, name = evaluate_hand(hole, community)
        assert name == "straight"
        assert score[0] == STRAIGHT
        # High card of the ace-low straight should be 5 (value 3)
        assert score[1] == 3

    def test_three_of_a_kind(self):
        hole = ["Jh", "Jd"]
        community = ["Jc", "8s", "3h"]
        score, name = evaluate_hand(hole, community)
        assert name == "three_of_a_kind"
        assert score[0] == THREE_OF_A_KIND

    def test_two_pair(self):
        hole = ["Ah", "Kd"]
        community = ["Ac", "Ks", "7h"]
        score, name = evaluate_hand(hole, community)
        assert name == "two_pair"
        assert score[0] == TWO_PAIR

    def test_pair(self):
        hole = ["Ah", "Kd"]
        community = ["Ac", "7s", "3h"]
        score, name = evaluate_hand(hole, community)
        assert name == "pair"
        assert score[0] == PAIR

    def test_high_card(self):
        hole = ["Ah", "Kd"]
        community = ["9c", "7s", "3h"]
        score, name = evaluate_hand(hole, community)
        assert name == "high_card"
        assert score[0] == HIGH_CARD

    def test_best_five_from_six_cards(self):
        """With 6 cards (2 hole + 4 community), pick best 5."""
        hole = ["Ah", "Kh"]
        community = ["Qh", "Jh", "Th", "2d"]
        score, name = evaluate_hand(hole, community)
        assert name == "royal_flush"

    def test_fewer_than_five_cards_raises(self):
        with pytest.raises(ValueError, match="Need at least 5 cards"):
            evaluate_hand(["Ah", "Kh"], ["Qh", "Jh"])

    def test_rankings_order(self):
        """Verify that stronger hands score higher."""
        royal = evaluate_hand(["Ah", "Kh"], ["Qh", "Jh", "Th"])[0]
        straight_f = evaluate_hand(["9s", "8s"], ["7s", "6s", "5s"])[0]
        quads = evaluate_hand(["Kh", "Kd"], ["Kc", "Ks", "2d"])[0]
        full = evaluate_hand(["Ah", "Ad"], ["Ac", "Kh", "Kd"])[0]
        flush = evaluate_hand(["Ah", "9h"], ["6h", "3h", "2h"])[0]
        straight = evaluate_hand(["9h", "8d"], ["7c", "6s", "5h"])[0]
        trips = evaluate_hand(["Jh", "Jd"], ["Jc", "8s", "3h"])[0]
        two_p = evaluate_hand(["Ah", "Kd"], ["Ac", "Ks", "7h"])[0]
        pair = evaluate_hand(["Ah", "Kd"], ["Ac", "7s", "3h"])[0]
        high = evaluate_hand(["Ah", "Kd"], ["9c", "7s", "3h"])[0]

        assert royal > straight_f > quads > full > flush > straight > trips > two_p > pair > high


class TestCompareHands:
    def test_higher_hand_wins(self):
        # Flush vs pair
        result = compare_hands(
            ["Ah", "9h"], ["6h", "3h", "2h"],
            ["Kd", "Qs"],
        )
        assert result == 1

    def test_lower_hand_loses(self):
        # Pair vs flush
        result = compare_hands(
            ["Kd", "Qs"], ["6h", "3h", "2h"],
            ["Ah", "9h"],
        )
        assert result == -1

    def test_tie(self):
        # Same cards, different suits (no flush possible)
        community = ["9c", "7d", "3s"]
        result = compare_hands(["Ah", "Kd"], community, ["As", "Kc"])
        assert result == 0

    def test_kicker_breaks_tie(self):
        community = ["Ac", "7d", "3s"]
        # Both have pair of aces, but different kickers
        result = compare_hands(["Ah", "Kd"], community, ["As", "Qc"])
        assert result == 1  # King kicker beats Queen kicker


# ======================================================================
# HoldemHand Tests
# ======================================================================

def _make_hand(
    stack1=1000, stack2=1000, sb=10, bb=20, seed=42, dealer_seat=1
):
    """Helper to create a HoldemHand with sensible defaults."""
    return HoldemHand(
        hand_id="test-hand-1",
        agent1_id="bot_a",
        agent2_id="bot_b",
        stack1=stack1,
        stack2=stack2,
        small_blind=sb,
        big_blind=bb,
        dealer_seat=dealer_seat,
        seed=seed,
    )


class TestHoldemHandInit:
    def test_blinds_posted_correctly(self):
        hand = _make_hand(stack1=1000, stack2=1000, sb=10, bb=20)
        # dealer_seat=1 => bot_a is dealer/SB, bot_b is BB
        state_a = hand.get_state("bot_a")
        state_b = hand.get_state("bot_b")

        # Stacks reduced by blinds
        assert state_a.my_stack == 990   # posted SB=10
        assert state_b.my_stack == 980   # posted BB=20
        # Pot = SB + BB
        assert state_a.pot == 30
        assert state_b.pot == 30

    def test_positions_assigned(self):
        hand = _make_hand(dealer_seat=1)
        state_a = hand.get_state("bot_a")
        state_b = hand.get_state("bot_b")
        assert state_a.my_position == "dealer"
        assert state_b.my_position == "big_blind"

    def test_positions_swapped_when_dealer_seat_2(self):
        hand = _make_hand(dealer_seat=2)
        state_a = hand.get_state("bot_a")
        state_b = hand.get_state("bot_b")
        assert state_a.my_position == "big_blind"
        assert state_b.my_position == "dealer"

    def test_hole_cards_dealt(self):
        hand = _make_hand()
        state_a = hand.get_state("bot_a")
        state_b = hand.get_state("bot_b")
        assert len(state_a.my_cards) == 2
        assert len(state_b.my_cards) == 2
        # No overlap
        assert set(state_a.my_cards).isdisjoint(set(state_b.my_cards))

    def test_initial_phase_is_preflop(self):
        hand = _make_hand()
        state = hand.get_state("bot_a")
        assert state.phase == "preflop"

    def test_no_community_cards_preflop(self):
        hand = _make_hand()
        state = hand.get_state("bot_a")
        assert state.community_cards == []

    def test_dealer_acts_first_preflop(self):
        hand = _make_hand(dealer_seat=1)
        # bot_a is dealer/SB, should act first preflop
        assert hand._current_actor == "bot_a"


class TestGetStateHidesOpponentCards:
    def test_opponent_cards_not_visible(self):
        hand = _make_hand()
        state_a = hand.get_state("bot_a")
        state_b = hand.get_state("bot_b")
        # Each player sees their own cards but not the opponent's
        # The GameState only has my_cards, no opponent cards field
        assert len(state_a.my_cards) == 2
        assert len(state_b.my_cards) == 2
        assert state_a.my_cards != state_b.my_cards

    def test_unknown_agent_raises(self):
        hand = _make_hand()
        with pytest.raises(ValueError, match="Unknown agent"):
            hand.get_state("unknown_bot")


class TestActionValidation:
    def test_check_with_pending_bet_errors(self):
        hand = _make_hand()
        # Preflop, dealer acts first. SB=10, BB=20, so dealer owes 10 to call.
        result = hand.apply_action("bot_a", "check")
        assert result.valid is False
        assert "Cannot check" in result.error

    def test_call_when_nothing_to_call_errors(self):
        hand = _make_hand()
        # Dealer calls (to match BB)
        hand.apply_action("bot_a", "call")
        # BB now has no pending bet (bets are equal), so call is invalid
        result = hand.apply_action("bot_b", "call")
        assert result.valid is False
        assert "Nothing to call" in result.error

    def test_raise_below_min_errors(self):
        hand = _make_hand(sb=10, bb=20)
        # Dealer tries to raise to 25 (raise portion = 25 - 10 - 10 = 5, min_raise = 20)
        result = hand.apply_action("bot_a", "raise", amount=25)
        assert result.valid is False
        assert "Raise must be at least" in result.error

    def test_raise_more_than_stack_errors(self):
        hand = _make_hand(stack1=100, sb=10, bb=20)
        # bot_a has 90 left after SB. Raise to 200 costs 190 but stack is 90.
        result = hand.apply_action("bot_a", "raise", amount=200)
        assert result.valid is False
        assert "costs" in result.error

    def test_wrong_turn_errors(self):
        hand = _make_hand(dealer_seat=1)
        # bot_b tries to act but it's bot_a's turn
        result = hand.apply_action("bot_b", "fold")
        assert result.valid is False
        assert "Not your turn" in result.error

    def test_action_after_complete_errors(self):
        hand = _make_hand()
        hand.apply_action("bot_a", "fold")
        assert hand.is_complete()
        result = hand.apply_action("bot_b", "check")
        assert result.valid is False
        assert "Hand is complete" in result.error

    def test_unknown_action_errors(self):
        hand = _make_hand()
        result = hand.apply_action("bot_a", "banana")
        assert result.valid is False
        assert "Unknown action" in result.error


class TestFoldScenario:
    def test_fold_preflop(self):
        hand = _make_hand(stack1=1000, stack2=1000, sb=10, bb=20)
        result = hand.apply_action("bot_a", "fold")
        assert result.valid is True
        assert result.hand_complete is True
        assert hand.is_complete()

        hr = hand.get_result()
        assert hr.winner_agent_id == "bot_b"
        # BB wins the pot (SB + BB = 30)
        assert hr.pot == 30
        assert hr.player1_stack_after == 990   # lost SB
        assert hr.player2_stack_after == 1010  # gained pot (980 + 30)

    def test_fold_on_flop(self):
        hand = _make_hand(sb=10, bb=20, seed=42)
        # Preflop: dealer calls, BB checks
        hand.apply_action("bot_a", "call")
        hand.apply_action("bot_b", "check")
        # Now on flop, BB acts first
        state = hand.get_state("bot_b")
        assert state.phase == "flop"
        assert len(state.community_cards) == 3

        # BB folds on flop
        result = hand.apply_action("bot_b", "fold")
        assert result.valid is True
        assert result.hand_complete is True

        hr = hand.get_result()
        assert hr.winner_agent_id == "bot_a"
        # Pot was 40 (20+20 from preflop)
        assert hr.pot == 40


class TestRaiseAndCallFlow:
    def test_raise_then_call(self):
        hand = _make_hand(sb=10, bb=20, seed=42)
        # Dealer raises to 50 (raise portion = 50 - 10 - 10 = 30 >= 20 min_raise)
        result = hand.apply_action("bot_a", "raise", amount=50)
        assert result.valid is True
        assert result.next_actor == "bot_b"

        # BB calls (owes 50 - 20 = 30)
        result = hand.apply_action("bot_b", "call")
        assert result.valid is True
        # Moved to flop
        state = hand.get_state("bot_b")
        assert state.phase == "flop"
        assert state.pot == 100  # 50 + 50

    def test_raise_reraise_call(self):
        hand = _make_hand(sb=10, bb=20, seed=42)
        # Dealer raises to 50
        hand.apply_action("bot_a", "raise", amount=50)
        # BB re-raises to 120 (raise portion = 120 - 50 = 70, min_raise was 30)
        result = hand.apply_action("bot_b", "raise", amount=120)
        assert result.valid is True
        assert result.next_actor == "bot_a"

        # Dealer calls
        result = hand.apply_action("bot_a", "call")
        assert result.valid is True
        state = hand.get_state("bot_a")
        assert state.phase == "flop"
        assert state.pot == 240  # 120 + 120


class TestPhaseTransitions:
    def _play_to_flop(self, hand):
        """Helper: play through preflop with call-check."""
        hand.apply_action("bot_a", "call")    # dealer calls BB
        hand.apply_action("bot_b", "check")   # BB checks

    def _play_to_river(self, hand):
        """Helper: play through preflop + flop."""
        self._play_to_flop(hand)
        hand.apply_action("bot_b", "check")   # BB checks flop
        hand.apply_action("bot_a", "check")   # dealer checks flop

    def test_preflop_to_flop_deals_3_community_cards(self):
        hand = _make_hand(seed=42)
        self._play_to_flop(hand)
        state = hand.get_state("bot_a")
        assert state.phase == "flop"
        assert len(state.community_cards) == 3

    def test_flop_to_river_deals_4th_card(self):
        hand = _make_hand(seed=42)
        self._play_to_river(hand)
        state = hand.get_state("bot_a")
        assert state.phase == "river"
        assert len(state.community_cards) == 4

    def test_river_to_showdown_and_complete(self):
        hand = _make_hand(seed=42)
        self._play_to_river(hand)
        # River: BB checks, dealer checks
        hand.apply_action("bot_b", "check")
        hand.apply_action("bot_a", "check")
        assert hand.is_complete()

    def test_bb_acts_first_postflop(self):
        hand = _make_hand(seed=42, dealer_seat=1)
        self._play_to_flop(hand)
        # After flop, BB (bot_b) acts first
        assert hand._current_actor == "bot_b"


class TestFullPlaythrough:
    def test_check_check_all_streets_to_showdown(self):
        """Play a full hand: call preflop, check all streets to showdown."""
        hand = _make_hand(stack1=1000, stack2=1000, sb=10, bb=20, seed=42)

        # Preflop: dealer calls, BB checks
        hand.apply_action("bot_a", "call")
        hand.apply_action("bot_b", "check")
        assert hand.get_state("bot_a").phase == "flop"

        # Flop: BB checks, dealer checks
        hand.apply_action("bot_b", "check")
        hand.apply_action("bot_a", "check")
        assert hand.get_state("bot_a").phase == "river"

        # River: BB checks, dealer checks
        hand.apply_action("bot_b", "check")
        hand.apply_action("bot_a", "check")
        assert hand.is_complete()

        hr = hand.get_result()
        assert hr.pot == 40  # 20 + 20
        assert len(hr.community_cards) == 4
        assert len(hr.player1_hole_cards) == 2
        assert len(hr.player2_hole_cards) == 2

        # Total chips conserved
        assert hr.player1_stack_after + hr.player2_stack_after == 2000

        # Winner gets the pot (or split in tie)
        if hr.winner_agent_id == "bot_a":
            assert hr.player1_stack_after == 1020
            assert hr.player2_stack_after == 980
        elif hr.winner_agent_id == "bot_b":
            assert hr.player1_stack_after == 980
            assert hr.player2_stack_after == 1020
        else:
            # Tie: split pot
            assert hr.player1_stack_after == 1000
            assert hr.player2_stack_after == 1000

    def test_result_has_winning_hand_rank(self):
        hand = _make_hand(seed=42)
        hand.apply_action("bot_a", "call")
        hand.apply_action("bot_b", "check")
        hand.apply_action("bot_b", "check")
        hand.apply_action("bot_a", "check")
        hand.apply_action("bot_b", "check")
        hand.apply_action("bot_a", "check")
        assert hand.is_complete()
        hr = hand.get_result()
        # If there's a winner (not fold), winning_hand_rank should be a string
        if hr.winner_agent_id:
            assert hr.winning_hand_rank is not None
            assert isinstance(hr.winning_hand_rank, str)

    def test_result_before_complete_raises(self):
        hand = _make_hand()
        with pytest.raises(RuntimeError, match="Hand is not complete"):
            hand.get_result()


class TestPotCalculation:
    def test_pot_after_blinds(self):
        hand = _make_hand(sb=10, bb=20)
        assert hand.get_state("bot_a").pot == 30

    def test_pot_after_call_preflop(self):
        hand = _make_hand(sb=10, bb=20)
        hand.apply_action("bot_a", "call")  # pays 10 more
        assert hand.get_state("bot_a").pot == 40

    def test_pot_after_raise_and_call(self):
        hand = _make_hand(sb=10, bb=20)
        hand.apply_action("bot_a", "raise", amount=50)  # pays 40 more (50-10)
        # pot = 10 + 20 + 40 = 70
        assert hand.get_state("bot_a").pot == 70
        hand.apply_action("bot_b", "call")  # pays 30 more (50-20)
        # pot = 70 + 30 = 100
        assert hand.get_state("bot_a").pot == 100

    def test_chips_conservation_after_fold(self):
        hand = _make_hand(stack1=500, stack2=500, sb=10, bb=20)
        hand.apply_action("bot_a", "fold")
        hr = hand.get_result()
        assert hr.player1_stack_after + hr.player2_stack_after == 1000


class TestAllInScenario:
    def test_all_in_preflop_goes_to_showdown(self):
        hand = _make_hand(stack1=1000, stack2=1000, sb=10, bb=20, seed=42)
        result = hand.apply_action("bot_a", "all_in")
        assert result.valid is True

        # BB must respond
        result = hand.apply_action("bot_b", "call")
        assert result.valid is True
        assert hand.is_complete()

        hr = hand.get_result()
        assert hr.pot == 2000
        assert len(hr.community_cards) == 4
        assert hr.player1_stack_after + hr.player2_stack_after == 2000

    def test_all_in_short_stack(self):
        hand = _make_hand(stack1=50, stack2=1000, sb=10, bb=20, seed=42)
        # bot_a has 40 left after SB
        result = hand.apply_action("bot_a", "all_in")
        assert result.valid is True

        result = hand.apply_action("bot_b", "call")
        assert result.valid is True
        assert hand.is_complete()

        hr = hand.get_result()
        # Pot = 50 (all-in) + call amount from BB
        assert hr.player1_stack_after + hr.player2_stack_after == 1050

    def test_all_in_via_call_short_stack(self):
        """If a player calls with their entire remaining stack, they are all-in
        and the opponent still gets a chance to act before round ends."""
        hand = _make_hand(stack1=20, stack2=1000, sb=10, bb=20, seed=42)
        # bot_a posted SB=10, has 10 left. Call costs 10 => auto all-in via call
        result = hand.apply_action("bot_a", "call")
        assert result.valid is True
        assert hand._players["bot_a"]["is_all_in"] is True
        # BB still needs to act (check, since bets are equal)
        assert hand._current_actor == "bot_b"
        result = hand.apply_action("bot_b", "check")
        assert result.valid is True
        # Now the hand runs out to showdown since bot_a is all-in
        assert hand.is_complete()

    def test_raise_equal_to_stack_treated_as_all_in(self):
        hand = _make_hand(stack1=100, stack2=1000, sb=10, bb=20, seed=42)
        # bot_a has 90 after SB. Raise to 100 costs 90 = entire stack => all-in
        result = hand.apply_action("bot_a", "raise", amount=100)
        assert result.valid is True
        # Verify player is all-in
        assert hand._players["bot_a"]["is_all_in"] is True
        assert hand._players["bot_a"]["stack"] == 0

    def test_both_all_in_from_blinds(self):
        """When both players are all-in from blinds, hand skips to showdown."""
        hand = _make_hand(stack1=10, stack2=20, sb=10, bb=20, seed=42)
        assert hand.is_complete()
        result = hand.get_result()
        assert result.pot == 30  # SB all-in 10, BB posts 20
        assert result.winner_agent_id is not None or result.pot > 0


class TestHandHistory:
    def test_events_recorded(self):
        hand = _make_hand(sb=10, bb=20, seed=42)
        hand.apply_action("bot_a", "call")
        hand.apply_action("bot_b", "check")
        # At least blind posts + call + check
        events = hand._events
        actions = [e["action"] for e in events]
        assert "post_sb" in actions
        assert "post_bb" in actions
        assert "call" in actions
        assert "check" in actions

    def test_current_bet_shown_correctly(self):
        hand = _make_hand(sb=10, bb=20, seed=42)
        state_a = hand.get_state("bot_a")
        # Dealer sees amount_to_call = BB(20) - SB(10) = 10
        assert state_a.current_bet == 10

        hand.apply_action("bot_a", "call")
        state_b = hand.get_state("bot_b")
        # BB: bets are now equal, current_bet = 0
        assert state_b.current_bet == 0
