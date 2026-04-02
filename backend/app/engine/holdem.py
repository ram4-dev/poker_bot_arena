"""HoldemHand — state machine for one hand of heads-up simplified Hold'em.

3-street variant: preflop -> flop -> river (no turn).
Designed for API-driven play: each action comes from an external call.
"""

from app.engine.deck import Deck
from app.engine.evaluator import evaluate_hand, compare_hands
from app.engine.types import (
    GamePhase,
    GameState,
    ActionResult,
    HandResult,
)


class HoldemHand:
    """State machine for a single hand of heads-up simplified Hold'em."""

    def __init__(
        self,
        hand_id: str,
        agent1_id: str,
        agent2_id: str,
        stack1: int,
        stack2: int,
        small_blind: int,
        big_blind: int,
        dealer_seat: int = 1,
        seed: int | None = None,
    ):
        self.hand_id = hand_id
        self._agent1_id = agent1_id
        self._agent2_id = agent2_id
        self._small_blind = small_blind
        self._big_blind = big_blind

        # Dealer/SB and BB assignment (heads-up: dealer = SB)
        if dealer_seat == 1:
            dealer_id = agent1_id
            bb_id = agent2_id
        else:
            dealer_id = agent2_id
            bb_id = agent1_id

        self._dealer_id = dealer_id
        self._bb_id = bb_id

        self._deck = Deck(seed=seed)
        self._community_cards: list[str] = []
        self._phase = GamePhase.PREFLOP
        self._pot = 0
        self._events: list[dict] = []
        self._hand_history: list[dict] = []
        self._winner_id: str | None = None
        self._folded_id: str | None = None

        # Player state keyed by agent_id
        self._players: dict[str, dict] = {
            agent1_id: {
                "hole_cards": [],
                "stack": stack1,
                "bet_this_round": 0,
                "has_acted": False,
                "is_all_in": False,
                "seat": 1,
            },
            agent2_id: {
                "hole_cards": [],
                "stack": stack2,
                "bet_this_round": 0,
                "has_acted": False,
                "is_all_in": False,
                "seat": 2,
            },
        }

        self._current_actor: str | None = None
        self._last_raiser: str | None = None
        self._min_raise: int = big_blind

        # Deal hole cards
        self._players[agent1_id]["hole_cards"] = self._deck.deal(2)
        self._players[agent2_id]["hole_cards"] = self._deck.deal(2)

        # Post blinds
        self._post_blinds()

        # Preflop: dealer/SB acts first
        self._current_actor = self._dealer_id

    # ------------------------------------------------------------------
    # Blind posting
    # ------------------------------------------------------------------

    def _post_blinds(self) -> None:
        """Post small and big blinds, deducting from stacks."""
        sb_player = self._players[self._dealer_id]
        bb_player = self._players[self._bb_id]

        # SB posts (may be all-in if stack < small_blind)
        sb_amount = min(self._small_blind, sb_player["stack"])
        sb_player["stack"] -= sb_amount
        sb_player["bet_this_round"] = sb_amount
        if sb_player["stack"] == 0:
            sb_player["is_all_in"] = True

        # BB posts
        bb_amount = min(self._big_blind, bb_player["stack"])
        bb_player["stack"] -= bb_amount
        bb_player["bet_this_round"] = bb_amount
        if bb_player["stack"] == 0:
            bb_player["is_all_in"] = True

        self._pot = sb_amount + bb_amount

        self._events.append({
            "phase": GamePhase.PREFLOP.value,
            "agent_id": self._dealer_id,
            "action": "post_sb",
            "amount": sb_amount,
            "pot_after": sb_amount,
        })
        self._events.append({
            "phase": GamePhase.PREFLOP.value,
            "agent_id": self._bb_id,
            "action": "post_bb",
            "amount": bb_amount,
            "pot_after": self._pot,
        })

        # If both all-in from blinds, skip to showdown
        if sb_player["is_all_in"] and bb_player["is_all_in"]:
            self._current_actor = None
            self._skip_to_showdown()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_state(self, agent_id: str) -> GameState:
        """Return the game state from this agent's perspective."""
        if agent_id not in self._players:
            raise ValueError(f"Unknown agent: {agent_id}")

        me = self._players[agent_id]
        opponent_id = self._other(agent_id)
        opp = self._players[opponent_id]

        position = "dealer" if agent_id == self._dealer_id else "big_blind"

        amount_to_call = max(0, opp["bet_this_round"] - me["bet_this_round"])
        # Can't call more than our stack
        amount_to_call = min(amount_to_call, me["stack"])

        return GameState(
            hand_id=self.hand_id,
            phase=self._phase.value,
            my_cards=list(me["hole_cards"]),
            community_cards=list(self._community_cards),
            my_stack=me["stack"],
            opponent_stack=opp["stack"],
            pot=self._pot,
            my_position=position,
            current_bet=amount_to_call,
            min_raise=self._min_raise,
            actions_this_round=self._get_actions_this_round(),
            hand_history=list(self._hand_history),
            session={},
        )

    def apply_action(
        self, agent_id: str, action: str, amount: int = 0
    ) -> ActionResult:
        """Validate and apply a player action.

        Returns an ActionResult indicating success/failure and next state.
        """
        # Basic validation
        if self._phase in (GamePhase.SHOWDOWN, GamePhase.COMPLETE):
            return ActionResult(valid=False, error="Hand is complete")

        if agent_id != self._current_actor:
            return ActionResult(
                valid=False,
                error=f"Not your turn. Current actor: {self._current_actor}",
            )

        me = self._players[agent_id]
        opponent_id = self._other(agent_id)
        opp = self._players[opponent_id]

        amount_to_call = max(0, opp["bet_this_round"] - me["bet_this_round"])

        # Validate and normalize action
        action_lower = action.lower()

        if action_lower == "fold":
            return self._do_fold(agent_id)

        elif action_lower == "check":
            if amount_to_call > 0:
                return ActionResult(
                    valid=False,
                    error=f"Cannot check: must call {amount_to_call} or fold",
                )
            return self._do_check(agent_id)

        elif action_lower == "call":
            if amount_to_call == 0:
                return ActionResult(
                    valid=False,
                    error="Nothing to call. Use check instead.",
                )
            return self._do_call(agent_id)

        elif action_lower == "raise":
            return self._do_raise(agent_id, amount)

        elif action_lower == "all_in":
            return self._do_all_in(agent_id)

        else:
            return ActionResult(valid=False, error=f"Unknown action: {action}")

    def is_complete(self) -> bool:
        return self._phase == GamePhase.COMPLETE

    def get_result(self) -> HandResult:
        """Get the hand result. Only valid after hand is complete."""
        if self._phase != GamePhase.COMPLETE:
            raise RuntimeError("Hand is not complete yet")

        p1 = self._players[self._agent1_id]
        p2 = self._players[self._agent2_id]

        # Determine winning hand rank
        winning_rank = None
        if self._winner_id and not self._folded_id and self._community_cards:
            winner = self._players[self._winner_id]
            _, winning_rank = evaluate_hand(
                winner["hole_cards"], self._community_cards
            )

        return HandResult(
            hand_id=self.hand_id,
            winner_agent_id=self._winner_id,
            pot=self._pot,
            player1_stack_after=p1["stack"],
            player2_stack_after=p2["stack"],
            community_cards=list(self._community_cards),
            player1_hole_cards=list(p1["hole_cards"]),
            player2_hole_cards=list(p2["hole_cards"]),
            winning_hand_rank=winning_rank,
            events=list(self._events),
        )

    # ------------------------------------------------------------------
    # Action implementations
    # ------------------------------------------------------------------

    def _do_fold(self, agent_id: str) -> ActionResult:
        opponent_id = self._other(agent_id)
        self._folded_id = agent_id

        self._record_event(agent_id, "fold", 0)

        # Award pot to opponent
        self._players[opponent_id]["stack"] += self._pot
        self._winner_id = opponent_id
        self._phase = GamePhase.COMPLETE
        self._current_actor = None

        return ActionResult(valid=True, hand_complete=True)

    def _do_check(self, agent_id: str) -> ActionResult:
        me = self._players[agent_id]
        me["has_acted"] = True

        self._record_event(agent_id, "check", 0)

        return self._after_action(agent_id)

    def _do_call(self, agent_id: str) -> ActionResult:
        me = self._players[agent_id]
        opponent_id = self._other(agent_id)
        opp = self._players[opponent_id]

        amount_to_call = opp["bet_this_round"] - me["bet_this_round"]

        # Auto all-in if can't afford full call
        actual_call = min(amount_to_call, me["stack"])
        me["stack"] -= actual_call
        me["bet_this_round"] += actual_call
        self._pot += actual_call
        me["has_acted"] = True

        if me["stack"] == 0:
            me["is_all_in"] = True

        self._record_event(agent_id, "call", actual_call)

        return self._after_action(agent_id)

    def _do_raise(self, agent_id: str, amount: int) -> ActionResult:
        me = self._players[agent_id]
        opponent_id = self._other(agent_id)
        opp = self._players[opponent_id]

        amount_to_call = max(0, opp["bet_this_round"] - me["bet_this_round"])

        # "amount" is the TOTAL raise-to size (total bet for this round)
        # Validate: the raise portion must be >= min_raise
        raise_portion = amount - me["bet_this_round"] - amount_to_call
        total_cost = amount - me["bet_this_round"]

        # If amount equals stack, treat as all-in (skip min_raise check)
        if total_cost == me["stack"]:
            return self._do_all_in(agent_id)

        if total_cost > me["stack"]:
            return ActionResult(
                valid=False,
                error=f"Raise to {amount} costs {total_cost} but stack is {me['stack']}",
            )

        if raise_portion < self._min_raise:
            return ActionResult(
                valid=False,
                error=f"Raise must be at least {self._min_raise} more than the call. "
                      f"Min raise-to: {me['bet_this_round'] + amount_to_call + self._min_raise}",
            )

        me["stack"] -= total_cost
        me["bet_this_round"] = amount
        self._pot += total_cost
        me["has_acted"] = True
        self._last_raiser = agent_id
        self._min_raise = raise_portion  # min raise = last raise size

        if me["stack"] == 0:
            me["is_all_in"] = True

        # Opponent must act again after a raise
        opp["has_acted"] = False

        self._record_event(agent_id, "raise", total_cost)

        return self._after_action(agent_id)

    def _do_all_in(self, agent_id: str) -> ActionResult:
        me = self._players[agent_id]
        opponent_id = self._other(agent_id)
        opp = self._players[opponent_id]

        all_in_amount = me["stack"]
        if all_in_amount == 0:
            return ActionResult(valid=False, error="Already all-in with 0 stack")

        new_total_bet = me["bet_this_round"] + all_in_amount
        amount_to_call = max(0, opp["bet_this_round"] - me["bet_this_round"])

        # Check if this all-in constitutes a raise
        if new_total_bet > opp["bet_this_round"]:
            raise_portion = new_total_bet - opp["bet_this_round"]
            if raise_portion >= self._min_raise:
                self._min_raise = raise_portion
            self._last_raiser = agent_id
            # Opponent must respond to a raise
            opp["has_acted"] = False

        me["bet_this_round"] = new_total_bet
        self._pot += all_in_amount
        me["stack"] = 0
        me["is_all_in"] = True
        me["has_acted"] = True

        self._record_event(agent_id, "all_in", all_in_amount)

        return self._after_action(agent_id)

    # ------------------------------------------------------------------
    # Round / phase management
    # ------------------------------------------------------------------

    def _after_action(self, agent_id: str) -> ActionResult:
        """Check if the betting round is over and advance phase if needed."""
        opponent_id = self._other(agent_id)
        me = self._players[agent_id]
        opp = self._players[opponent_id]

        if self._is_round_over():
            self._end_betting_round()
            if self._phase == GamePhase.COMPLETE:
                return ActionResult(valid=True, hand_complete=True)
            # Set next actor for the new round
            return ActionResult(
                valid=True,
                hand_complete=self._phase == GamePhase.COMPLETE,
                next_actor=self._current_actor,
            )

        # Not done yet, switch to opponent
        self._current_actor = opponent_id
        return ActionResult(valid=True, next_actor=opponent_id)

    def _is_round_over(self) -> bool:
        """A betting round is complete when both players have acted and bets
        are equal, or one is all-in and the other has acted."""
        p1 = self._players[self._agent1_id]
        p2 = self._players[self._agent2_id]

        # Both all-in
        if p1["is_all_in"] and p2["is_all_in"]:
            return True

        # One all-in and other has acted
        if p1["is_all_in"] and p2["has_acted"]:
            return True
        if p2["is_all_in"] and p1["has_acted"]:
            return True

        # Both have acted and bets are equal
        if p1["has_acted"] and p2["has_acted"]:
            if p1["bet_this_round"] == p2["bet_this_round"]:
                return True

        return False

    def _end_betting_round(self) -> None:
        """Move bets to pot (already tracked), reset for next round, advance phase."""
        # Record round summary in hand history
        self._hand_history.append({
            "phase": self._phase.value,
            "actions": self._get_actions_this_round(),
        })

        # Reset per-round state
        for p in self._players.values():
            p["bet_this_round"] = 0
            p["has_acted"] = False

        self._last_raiser = None

        # Check if both players are all-in -> run out remaining cards
        both_all_in = all(p["is_all_in"] for p in self._players.values())
        one_all_in = any(p["is_all_in"] for p in self._players.values())

        # Advance phase
        if self._phase == GamePhase.PREFLOP:
            self._deal_community(3)  # flop
            self._phase = GamePhase.FLOP
        elif self._phase == GamePhase.FLOP:
            self._deal_community(1)  # river
            self._phase = GamePhase.RIVER
        elif self._phase == GamePhase.RIVER:
            self._phase = GamePhase.SHOWDOWN
            self._resolve_showdown()
            return

        # If both all-in (or one all-in with no action needed), skip to showdown
        if both_all_in or (one_all_in and self._bets_settled()):
            self._skip_to_showdown()
            return

        # Postflop: non-dealer acts first
        self._current_actor = self._bb_id
        self._min_raise = self._big_blind

        # If the first-to-act player is all-in, the other acts
        first = self._players[self._current_actor]
        if first["is_all_in"]:
            self._current_actor = self._other(self._current_actor)

    def _bets_settled(self) -> bool:
        """Check if bets are already settled (equal or one is all-in)."""
        p1 = self._players[self._agent1_id]
        p2 = self._players[self._agent2_id]
        return p1["bet_this_round"] == p2["bet_this_round"]

    def _skip_to_showdown(self) -> None:
        """Deal remaining community cards and go to showdown."""
        while len(self._community_cards) < 4:
            if len(self._community_cards) == 0:
                self._deal_community(3)
            else:
                self._deal_community(1)

        self._phase = GamePhase.SHOWDOWN
        self._resolve_showdown()

    def _deal_community(self, count: int) -> None:
        """Deal community cards from the deck."""
        cards = self._deck.deal(count)
        self._community_cards.extend(cards)

    def _resolve_showdown(self) -> None:
        """Compare hands and award pot."""
        p1 = self._players[self._agent1_id]
        p2 = self._players[self._agent2_id]

        result = compare_hands(
            p1["hole_cards"], self._community_cards,
            p2["hole_cards"],
        )

        if result == 1:
            self._winner_id = self._agent1_id
        elif result == -1:
            self._winner_id = self._agent2_id
        else:
            self._winner_id = None  # tie

        # Award pot
        if self._winner_id:
            self._players[self._winner_id]["stack"] += self._pot
        else:
            # Split pot
            half = self._pot // 2
            remainder = self._pot % 2
            p1["stack"] += half
            p2["stack"] += half
            # Odd chip goes to non-dealer (BB) by convention
            self._players[self._bb_id]["stack"] += remainder

        self._phase = GamePhase.COMPLETE
        self._current_actor = None

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _other(self, agent_id: str) -> str:
        """Return the opponent's agent_id."""
        if agent_id == self._agent1_id:
            return self._agent2_id
        return self._agent1_id

    def _record_event(self, agent_id: str, action: str, amount: int) -> None:
        self._events.append({
            "phase": self._phase.value,
            "agent_id": agent_id,
            "action": action,
            "amount": amount,
            "pot_after": self._pot,
        })

    def _get_actions_this_round(self) -> list[dict]:
        """Return events for the current phase (excluding blind posts)."""
        return [
            e for e in self._events
            if e["phase"] == self._phase.value
            and e["action"] not in ("post_sb", "post_bb")
        ]
