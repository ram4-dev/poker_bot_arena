# Spec Funcional: Data Model Migration

**Feature**: data-model-migration | **Status**: Approved | **Lang**: es

---

## Problema

El modelo de datos v1 se basa en `Bot` y `BotVersion` con 17 parámetros configurables. En v3 la plataforma es pura API: los agentes son entidades externas sin configuración interna. El modelo debe reflejar esto y agregar soporte para tracking de timeouts (30s por acción).

---

## Objetivos

1. Reemplazar Bot/BotVersion con un modelo Agent simple (sin config, sin versiones de parámetros).
2. Actualizar Session, Table y Hand para el flujo API-driven.
3. Agregar settings de configuración para el nuevo comportamiento.

---

## User Stories

### US-1: Agente sin configuración interna
**Como** plataforma, **quiero** un modelo Agent que represente un agente externo, **para** que la inteligencia sea 100% del lado del usuario.

**Acceptance Criteria**:
- AC-1.1: Agent tiene: id, user_id, name, status (idle/queued/playing/suspended), elo, total_wins, total_losses, total_hands, consecutive_timeouts.
- AC-1.2: No hay tabla agent_versions ni config_json.
- AC-1.3: Máximo 3 agentes por usuario (validado en servicio).
- AC-1.4: ELO inicial: 1000. Status inicial: idle.

### US-2: Session referencia Agent
**Como** plataforma, **quiero** que Session referencie Agent (no Bot+BotVersion), **para** simplificar el modelo.

**Acceptance Criteria**:
- AC-2.1: Session tiene agent_id (FK a agents) en vez de bot_id + bot_version_id.
- AC-2.2: Session tiene timeout_count para trackear timeouts consecutivos en la sesión.
- AC-2.3: exit_reason incluye nuevos valores: "timeout_exceeded" y "agent_leave".

### US-3: Table soporta timeout tracking
**Como** plataforma, **quiero** que Table tenga campos para saber qué agente debe actuar y cuándo vence el timeout, **para** que el scheduler pueda detectar timeouts.

**Acceptance Criteria**:
- AC-3.1: Table tiene: current_hand_id, dealer_seat (1|2), pending_action_agent_id, action_deadline (datetime UTC).
- AC-3.2: action_deadline se setea cuando el engine sirve el game_state.
- AC-3.3: El scheduler compara action_deadline con now() para detectar timeout.

### US-4: Hand soporta 3 streets
**Como** plataforma, **quiero** que Hand soporte exactamente 3 phases (preflop/flop/river), **para** el Hold'em simplificado sin turn.

**Acceptance Criteria**:
- AC-4.1: Hand tiene field `phase` (preflop/flop/river/showdown/complete).
- AC-4.2: Hand tiene `current_bet` y `pot_main` para estado de apuestas.
- AC-4.3: HandEvent.street nunca tiene valor "turn".

---

## Scope

**In**: Migración de modelos Bot→Agent, actualización Session/Table/Hand, nuevos settings, migración Alembic.
**Out**: Lógica de negocio, endpoints API, ejecución de manos.

---

## Business Rules

1. No puede existir tabla bot_versions en v3.
2. Agent.consecutive_timeouts se resetea a 0 al completar una mano exitosamente.
3. Session.timeout_count acumula timeouts en la sesión actual.
4. Table.action_deadline es NULL cuando no hay acción pendiente.

---

## Dependencies

| Dependencia | Tipo | Uso |
|-------------|------|-----|
| Ninguna | - | Feature base |
