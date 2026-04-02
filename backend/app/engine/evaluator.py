"""Hand evaluator for simplified Hold'em (3-street: preflop, flop, river)."""

from itertools import combinations

RANK_ORDER = "23456789TJQKA"
RANK_VALUE = {r: i for i, r in enumerate(RANK_ORDER)}


def _card_rank(card: str) -> int:
    """Return numeric rank value for a card like 'Ah' or 'Td'."""
    return RANK_VALUE[card[0]]


def _card_suit(card: str) -> str:
    return card[1]


def _is_flush(cards: list[str]) -> bool:
    return len(set(_card_suit(c) for c in cards)) == 1


def _rank_values_sorted(cards: list[str]) -> list[int]:
    """Return rank values sorted descending."""
    return sorted((_card_rank(c) for c in cards), reverse=True)


def _is_straight(rank_values: list[int]) -> tuple[bool, int]:
    """Check if 5 sorted-descending rank values form a straight.

    Returns (is_straight, high_card_value).
    Handles ace-low straight (A-2-3-4-5) where high card is 5.
    """
    # Normal straight check
    if rank_values[0] - rank_values[4] == 4 and len(set(rank_values)) == 5:
        return True, rank_values[0]

    # Ace-low straight: A-5-4-3-2 → values [12, 3, 2, 1, 0]
    if rank_values == [12, 3, 2, 1, 0]:
        return True, 3  # 5-high straight (value of 5 is 3)

    return False, 0


# Hand rank values (higher = better)
ROYAL_FLUSH = 9
STRAIGHT_FLUSH = 8
FOUR_OF_A_KIND = 7
FULL_HOUSE = 6
FLUSH = 5
STRAIGHT = 4
THREE_OF_A_KIND = 3
TWO_PAIR = 2
PAIR = 1
HIGH_CARD = 0

RANK_NAMES = {
    ROYAL_FLUSH: "royal_flush",
    STRAIGHT_FLUSH: "straight_flush",
    FOUR_OF_A_KIND: "four_of_a_kind",
    FULL_HOUSE: "full_house",
    FLUSH: "flush",
    STRAIGHT: "straight",
    THREE_OF_A_KIND: "three_of_a_kind",
    TWO_PAIR: "two_pair",
    PAIR: "pair",
    HIGH_CARD: "high_card",
}


def _score_5(cards: list[str]) -> tuple:
    """Score a 5-card hand. Returns a comparable tuple (higher = better).

    Format: (rank_category, *tiebreakers)
    """
    ranks = _rank_values_sorted(cards)
    flush = _is_flush(cards)
    straight, straight_high = _is_straight(ranks)

    # Count rank occurrences
    from collections import Counter
    rank_counts = Counter(ranks)
    # Sort by count descending, then by rank descending for tiebreaking
    groups = sorted(rank_counts.items(), key=lambda x: (x[1], x[0]), reverse=True)

    if straight and flush:
        if straight_high == 12:  # Ace-high straight flush
            return (ROYAL_FLUSH,)
        return (STRAIGHT_FLUSH, straight_high)

    if groups[0][1] == 4:
        quad_rank = groups[0][0]
        kicker = groups[1][0]
        return (FOUR_OF_A_KIND, quad_rank, kicker)

    if groups[0][1] == 3 and groups[1][1] == 2:
        trips_rank = groups[0][0]
        pair_rank = groups[1][0]
        return (FULL_HOUSE, trips_rank, pair_rank)

    if flush:
        return (FLUSH, *ranks)

    if straight:
        return (STRAIGHT, straight_high)

    if groups[0][1] == 3:
        trips_rank = groups[0][0]
        kickers = sorted([g[0] for g in groups[1:]], reverse=True)
        return (THREE_OF_A_KIND, trips_rank, *kickers)

    if groups[0][1] == 2 and groups[1][1] == 2:
        high_pair = max(groups[0][0], groups[1][0])
        low_pair = min(groups[0][0], groups[1][0])
        kicker = groups[2][0]
        return (TWO_PAIR, high_pair, low_pair, kicker)

    if groups[0][1] == 2:
        pair_rank = groups[0][0]
        kickers = sorted([g[0] for g in groups[1:]], reverse=True)
        return (PAIR, pair_rank, *kickers)

    return (HIGH_CARD, *ranks)


def evaluate_hand(hole_cards: list[str], community_cards: list[str]) -> tuple[tuple, str]:
    """Evaluate the best 5-card hand from hole cards + community cards.

    Args:
        hole_cards: List of 2 cards (e.g., ["Ah", "Kd"])
        community_cards: List of 3 or 4 community cards

    Returns:
        (score_tuple, rank_name) where score_tuple is comparable and
        rank_name is a string like "flush", "pair", etc.
    """
    all_cards = hole_cards + community_cards

    if len(all_cards) < 5:
        raise ValueError(
            f"Need at least 5 cards to evaluate, got {len(all_cards)}"
        )

    best_score = None
    for combo in combinations(all_cards, 5):
        score = _score_5(list(combo))
        if best_score is None or score > best_score:
            best_score = score

    rank_category = best_score[0]
    rank_name = RANK_NAMES[rank_category]
    return best_score, rank_name


def compare_hands(
    h1_hole: list[str],
    community: list[str],
    h2_hole: list[str],
    community2: list[str] | None = None,
) -> int:
    """Compare two hands. Returns 1 if h1 wins, -1 if h2 wins, 0 if tie.

    Args:
        h1_hole: Player 1's hole cards
        community: Community cards (used for both if community2 is None)
        h2_hole: Player 2's hole cards
        community2: Optional separate community cards for player 2
    """
    comm2 = community2 if community2 is not None else community
    score1, _ = evaluate_hand(h1_hole, community)
    score2, _ = evaluate_hand(h2_hole, comm2)

    if score1 > score2:
        return 1
    elif score1 < score2:
        return -1
    return 0
