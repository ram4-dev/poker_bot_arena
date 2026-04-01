from app.engine.types import BotConfig

AGGRESSIVE = BotConfig(
    hand_threshold=0.3, raise_tendency=0.8, three_bet_frequency=0.5,
    aggression=0.8, bluff_frequency=0.6, fold_to_pressure=0.2, continuation_bet=0.7,
    bet_size_tendency=0.7, overbet_willingness=0.6,
    risk_tolerance=0.7, survival_priority=0.3, adaptation_speed=0.5,
    leave_threshold_up=2.0, leave_threshold_down=0.2, min_hands_before_leave=10,
    rebuy_willingness=0.5, session_max_hands=100,
)

CONSERVATIVE = BotConfig(
    hand_threshold=0.7, raise_tendency=0.3, three_bet_frequency=0.1,
    aggression=0.3, bluff_frequency=0.1, fold_to_pressure=0.7, continuation_bet=0.4,
    bet_size_tendency=0.4, overbet_willingness=0.1,
    risk_tolerance=0.3, survival_priority=0.8, adaptation_speed=0.5,
    leave_threshold_up=1.3, leave_threshold_down=0.5, min_hands_before_leave=15,
    rebuy_willingness=0.3, session_max_hands=80,
)

BALANCED = BotConfig(
    hand_threshold=0.5, raise_tendency=0.5, three_bet_frequency=0.3,
    aggression=0.5, bluff_frequency=0.3, fold_to_pressure=0.5, continuation_bet=0.5,
    bet_size_tendency=0.5, overbet_willingness=0.3,
    risk_tolerance=0.5, survival_priority=0.5, adaptation_speed=0.5,
    leave_threshold_up=1.5, leave_threshold_down=0.3, min_hands_before_leave=10,
    rebuy_willingness=0.5, session_max_hands=100,
)

OPPORTUNIST = BotConfig(
    hand_threshold=0.4, raise_tendency=0.6, three_bet_frequency=0.4,
    aggression=0.6, bluff_frequency=0.5, fold_to_pressure=0.3, continuation_bet=0.6,
    bet_size_tendency=0.6, overbet_willingness=0.4,
    risk_tolerance=0.6, survival_priority=0.4, adaptation_speed=0.8,
    leave_threshold_up=1.8, leave_threshold_down=0.25, min_hands_before_leave=8,
    rebuy_willingness=0.6, session_max_hands=120,
)

BLUFFER = BotConfig(
    hand_threshold=0.35, raise_tendency=0.7, three_bet_frequency=0.4,
    aggression=0.7, bluff_frequency=0.8, fold_to_pressure=0.2, continuation_bet=0.7,
    bet_size_tendency=0.8, overbet_willingness=0.7,
    risk_tolerance=0.5, survival_priority=0.3, adaptation_speed=0.5,
    leave_threshold_up=1.5, leave_threshold_down=0.3, min_hands_before_leave=10,
    rebuy_willingness=0.5, session_max_hands=100,
)

PRESETS: dict[str, BotConfig] = {
    "aggressive": AGGRESSIVE,
    "conservative": CONSERVATIVE,
    "balanced": BALANCED,
    "opportunist": OPPORTUNIST,
    "bluffer": BLUFFER,
}


def get_preset(name: str) -> BotConfig:
    key = name.lower()
    if key not in PRESETS:
        raise ValueError(f"Unknown preset: {name}. Available: {list(PRESETS.keys())}")
    return PRESETS[key]
