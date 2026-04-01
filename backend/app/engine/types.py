from dataclasses import dataclass, field


@dataclass(frozen=True)
class BotConfig:
    # Preflop
    hand_threshold: float = 0.5
    raise_tendency: float = 0.5
    three_bet_frequency: float = 0.3

    # Postflop
    aggression: float = 0.5
    bluff_frequency: float = 0.3
    fold_to_pressure: float = 0.5
    continuation_bet: float = 0.5

    # Sizing
    bet_size_tendency: float = 0.5
    overbet_willingness: float = 0.3

    # Meta
    risk_tolerance: float = 0.5
    survival_priority: float = 0.5
    adaptation_speed: float = 0.5

    # Table management
    leave_threshold_up: float = 1.5
    leave_threshold_down: float = 0.3
    min_hands_before_leave: int = 10
    rebuy_willingness: float = 0.5
    session_max_hands: int = 100


@dataclass
class HandEvent:
    hand_number: int
    street: str
    player: str
    action: str
    amount: int
    pot_after: int
    stack_after: int
    hand_strength: float = 0.0
    hole_cards: list[str] = field(default_factory=list)


@dataclass
class HandResult:
    hand_number: int
    winner: str  # "player_1", "player_2", or "draw"
    pot: int
    player_1_stack: int
    player_2_stack: int
    events: list[HandEvent] = field(default_factory=list)
    community_cards: list[str] = field(default_factory=list)
    player_1_hole: list[str] = field(default_factory=list)
    player_2_hole: list[str] = field(default_factory=list)
    winning_hand_rank: str | None = None


@dataclass
class SessionResult:
    hands_played: int
    player_1_final_stack: int
    player_2_final_stack: int
    hand_results: list[HandResult]
    exit_reason: str
    player_1_config: BotConfig
    player_2_config: BotConfig
