# Spec Tecnica: Poker Engine

**Feature**: poker-engine | **Status**: Approved | **Lang**: es

---

## Decisiones de Arquitectura

### AD-1: PyPokerEngine como game engine
- **Decision**: Usar PyPokerEngine como base para dealer, calles, pot y showdown.
- **Razon**: Evitar construir un engine de poker desde cero. PyPokerEngine maneja toda la mecanica de juego (blinds, turnos, pot, side pots, showdown).
- **Trade-off**: PyPokerEngine no soporta saltear el turn (solo Hold'em estandar 4 calles). Se acepta porque la simplificacion original ya no es necesaria al usar libreria.

### AD-2: treys para evaluacion de hand strength mid-hand
- **Decision**: Usar treys para calcular hand_strength normalizado (0.0-1.0) durante la partida.
- **Razon**: El bot necesita evaluar la fuerza de su mano en cada calle para tomar decisiones. treys es rapido y confiable para evaluacion de 5-7 cartas.
- **Implementacion**: `treys.Evaluator().evaluate(board, hand)` retorna ranking (1=Royal Flush, 7462=peor). Normalizar: `1 - (rank / 7462)`.

### AD-3: Engine puro sin I/O
- **Decision**: El engine no tiene acceso a DB, red ni filesystem. Solo recibe dataclasses y retorna dataclasses.
- **Razon**: Testeable en aislamiento, sin mocks. Facilita reutilizacion y testing.

### AD-4: Thread pool para ejecucion
- **Decision**: Ejecutar partidas en `asyncio.to_thread()` para no bloquear el event loop de FastAPI.
- **Razon**: PyPokerEngine es sincronico. FastAPI es async. El thread pool resuelve el bridge.

---

## Estructura de Modulos

```
backend/app/engine/
  __init__.py
  types.py              # BotConfig, SessionResult, HandResult, HandEvent
  configurable_bot.py   # ConfigurableBot(BasePokerPlayer)
  runner.py             # run_hand(), run_session()
  presets.py            # AGGRESSIVE, CONSERVATIVE, BALANCED, OPPORTUNIST, BLUFFER
  hand_evaluator.py     # Wrapper sobre treys para hand_strength normalizado
```

---

## Modelo de Datos (Dataclasses - sin DB)

### BotConfig
```python
@dataclass(frozen=True)
class BotConfig:
    # Preflop
    hand_threshold: float      # 0.0-1.0, selectividad de manos iniciales
    raise_tendency: float      # 0.0-1.0, probabilidad de raise vs call
    three_bet_frequency: float # 0.0-1.0, frecuencia de 3-bet

    # Postflop
    aggression: float          # 0.0-1.0, agresividad general postflop
    bluff_frequency: float     # 0.0-1.0, frecuencia de bluff
    fold_to_pressure: float    # 0.0-1.0, tendencia a foldear ante presion
    continuation_bet: float    # 0.0-1.0, frecuencia de c-bet

    # Sizing
    bet_size_tendency: float   # 0.0-1.0, tamano de apuesta relativo al pot
    overbet_willingness: float # 0.0-1.0, disposicion a overbet

    # Meta
    risk_tolerance: float      # 0.0-1.0, tolerancia a draws/marginales
    survival_priority: float   # 0.0-1.0, prioridad de supervivencia (short stack)
    adaptation_speed: float    # 0.0-1.0, reservado para futuro

    # Table Management
    leave_threshold_up: float     # ej: 1.5 (se va si stack >= buy_in * 1.5)
    leave_threshold_down: float   # ej: 0.3 (se va si stack <= buy_in * 0.3)
    min_hands_before_leave: int   # 5-50
    rebuy_willingness: float      # 0.0-1.0, reservado
    session_max_hands: int        # 20-500
```

### HandEvent
```python
@dataclass
class HandEvent:
    hand_number: int
    street: str           # "preflop", "flop", "turn", "river", "showdown"
    player: str           # "player_1" o "player_2"
    action: str           # "fold", "check", "call", "raise", "all_in"
    amount: int           # monto de la accion
    pot_after: int        # pot despues de la accion
    stack_after: int      # stack del jugador despues
```

### HandResult
```python
@dataclass
class HandResult:
    hand_number: int
    winner: str           # "player_1", "player_2", "draw"
    pot: int
    player_1_stack: int
    player_2_stack: int
    events: list[HandEvent]
    community_cards: list[str]
    player_1_hole: list[str]
    player_2_hole: list[str]
    winning_hand_rank: str | None  # ej: "Full House", "Two Pair"
```

### SessionResult
```python
@dataclass
class SessionResult:
    hands_played: int
    player_1_final_stack: int
    player_2_final_stack: int
    hand_results: list[HandResult]
    exit_reason: str      # "stack_zero", "threshold_up", "threshold_down", "max_hands"
    player_1_config: BotConfig
    player_2_config: BotConfig
```

---

## Logica Core: ConfigurableBot

Subclase de `pypokerengine.players.BasePokerPlayer`. Implementa `declare_action(valid_actions, hole_card, round_state)`.

### Algoritmo de Decision

```
1. EVALUAR hand_strength:
   - Preflop: lookup table simplificado (pocket pairs, suited connectors, etc.)
     O usar treys con 5-card monte carlo sampling
   - Postflop: treys.Evaluator con hole_cards + community_cards
   - Normalizar a 0.0-1.0

2. CALCULAR action_score:
   - base_score = hand_strength
   - IF preflop:
     - IF base_score < hand_threshold → tend to fold
     - IF base_score > hand_threshold → call/raise segun raise_tendency
     - IF facing raise AND base_score high → 3-bet segun three_bet_frequency
   - IF postflop:
     - Multiply by aggression factor
     - IF was_preflop_raiser AND street=="flop" → boost by continuation_bet
     - IF hand_strength < 0.3 AND random < bluff_frequency → bluff raise
     - IF facing large bet → fold probability = fold_to_pressure * (1 - hand_strength)

3. APLICAR varianza:
   - action_score += random.uniform(-0.10, 0.10)

4. CALCULAR sizing (si raise):
   - base_bet = pot * bet_size_tendency
   - IF action_score > 0.9 AND overbet_willingness > 0.5 → bet up to 2x pot
   - Clamp entre min_raise y max_raise (de valid_actions)

5. MODIFIERS:
   - IF stack < buy_in * 0.3 → survival_priority aumenta fold tendency
   - IF draw detected AND risk_tolerance low → check/fold draws

6. MAP to valid_actions:
   - fold/check/call/raise con amount validado por PyPokerEngine
```

### Callbacks de PyPokerEngine (captura de eventos)

```python
def receive_game_start_message(self, game_info): ...
def receive_round_start_message(self, round_count, hole_card, seats): ...
def receive_street_start_message(self, street, round_state): ...
def receive_game_update_message(self, action, round_state): ...
def receive_round_result_message(self, winners, hand_info, round_state): ...
```

Cada callback acumula datos en `self._events: list[HandEvent]` para retornar despues.

---

## Runner (Orquestador de Sesion)

```python
def run_session(
    config_1: BotConfig,
    config_2: BotConfig,
    buy_in: int,
    small_blind: int,
    big_blind: int,
    max_hands: int | None = None,
    seed: int | None = None
) -> SessionResult:
```

**Implementacion**:
1. Crear 2 instancias de `ConfigurableBot` con sus configs.
2. Loop de manos:
   a. `GameConfig = setup_config(max_round=1, initial_stack=current_stacks, small_blind, ante=0)`
   b. `game_result = start_poker(config, verbose=0)`
   c. Extraer `HandResult` de los eventos capturados.
   d. Actualizar stacks.
   e. Evaluar condiciones de salida:
      - `stack == 0` → salir
      - `hands_played >= min_hands_before_leave` AND `stack >= buy_in * leave_threshold_up` → salir
      - `hands_played >= min_hands_before_leave` AND `stack <= buy_in * leave_threshold_down` → salir
      - `hands_played >= session_max_hands` → salir
3. Retornar `SessionResult`.

**Nota sobre PyPokerEngine**: Cada "mano" se ejecuta como un game de 1 round. Los stacks se pasan fresh en cada nueva mano. Esto simula un cash game (no torneo).

---

## Presets

| Preset | hand_threshold | raise_tendency | three_bet | aggression | bluff | fold_pressure | c_bet | bet_size | overbet | risk_tol | survival | adapt | leave_up | leave_down | min_hands | rebuy | max_hands |
|--------|-------|-------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|
| AGGRESSIVE | 0.3 | 0.8 | 0.5 | 0.8 | 0.6 | 0.2 | 0.7 | 0.7 | 0.6 | 0.7 | 0.3 | 0.5 | 2.0 | 0.2 | 10 | 0.5 | 100 |
| CONSERVATIVE | 0.7 | 0.3 | 0.1 | 0.3 | 0.1 | 0.7 | 0.4 | 0.4 | 0.1 | 0.3 | 0.8 | 0.5 | 1.3 | 0.5 | 15 | 0.3 | 80 |
| BALANCED | 0.5 | 0.5 | 0.3 | 0.5 | 0.3 | 0.5 | 0.5 | 0.5 | 0.3 | 0.5 | 0.5 | 0.5 | 1.5 | 0.3 | 10 | 0.5 | 100 |
| OPPORTUNIST | 0.4 | 0.6 | 0.4 | 0.6 | 0.5 | 0.3 | 0.6 | 0.6 | 0.4 | 0.6 | 0.4 | 0.8 | 1.8 | 0.25 | 8 | 0.6 | 120 |
| BLUFFER | 0.35 | 0.7 | 0.4 | 0.7 | 0.8 | 0.2 | 0.7 | 0.8 | 0.7 | 0.5 | 0.3 | 0.5 | 1.5 | 0.3 | 10 | 0.5 | 100 |

---

## Hand Evaluator (Wrapper treys)

```python
def hand_strength_normalized(hole_cards: list[str], community_cards: list[str]) -> float:
    """
    Retorna fuerza de mano normalizada 0.0 (peor) a 1.0 (mejor).
    - Si community_cards vacio (preflop): usa lookup table o monte carlo.
    - Si community_cards >= 3: usa treys.Evaluator.
    """
```

**Conversion de formatos**: PyPokerEngine usa formato "SA" (Spades Ace), treys usa `Card.new("As")`. Se necesita funcion de conversion.

---

## Testing Strategy

### Unit Tests
- `test_hand_evaluator.py`: Verificar hand_strength para manos conocidas (Royal Flush ~1.0, 7-2 offsuit ~0.0).
- `test_configurable_bot.py`:
  - hand_threshold=1.0 → foldea casi todo preflop.
  - aggression=1.0 → raisea casi siempre postflop.
  - fold_to_pressure=1.0 → foldea ante raises.
  - bluff_frequency=1.0 → bluffea con manos malas.
- `test_presets.py`: Verificar que los 5 presets son BotConfig validos.

### Integration Tests
- `test_runner.py`:
  - Sesion completa con seed fijo → resultado determinista.
  - Sesion AGGRESSIVE vs CONSERVATIVE → no errores, resultado valido.
  - Verificar condiciones de salida: stack=0, threshold_up, max_hands.
  - Verificar que HandEvents se capturan correctamente para cada mano.
  - Verificar que stacks suman correctamente (pot = ganancia de uno + perdida del otro).

### Property Tests
- Para cualquier par de configs validas: la sesion termina sin excepciones.
- La suma de stacks se conserva en cada mano (pot = delta stacks).
