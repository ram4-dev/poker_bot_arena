from treys import Card, Evaluator

_evaluator = Evaluator()

# Preflop hand strength lookup (simplified, based on common rankings)
# Key: tuple of (rank1, rank2, suited) → strength 0.0-1.0
_RANK_VALUES = {"2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "T": 10, "J": 11, "Q": 12, "K": 13, "A": 14}


def _pypoker_to_treys(card_str: str) -> int:
    """Convert PyPokerEngine format 'SA' to treys format 'As'."""
    suit = card_str[0].lower()
    rank = card_str[1:]
    if rank == "T":
        rank = "T"
    return Card.new(f"{rank}{suit}")


def _preflop_strength(hole_cards: list[str]) -> float:
    """Estimate preflop hand strength using a simplified model."""
    r1 = _RANK_VALUES.get(hole_cards[0][1:], 5)
    r2 = _RANK_VALUES.get(hole_cards[1][1:], 5)
    suited = hole_cards[0][0] == hole_cards[1][0]

    high = max(r1, r2)
    low = min(r1, r2)

    # Pair bonus
    if r1 == r2:
        return min(1.0, 0.5 + (r1 - 2) * 0.04)

    # Base from high card
    strength = (high - 2) * 0.03 + (low - 2) * 0.015

    # Connectivity bonus (close ranks)
    gap = high - low
    if gap <= 2:
        strength += 0.08
    elif gap <= 4:
        strength += 0.04

    # Suited bonus
    if suited:
        strength += 0.06

    return max(0.0, min(1.0, strength))


def hand_strength_normalized(hole_cards: list[str], community_cards: list[str]) -> float:
    """
    Return hand strength normalized 0.0 (worst) to 1.0 (best).
    hole_cards and community_cards are in PyPokerEngine format (e.g., 'SA', 'HK').
    """
    if not community_cards:
        return _preflop_strength(hole_cards)

    try:
        treys_hole = [_pypoker_to_treys(c) for c in hole_cards]
        treys_board = [_pypoker_to_treys(c) for c in community_cards]
        rank = _evaluator.evaluate(treys_board, treys_hole)
        return 1.0 - (rank / 7462.0)
    except Exception:
        return 0.5


def get_hand_rank_name(hole_cards: list[str], community_cards: list[str]) -> str | None:
    """Return the name of the hand rank (e.g., 'Full House')."""
    if not community_cards or len(community_cards) < 3:
        return None
    try:
        treys_hole = [_pypoker_to_treys(c) for c in hole_cards]
        treys_board = [_pypoker_to_treys(c) for c in community_cards]
        rank = _evaluator.evaluate(treys_board, treys_hole)
        return _evaluator.class_to_string(_evaluator.get_rank_class(rank))
    except Exception:
        return None
