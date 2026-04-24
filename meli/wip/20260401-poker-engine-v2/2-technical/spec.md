# Spec Técnica: Poker Engine v2

**Feature**: poker-engine-v2 | **Status**: Approved | **Lang**: es

---

## Decisiones de Arquitectura

### AD-1: Motor custom sin PyPokerEngine
- **Decision**: Reemplazar PyPokerEngine con implementación propia de 3-street Hold'em.
- **Razon**: PyPokerEngine asume bots internos (BasePokerPlayer subclasses) y ejecuta manos completas. No soporta el modelo de "esperar input externo por acción".
- **Trade-off**: Más código a mantener. Compensado por simplicidad del dominio (heads-up, 3 streets, sin side pots complejos en MVP).

### AD-2: State machine explícita
- **Decision**: HoldemHand es una state machine con estados: PREFLOP_BETTING → FLOP_DEALING → FLOP_BETTING → RIVER_DEALING → RIVER_BETTING → SHOWDOWN → COMPLETE.
- **Razon**: Claridad. Cada transición es explícita. Fácil de testear.

### AD-3: Sin dependencia de treys
- **Decision**: Evaluador propio usando combinatorias (itertools.combinations).
- **Razon**: Eliminar dependencia externa. Para 6 cartas hay C(6,5)=6 combinaciones, evaluable eficientemente con tabla de lookup simple.

---

## Implementación

### engine/types.py (rewrite completo)
```python
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
    hand_id: str
    phase: GamePhase
    my_cards: list[str]           # ["Ah", "Kd"]
    community_cards: list[str]    # [] preflop, ["9s","Jh","2c"] flop, +1 river
    my_stack: int
    opponent_stack: int
    pot: int
    my_position: str              # "dealer" | "big_blind"
    current_bet: int              # chips to call
    min_raise: int
    actions_this_round: list[dict]
    hand_history: list[dict]
    session: dict                 # hands_played, initial_stack, current_profit
    timeout_seconds: int = 30

@dataclass
class ActionResult:
    valid: bool
    error: Optional[str] = None
    hand_complete: bool = False
    next_actor: Optional[str] = None   # agent_id or None if hand complete
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
    events: list[dict]
```

### engine/deck.py
```python
import random
from dataclasses import dataclass

RANKS = ['2','3','4','5','6','7','8','9','T','J','Q','K','A']
SUITS = ['h','d','c','s']  # hearts, diamonds, clubs, spades

class Deck:
    def __init__(self, seed: int | None = None):
        self._cards = [r + s for s in SUITS for r in RANKS]
        rng = random.Random(seed)
        rng.shuffle(self._cards)
        self._dealt = 0

    def deal(self, n: int = 1) -> list[str]:
        cards = self._cards[self._dealt:self._dealt + n]
        self._dealt += n
        return cards
```

### engine/evaluator.py
```python
from itertools import combinations

HAND_RANKS = {
    'royal_flush': 9, 'straight_flush': 8, 'four_of_a_kind': 7,
    'full_house': 6, 'flush': 5, 'straight': 4,
    'three_of_a_kind': 3, 'two_pair': 2, 'pair': 1, 'high_card': 0
}
RANK_VALUES = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,
               '9':9,'T':10,'J':11,'Q':12,'K':13,'A':14}

def evaluate_hand(hole_cards: list[str], community_cards: list[str]) -> tuple[int, list[int], str]:
    """Returns (rank_value, tiebreaker_list, rank_name) for best 5-card hand from 6 cards."""
    all_cards = hole_cards + community_cards
    best = None
    best_name = "high_card"
    for combo in combinations(all_cards, 5):
        score, name = _score_5(list(combo))
        if best is None or score > best:
            best = score
            best_name = name
    return best, best_name

def compare_hands(h1_hole, h1_community, h2_hole, h2_community) -> int:
    """Returns 1 if h1 wins, -1 if h2 wins, 0 if tie."""
    s1, _ = evaluate_hand(h1_hole, h1_community)
    s2, _ = evaluate_hand(h2_hole, h2_community)
    if s1 > s2: return 1
    if s2 > s1: return -1
    return 0
```

### engine/holdem.py (clase principal)
```python
class HoldemHand:
    def __init__(self, hand_id: str, agent1_id: str, agent2_id: str,
                 stack1: int, stack2: int, small_blind: int, big_blind: int,
                 dealer_seat: int = 1, seed: int | None = None):
        # dealer_seat: 1 = agent1 es dealer/SB, 2 = agent2 es dealer/SB
        ...

    def get_state(self, agent_id: str) -> GameState:
        """Retorna estado desde perspectiva del agente. Oculta cartas del oponente."""
        ...

    def apply_action(self, agent_id: str, action: PlayerAction, amount: int = 0) -> ActionResult:
        """Valida y aplica acción. Retorna ActionResult con valid=False si inválida."""
        ...

    def is_complete(self) -> bool:
        return self._phase == GamePhase.COMPLETE

    def get_result(self) -> HandResult:
        """Solo válido si is_complete(). Retorna resultado final."""
        ...

    def _validate_action(self, agent_id, action, amount) -> tuple[bool, str]:
        """Retorna (valid, error_msg)."""
        ...

    def _advance_phase(self):
        """Transiciona: preflop→flop, flop→river, river→showdown, showdown→complete."""
        ...

    def _post_blinds(self):
        """SB y BB se postean automáticamente al inicializar."""
        ...

    def _who_acts_next(self) -> str | None:
        """Retorna agent_id del próximo en actuar, None si la ronda terminó."""
        ...
```

---

## Flujo de Estado Interno

```
INIT
  → _post_blinds() (SB + BB son acciones automáticas)
  → phase = PREFLOP, quien_actua = dealer/SB (primero en preflop)

PREFLOP_BETTING
  → apply_action() hasta que ronda de apuestas cierre (ambos igualaron o alguien foldeó)
  → Si fold: COMPLETE
  → Si ambos igualados: deal flop (3 cartas) → FLOP_BETTING

FLOP_BETTING
  → apply_action() hasta cierre
  → Si fold: COMPLETE
  → deal river (1 carta) → RIVER_BETTING

RIVER_BETTING
  → apply_action() hasta cierre
  → Si fold: COMPLETE
  → SHOWDOWN → calcular ganador → COMPLETE
```

---

## Validación de Acciones (detalle)

| Acción | Condición válida | Error si inválida |
|--------|-----------------|-------------------|
| fold | siempre | - |
| check | current_bet == 0 o jugador ya igualó | "Cannot check, there is a bet of {current_bet}" |
| call | hay apuesta pendiente | "Nothing to call, use check" |
| raise | amount >= min_raise AND amount <= stack | "Raise must be between {min_raise} and {stack}" |
| all_in | siempre (pushea todo el stack) | - |

---

## Archivos

```
backend/app/engine/
  holdem.py         # HoldemHand state machine (nuevo)
  deck.py           # Deck class (nuevo)
  evaluator.py      # HandEvaluator (nuevo, sin treys)
  types.py          # GameState, ActionResult, HandResult, enums (rewrite)
  configurable_bot.py  # ELIMINAR
  presets.py           # ELIMINAR
  runner.py            # ELIMINAR
  hand_evaluator.py    # ELIMINAR (reemplazado por evaluator.py)
```

---

## Testing Strategy

### Unit Tests (test_engine.py)
- Deal mano: cada jugador recibe 2 cartas distintas, mazo sin repetidos.
- Flop: 3 cartas únicas distintas a las hole cards.
- River: 1 carta adicional única.
- Validación: check con bet pendiente → error.
- Validación: raise < min_raise → error.
- Fold: mano termina, oponente gana pot.
- Showdown: evaluador determina ganador correcto para manos conocidas.
- Tie: pot dividido.
- All-in con stacks desiguales: side pot correcto.
- get_state(): jugador A no ve cartas de B.
