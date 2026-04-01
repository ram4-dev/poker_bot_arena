import random

from pypokerengine.players import BasePokerPlayer

from app.engine.types import BotConfig, HandEvent
from app.engine.hand_evaluator import hand_strength_normalized


class ConfigurableBot(BasePokerPlayer):
    def __init__(self, config: BotConfig, name: str = "bot", action_counter: list[int] | None = None):
        super().__init__()
        self.config = config
        self.bot_name = name
        self._events: list[dict] = []
        self._hole_card: list[str] = []
        self._was_preflop_raiser = False
        self._hand_number = 0
        self._buy_in = 0
        # Shared mutable counter for cross-bot action ordering
        self._action_counter = action_counter if action_counter is not None else [0]

    def set_context(self, hand_number: int, buy_in: int):
        self._hand_number = hand_number
        self._buy_in = buy_in
        self._was_preflop_raiser = False
        self._community_cards: list[str] = []

    def get_events(self) -> list[dict]:
        events = self._events.copy()
        self._events.clear()
        return events

    def get_community_cards(self) -> list[str]:
        return self._community_cards.copy()

    def declare_action(self, valid_actions, hole_card, round_state):
        self._hole_card = hole_card
        street = round_state.get("street", "preflop")
        community = round_state.get("community_card", [])
        pot = round_state["pot"]["main"]["amount"]

        strength = hand_strength_normalized(hole_card, community)

        # Apply variance
        strength += random.uniform(-0.10, 0.10)
        strength = max(0.0, min(1.0, strength))

        # Find my seat and stack
        my_stack = self._get_my_stack(round_state)
        stack_ratio = my_stack / self._buy_in if self._buy_in > 0 else 1.0

        # Survival modifier: tighter when short-stacked
        survival_mod = 0.0
        if stack_ratio < 0.5:
            survival_mod = self.config.survival_priority * 0.2

        # Parse valid actions
        fold_action = None
        call_action = None
        raise_action = None
        for va in valid_actions:
            if va["action"] == "fold":
                fold_action = va
            elif va["action"] == "call":
                call_action = va
            elif va["action"] == "raise":
                raise_action = va

        if street == "preflop":
            action, amount = self._preflop_decision(
                strength, valid_actions, pot, fold_action, call_action, raise_action, survival_mod, round_state
            )
        else:
            action, amount = self._postflop_decision(
                strength, street, valid_actions, pot, fold_action, call_action, raise_action, survival_mod, round_state
            )

        # Record event with global sequence for cross-bot ordering
        self._action_counter[0] += 1
        self._events.append({
            "global_seq": self._action_counter[0],
            "hand_number": self._hand_number,
            "street": street,
            "player": self.bot_name,
            "action": action,
            "amount": amount,
            "pot_after": pot + (amount if action != "fold" else 0),
            "stack_after": my_stack - (amount if action in ("call", "raise") else 0),
            "hand_strength": round(strength, 3),
            "hole_cards": list(hole_card),
        })

        return action, amount

    def _preflop_decision(self, strength, valid_actions, pot, fold_a, call_a, raise_a, survival_mod, round_state):
        cfg = self.config
        threshold = cfg.hand_threshold + survival_mod

        if strength < threshold * 0.7:
            # Weak hand: fold unless we can check
            if call_a and call_a["amount"] == 0:
                return "call", 0
            return "fold", 0

        if strength < threshold:
            # Marginal: call if cheap
            if call_a:
                return "call", call_a["amount"]
            return "fold", 0

        # Good hand: raise or call based on raise_tendency
        facing_raise = self._is_facing_raise(round_state)

        if facing_raise and strength > threshold * 1.3:
            # Facing raise with strong hand: 3-bet
            if raise_a and random.random() < cfg.three_bet_frequency:
                self._was_preflop_raiser = True
                amount = self._calculate_raise_amount(raise_a, pot)
                return "raise", amount

        if raise_a and random.random() < cfg.raise_tendency:
            self._was_preflop_raiser = True
            amount = self._calculate_raise_amount(raise_a, pot)
            return "raise", amount

        if call_a:
            return "call", call_a["amount"]
        return "fold", 0

    def _postflop_decision(self, strength, street, valid_actions, pot, fold_a, call_a, raise_a, survival_mod, round_state):
        cfg = self.config

        facing_bet = self._is_facing_raise(round_state)
        effective_aggression = cfg.aggression - survival_mod

        # Continuation bet: if we were preflop raiser and it's the flop
        if street == "flop" and self._was_preflop_raiser and not facing_bet:
            if random.random() < cfg.continuation_bet:
                if raise_a:
                    amount = self._calculate_raise_amount(raise_a, pot)
                    return "raise", amount

        # Facing a bet: fold based on fold_to_pressure and hand strength
        if facing_bet:
            fold_prob = cfg.fold_to_pressure * (1.0 - strength)
            if random.random() < fold_prob:
                if fold_a:
                    return "fold", 0

        # Bluff: with weak hand, sometimes raise
        if strength < 0.3 and not facing_bet:
            if random.random() < cfg.bluff_frequency:
                if raise_a:
                    amount = self._calculate_raise_amount(raise_a, pot)
                    return "raise", amount

        # Strong hand: raise aggressively
        if strength > 0.6:
            if raise_a and random.random() < effective_aggression:
                amount = self._calculate_raise_amount(raise_a, pot)
                return "raise", amount

        # Medium hand: call
        if strength > 0.35:
            if call_a:
                return "call", call_a["amount"]

        # Weak hand: check or fold
        if call_a and call_a["amount"] == 0:
            return "call", 0
        if fold_a:
            return "fold", 0
        if call_a:
            return "call", call_a["amount"]
        return "fold", 0

    def _calculate_raise_amount(self, raise_action, pot):
        amount_info = raise_action["amount"]
        min_raise = amount_info["min"]
        max_raise = amount_info["max"]

        # Base size from pot
        target = int(pot * self.config.bet_size_tendency)

        # Overbet possibility
        if random.random() < self.config.overbet_willingness:
            target = int(pot * (1.0 + self.config.overbet_willingness))

        # Clamp to valid range
        return max(min_raise, min(target, max_raise))

    def _is_facing_raise(self, round_state):
        street = round_state.get("street", "preflop")
        histories = round_state.get("action_histories", {})
        street_history = histories.get(street, [])
        for action in reversed(street_history):
            if action.get("action") in ("raise", "RAISE"):
                return True
        return False

    def _get_my_stack(self, round_state):
        for seat in round_state.get("seats", []):
            if seat.get("name") == self.uuid:
                return seat.get("stack", 0)
        return 0

    def receive_game_start_message(self, game_info):
        pass

    def receive_round_start_message(self, round_count, hole_card, seats):
        self._hole_card = hole_card

    def receive_street_start_message(self, street, round_state):
        self._community_cards = round_state.get("community_card", [])

    def receive_game_update_message(self, action, round_state):
        pass

    def receive_round_result_message(self, winners, hand_info, round_state):
        pass
