# Spec Funcional: Scheduler y Matchmaking

**Feature**: scheduler-matchmaking | **Status**: Approved | **Lang**: es

---

## Problema

El scheduler v1 ejecuta manos en batch de forma sincrona. En v3, las manos se ejecutan via API polling -- el scheduler solo necesita gestionar: emparejar agentes en cola, detectar timeouts (30s), iniciar nuevas manos en mesas idle, y liquidar sesiones terminadas. El matchmaking tambien estaba "stubbeado" (siempre retornaba True).

---

## Objetivos

1. Scheduler ligero que gestiona estados de mesas sin ejecutar logica de poker.
2. Matchmaking real con rango ELO y expansion progresiva.
3. Deteccion de timeouts en 30s (requiere tick frecuente ~5s).
4. Cash game continuo: re-sentar agentes en sillas vacias.

---

## User Stories

### US-1: Emparejamiento de agentes
**Como** plataforma, **quiero** emparejar agentes en cola con criterios de ELO, **para** que compitan contra rivales de nivel similar.

**Acceptance Criteria**:
- AC-1.1: Rango ELO inicial +-200. Si pasan 5 minutos sin match, ampliar +50 por minuto hasta cap de 1000.
- AC-1.2: No emparejar agentes del mismo usuario.
- AC-1.3: Cooldown de 5 minutos entre rematches del mismo par.
- AC-1.4: Al emparejar: crear Table, transicionar ambas Sessions a "playing", iniciar primera mano.

### US-2: Deteccion de timeouts
**Como** plataforma, **quiero** detectar cuando un agente no responde en 30s, **para** auto-fold y evitar que una mesa quede bloqueada.

**Acceptance Criteria**:
- AC-2.1: Cada tick, el scheduler compara Table.action_deadline con now(). Si vencio: auto-fold.
- AC-2.2: Despues del auto-fold, incrementar Session.timeout_count y Agent.consecutive_timeouts.
- AC-2.3: Si Agent.consecutive_timeouts >= 3: auto-leave (cerrar sesion, liquidar, liberar silla).
- AC-2.4: Si el agente envia una accion valida, resetear consecutive_timeouts a 0.

### US-3: Re-seating continuo
**Como** plataforma, **quiero** llenar sillas vacias automaticamente, **para** que las mesas siempre tengan actividad.

**Acceptance Criteria**:
- AC-3.1: Si una mesa tiene una silla vacia y hay agentes en cola en la misma arena con ELO compatible, sentar al siguiente.
- AC-3.2: Si ambas sillas estan vacias (mesa idle), destruir la mesa (status = completed).

### US-4: Mesas idle -> nueva mano
**Como** plataforma, **quiero** iniciar automaticamente la siguiente mano cuando una termina, **para** un cash game continuo sin gaps.

**Acceptance Criteria**:
- AC-4.1: Si una mano se completa y ambos agentes siguen activos, iniciar nueva mano inmediatamente en el mismo tick.
- AC-4.2: El dealer_seat rota cada mano.

---

## Scope

**In**: Scheduler tick, matchmaker con ELO real, timeout detection, re-seating, auto-start next hand.
**Out**: Ejecucion de logica de poker (es responsabilidad del engine + table_manager).

---

## Business Rules

1. Tick del scheduler: cada 5 segundos (reducido de 30s para timeouts responsivos).
2. El scheduler no ejecuta acciones de poker, solo gestiona estados.
3. Si el matchmaker no encuentra par compatible, el agente sigue en cola.
4. La sesion se cierra con exit_reason correcto: "timeout_exceeded", "stack_zero", "agent_leave", "opponent_exit".

---

## Dependencies

| Dependencia | Tipo | Uso |
|-------------|------|-----|
| game-api | Feature | TableManager, SessionManager |
