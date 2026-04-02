import random

RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"]
SUITS = ["h", "d", "c", "s"]

FULL_DECK = [f"{r}{s}" for r in RANKS for s in SUITS]


class Deck:
    """Standard 52-card deck with optional seed for deterministic results."""

    def __init__(self, seed: int | None = None):
        self._rng = random.Random(seed)
        self._cards = list(FULL_DECK)
        self._rng.shuffle(self._cards)
        self._index = 0

    def deal(self, count: int = 1) -> list[str]:
        """Deal `count` cards from the top of the deck."""
        if self._index + count > len(self._cards):
            raise ValueError(
                f"Not enough cards in deck: requested {count}, "
                f"remaining {len(self._cards) - self._index}"
            )
        cards = self._cards[self._index : self._index + count]
        self._index += count
        return cards

    def remaining(self) -> int:
        """Number of cards left in the deck."""
        return len(self._cards) - self._index
