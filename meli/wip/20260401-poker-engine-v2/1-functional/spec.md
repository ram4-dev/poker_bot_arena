# Spec Funcional: Poker Engine v2

**Feature**: poker-engine-v2 | **Status**: Approved | **Lang**: es

---

## Problema

El motor v1 usa PyPokerEngine con ConfigurableBot (un bot determinístico con 17 parámetros) para ejecutar manos completas en batch de forma síncrona. En v3, los agentes son externos: el motor debe ser una state machine que espera input externo vía API, no ejecutar ambos jugadores internamente.

Además, PyPokerEngine implementa Hold'em completo (4 streets). V3 usa Hold'em simplificado: preflop → flop → river (sin turn).

---

## Objetivos

1. Motor custom de Hold'em simplificado (3 streets) sin dependencias externas.
2. State machine: el motor expone el estado actual y espera una acción del agente correcto antes de avanzar.
3. Validación de acciones: rechazar inválidas con mensaje de error claro.
4. Evaluador de manos que compare best 5 de 6 cartas (2 hole + 4 community).

---

## User Stories

### US-1: Motor espera input externo
**Como** plataforma, **quiero** un motor que exponga game_state y espere acciones externas, **para** que los agentes de los usuarios puedan jugar vía API.

**Acceptance Criteria**:
- AC-1.1: `HoldemHand.get_state(agent_id)` retorna el game_state desde la perspectiva del agente (sus cartas, oculta las del oponente).
- AC-1.2: `HoldemHand.apply_action(agent_id, action, amount)` valida la acción, la aplica si es válida, y retorna ActionResult.
- AC-1.3: Si la acción es inválida, retorna error con mensaje descriptivo sin modificar el estado.
- AC-1.4: El motor no llama ningún LLM ni servicio externo.

### US-2: Hold'em simplificado (3 streets)
**Como** plataforma, **quiero** Hold'em con preflop → flop → river (sin turn), **para** simplificar la variante del MVP.

**Acceptance Criteria**:
- AC-2.1: Dealing: 2 hole cards por jugador, 3 cartas comunitarias en flop, 1 carta adicional en river. Total: 6 cartas posibles.
- AC-2.2: No existe fase "turn". Después del flop betting, se pasa directamente al river.
- AC-2.3: Blinds se postean automáticamente al inicio de la mano. SB = small_blind, BB = big_blind.
- AC-2.4: Dealer/SB actúa primero en preflop (si hay acción después del BB). En postflop, el no-dealer actúa primero.

### US-3: Acciones válidas
**Como** agente, **quiero** enviar acciones con validación clara, **para** saber qué está permitido en cada momento.

**Acceptance Criteria**:
- AC-3.1: Acciones: fold, check, call, raise, all_in.
- AC-3.2: check solo válido si current_bet == 0 (o el jugador ya igualó).
- AC-3.3: call iguala current_bet. Si stack < current_bet → all_in automático.
- AC-3.4: raise debe ser >= min_raise (último raise * 2, mínimo big_blind) y <= stack.
- AC-3.5: all_in pushea todo el stack restante independientemente del bet.
- AC-3.6: Acción inválida retorna: `{"valid": false, "error": "mensaje descriptivo"}`.

### US-4: Evaluación de showdown
**Como** plataforma, **quiero** un evaluador que determine el ganador del showdown, **para** adjudicar el pot correctamente.

**Acceptance Criteria**:
- AC-4.1: Evalúa best 5 cards de 6 disponibles (2 hole + 4 community: 3 flop + 1 river).
- AC-4.2: Rankings: Royal Flush > Straight Flush > Four of a Kind > Full House > Flush > Straight > Three of a Kind > Two Pair > Pair > High Card.
- AC-4.3: Tie: pot se divide en partes iguales.
- AC-4.4: En all-in con stack desigual: side pot calculado correctamente.

---

## Scope

**In**: HoldemHand state machine, Deck, HandEvaluator, validación de acciones, 3-street flow.
**Out**: Llamadas a LLM, persistencia en DB, networking, timeouts (los maneja el scheduler).

---

## Business Rules

1. Un mazo estándar de 52 cartas, barajado al inicio de cada mano.
2. El motor no conoce el concepto de "timeout" — si no hay acción, simplemente no avanza.
3. Blinds se postean como acciones automáticas al inicializar la mano.
4. El motor es determinístico dado un seed de mazo fijo (útil para tests).

---

## Dependencies

| Dependencia | Tipo | Uso |
|-------------|------|-----|
| data-model-migration | Feature | Tipos GameState, ActionResult |
