from enum import Enum
from dataclasses import dataclass, field
from typing import Optional


class GamePhase(str, Enum):
    PREFLOP = "preflop"
    FLOP = "flop"
    RIVER = "river"
    SHOWDOWN = "showdown"
    COMPLETE = "complete"


class PlayerAction(str, Enum):
    FOLD = "fold"
    CHECK = "check"
    CALL = "call"
    RAISE = "raise"
    ALL_IN = "all_in"


@dataclass
class GameState:
    """State visible to one player. Opponent cards are hidden."""
    hand_id: str
    phase: str
    my_cards: list[str]
    community_cards: list[str]
    my_stack: int
    opponent_stack: int
    pot: int
    my_position: str  # "dealer" | "big_blind"
    current_bet: int  # amount to call (0 if no bet)
    min_raise: int
    actions_this_round: list[dict]
    hand_history: list[dict]
    session: dict
    timeout_seconds: int = 30


@dataclass
class ActionResult:
    valid: bool
    error: Optional[str] = None
    hand_complete: bool = False
    next_actor: Optional[str] = None
    retries_left: Optional[int] = None


@dataclass
class HandResult:
    hand_id: str
    winner_agent_id: Optional[str]  # None = tie
    pot: int
    player1_stack_after: int
    player2_stack_after: int
    community_cards: list[str]
    player1_hole_cards: list[str]
    player2_hole_cards: list[str]
    winning_hand_rank: Optional[str]
    events: list[dict] = field(default_factory=list)
