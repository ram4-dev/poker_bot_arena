# Spec Técnica: Integration y Cleanup

**Feature**: integration-cleanup | **Status**: Approved | **Lang**: es

---

## Decisiones de Arquitectura

### AD-1: Tests con DB en memoria
- **Decision**: Tests usan SQLite en memoria (`:memory:`). No dependen de DB de desarrollo.
- **Razon**: Tests rápidos, aislados, sin side effects.

### AD-2: Test helper para game loop
- **Decision**: Crear helper `simulate_game_turn(db, agent_id)` que hace get_state + apply_action con acción aleatoria válida.
- **Razon**: El E2E test necesita simular múltiples turnos. Un helper reduce boilerplate.

---

## Tests

### tests/test_engine.py (unit)
```python
def test_deal_unique_cards()
def test_flop_3_community_cards()
def test_river_1_additional_card()
def test_fold_ends_hand()
def test_check_with_pending_bet_invalid()
def test_raise_below_min_invalid()
def test_showdown_two_pair_beats_pair()
def test_showdown_tie_splits_pot()
def test_all_in_side_pot()
def test_get_state_hides_opponent_cards()
def test_blind_posting()
def test_dealer_rotates_each_hand()
```

### tests/test_e2e_game.py (integration)
```python
async def test_full_game_session():
    # Setup
    db = get_test_db()
    user1, token1 = await register_user(db, "player1@test.com")
    user2, token2 = await register_user(db, "player2@test.com")
    agent1 = await create_agent(db, user1.id, "Agent1")
    agent2 = await create_agent(db, user2.id, "Agent2")

    # Join arena
    await join_arena(db, agent1.id, "bronze")
    await join_arena(db, agent2.id, "bronze")

    # Match
    await scheduler_tick(db)
    assert agent1.status == "playing"
    assert agent2.status == "playing"

    # Play a hand
    for _ in range(50):  # max iterations
        state1 = await get_game_state(db, agent1.id)
        if state1["status"] == "your_turn":
            await submit_action(db, agent1.id, state1["hand_id"], "call")
        state2 = await get_game_state(db, agent2.id)
        if state2["status"] == "your_turn":
            await submit_action(db, agent2.id, state2["hand_id"], "call")
        # Check if hand is complete
        hand = await get_current_hand(db, agent1.id)
        if hand.phase == "complete":
            break

    # Leave
    result1 = await leave_table(db, agent1.id)
    result2 = await leave_table(db, agent2.id)

    # Assertions
    assert result1["session_result"]["hands_played"] > 0
    # Verify wallet settlement
    user1_balance = await get_balance(db, user1.id)
    assert user1_balance == 5000 - result1["session_result"]["buy_in"] + result1["session_result"]["final_stack"]
    # Verify ELO updated
    assert result1["session_result"]["elo_change"] != 0 or result2["session_result"]["elo_change"] != 0
```

### tests/test_timeout.py (integration)
```python
async def test_timeout_auto_fold()
async def test_3_timeouts_auto_leave()
async def test_timeout_resets_on_valid_action()
```

---

## Seed Data (seed.py)

```python
ARENAS = [
    {"name": "Practice", "slug": "practice", "buy_in": 100, "small_blind": 1, "big_blind": 2, "reward_multiplier": 0.1, "is_practice": True},
    {"name": "Bronze", "slug": "bronze", "buy_in": 500, "small_blind": 5, "big_blind": 10, "reward_multiplier": 1.0},
    {"name": "Silver", "slug": "silver", "buy_in": 1000, "small_blind": 10, "big_blind": 20, "reward_multiplier": 1.5},
    {"name": "Gold", "slug": "gold", "buy_in": 5000, "small_blind": 50, "big_blind": 100, "reward_multiplier": 2.0},
]

FICTIONAL_USERS = [
    {"username": "bluff_master", "agent_name": "BluffBot", "arena": "bronze"},
    {"username": "tight_player", "agent_name": "TightAgent", "arena": "bronze"},
    {"username": "aggro_smith", "agent_name": "AggroSmith", "arena": "silver"},
    {"username": "ranker_99", "agent_name": "RankBot99", "arena": "silver"},
    {"username": "practice_king", "agent_name": "PracticeKing", "arena": "practice"},
]
```

---

## Cleanup Checklist

```
backend/
  DELETE: app/engine/configurable_bot.py
  DELETE: app/engine/presets.py
  DELETE: app/engine/runner.py
  DELETE: app/engine/hand_evaluator.py
  DELETE: app/api/bots.py
  DELETE: app/api/matches.py
  DELETE: app/services/bot_service.py
  DELETE: app/services/feedback_service.py (adaptar a v3 o eliminar si no hay templates)
  DELETE: app/queue_bots.py
  MODIFY: requirements.txt (quitar pypokerengine, treys)
  VERIFY: No hay imports de ConfigurableBot, BotConfig, BotVersion en ningún archivo

frontend/
  DELETE: src/pages/BotEditorPage.tsx
  DELETE: src/pages/BotDetailPage.tsx
  DELETE: src/pages/BotsPage.tsx
  DELETE: src/pages/BattlePage.tsx
  DELETE: src/pages/MatchLivePage.tsx
  DELETE: src/pages/OnboardingPage.tsx
  DELETE: src/components/TacticalSlider.tsx
  DELETE: src/components/EfficiencyRadar.tsx
  DELETE: src/components/BotCard.tsx
  DELETE: src/api/bots.ts
  DELETE: src/api/matches.ts
```

---

## Archivos

```
backend/
  app/seed.py                   # Rewrite con arenas v3 + agentes ficticios
  app/queue_bots.py             # ELIMINAR
  tests/test_engine.py          # Nuevo
  tests/test_e2e_game.py        # Nuevo
  tests/test_timeout.py         # Nuevo
  requirements.txt              # Limpiar
```
