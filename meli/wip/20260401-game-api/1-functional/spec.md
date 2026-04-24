# Spec Funcional: Game API

**Feature**: game-api | **Status**: Approved | **Lang**: es

---

## Problema

En v3, los agentes son externos y se comunican con la plataforma via REST. Necesitamos los endpoints que permiten a un agente: unirse a una arena, consultar si es su turno (polling), enviar acciones, y levantarse de la mesa. Este es el corazon del producto.

---

## Objetivos

1. Exponer endpoints REST para que cualquier agente (independientemente del lenguaje o LLM) pueda jugar.
2. Manejar validacion de acciones con sistema de reintentos (max 2, luego auto-fold).
3. Orquestar el ciclo de vida de una mano de punta a punta (inicio, acciones, conclusion, siguiente mano).

---

## User Stories

### US-1: Unirse a una arena
**Como** agente, **quiero** unirme a una arena con mi agent_id, **para** entrar en cola y eventualmente jugar.

**Acceptance Criteria**:
- AC-1.1: `POST /api/arena/join` con `{agent_id, arena_id}` encola al agente.
- AC-1.2: Validar que el agente no esta ya en cola o en mesa.
- AC-1.3: Validar que el usuario tiene balance suficiente para el buy-in.
- AC-1.4: Lockear buy-in en wallet al encolar.
- AC-1.5: Retornar `{status: "queued", position: N}` donde N es posicion en cola.

### US-2: Polling de estado (GET /api/game/state)
**Como** agente, **quiero** consultar periodicamente si es mi turno, **para** saber cuando debo enviar una accion.

**Acceptance Criteria**:
- AC-2.1: `GET /api/game/state?agent_id=uuid` retorna `{"status": "waiting"}` si no es turno del agente.
- AC-2.2: Si es turno, retorna `{"status": "your_turn", ...game_state completo...}`.
- AC-2.3: El game_state incluye: hand_id, phase, my_cards, community_cards, my_stack, opponent_stack, pot, my_position, current_bet, min_raise, actions_this_round, hand_history, session stats, timeout_seconds.
- AC-2.4: Al servir `your_turn`, se registra el timestamp y se setea action_deadline en Table (now + 30s).
- AC-2.5: Rate limit de polling: 2 req/s por agente.

### US-3: Enviar accion (POST /api/game/action)
**Como** agente, **quiero** enviar mi accion cuando es mi turno, **para** que el engine la procese.

**Acceptance Criteria**:
- AC-3.1: `POST /api/game/action` con `{agent_id, hand_id, action, amount?}`.
- AC-3.2: Si la accion es valida: aplicar, retornar `{"status": "ok", "next": "waiting"|"your_turn"}`.
- AC-3.3: Si la accion es invalida: retornar `{"status": "invalid_action", "message": "...", "retries_left": N}` sin cambiar estado.
- AC-3.4: Maximo 2 reintentos por turno. Al 3er intento invalido o si manda una accion cuando no es su turno: auto-fold.
- AC-3.5: Validar que hand_id corresponde a la mano activa del agente.

### US-4: Levantarse de la mesa
**Como** agente, **quiero** salir de la mesa cuando decida, **para** liquidar mi sesion y retirar mis fichas.

**Acceptance Criteria**:
- AC-4.1: `POST /api/game/leave` con `{agent_id}` inicia salida voluntaria.
- AC-4.2: Si el agente esta en medio de una mano, termina la mano actual (fold automatico si es su turno) y luego sale.
- AC-4.3: Retornar session_result: hands_played, buy_in, final_stack, profit, elo_change.
- AC-4.4: Si el agente solo esta en cola (no en mesa), salir directamente y devolver buy-in.

### US-5: Estado de la sesion
**Como** agente, **quiero** saber el estado de mi sesion en cualquier momento, **para** tomar decisiones de bankroll.

**Acceptance Criteria**:
- AC-5.1: El game_state incluye session stats en cada polling: hands_played, initial_stack, current_profit.
- AC-5.2: Si el stack llega a 0, la sesion termina automaticamente (igual a auto-leave).

---

## Scope

**In**: Endpoints arena/join, game/state, game/action, game/leave. TableManager que orquesta el engine. SessionManager para lifecycle de sesiones.
**Out**: Webhook push (MVP es polling puro), streaming, multiples mesas por agente.

---

## Business Rules

1. Un agente solo puede estar en una mesa a la vez.
2. Timeout 30s: si el agente no envia accion en 30s, auto-fold.
3. Reintentos de accion: max 2. Al 3er intento invalido -> auto-fold.
4. 3 timeouts consecutivos -> auto-leave (settle sesion + liberar silla).
5. Stack = 0 -> auto-leave automatico.

---

## Dependencies

| Dependencia | Tipo | Uso |
|-------------|------|-----|
| data-model-migration | Feature | Modelos Agent, Session, Table |
| poker-engine-v2 | Feature | HoldemHand, GameState, ActionResult |
