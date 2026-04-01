# Spec Funcional: Arena & Matchmaking

**Feature**: arena-matchmaking | **Status**: Approved | **Lang**: es

---

## Problema

Los bots necesitan un sistema para encontrar oponentes de nivel similar, sentarse en mesas y competir automáticamente. Sin un scheduler y matchmaking robusto, no hay loop de competencia.

---

## Objetivos

1. Proveer arenas con distintos niveles de riesgo para decisión estratégica.
2. Emparejar bots de nivel similar automáticamente.
3. Ejecutar partidas de forma asincrónica sin intervención del usuario.

---

## User Stories

### US-1: Ver arenas
**Como** usuario, **quiero** ver las arenas disponibles con sus stats, **para** decidir dónde competir.

**Acceptance Criteria**:
- AC-1.1: 3 arenas: Low Stakes (buy-in 100, blinds 1/2), Mid Stakes (buy-in 500, blinds 5/10), High Stakes (buy-in 2000, blinds 20/40).
- AC-1.2: Arena práctica: buy-in 0, ganancias ×0.1, siempre disponible.
- AC-1.3: Por cada arena: buy-in, blinds, bots en cola, mesas activas, estimated reward.
- AC-1.4: Risk level visual: Low/Mid/High con badges.
- AC-1.5: Arena Analytics Dashboard: total pool, server latency, winning rate, next flush timer.

### US-2: Entrar en cola
**Como** usuario, **quiero** seleccionar un bot y ponerlo en cola de una arena, **para** que encuentre oponente.

**Acceptance Criteria**:
- AC-2.1: Dropdown selector de bot (solo bots idle con versión activa).
- AC-2.2: Verificar balance suficiente para buy-in.
- AC-2.3: Al entrar: bot pasa a status "queued", se bloquea buy-in en wallet.
- AC-2.4: Un bot solo puede estar en una cola/mesa a la vez.
- AC-2.5: Botón "Select Arena" → confirmar entrada.

### US-3: Cancelar cola
**Como** usuario, **quiero** cancelar la cola antes de ser emparejado, **para** cambiar de opinión.

**Acceptance Criteria**:
- AC-3.1: Botón cancelar visible mientras bot está en estado "queued".
- AC-3.2: Al cancelar: bot vuelve a "idle", buy-in se devuelve al balance.
- AC-3.3: No se puede cancelar si ya fue emparejado (status "playing").

### US-4: Matchmaking automático
**Como** sistema, **quiero** emparejar bots compatibles automáticamente, **para** crear mesas y ejecutar partidas.

**Acceptance Criteria**:
- AC-4.1: Emparejar bots de la misma arena con ELO dentro de ±200 puntos.
- AC-4.2: Si un bot lleva mucho tiempo en cola, ampliar rango ELO progresivamente (+50/minuto).
- AC-4.3: No emparejar bots del mismo usuario.
- AC-4.4: Cooldown de 5 minutos entre rematches del mismo par.
- AC-4.5: Al emparejar: crear mesa, crear 2 sesiones, ambos bots pasan a "playing".

### US-5: Ejecución de manos
**Como** sistema, **quiero** ejecutar manos en batch en todas las mesas activas, **para** avanzar las partidas automáticamente.

**Acceptance Criteria**:
- AC-5.1: El scheduler corre cada 30 segundos.
- AC-5.2: En cada tick: procesar cola → crear mesas → ejecutar 5-10 manos por mesa → evaluar salidas → liquidar → limpiar.
- AC-5.3: Las manos se ejecutan usando el poker-engine.
- AC-5.4: Se persisten Hand + HandEvent por cada mano jugada.

### US-6: Condiciones de salida y liquidación
**Como** sistema, **quiero** evaluar condiciones de salida después de cada mano, **para** cerrar sesiones correctamente.

**Acceptance Criteria**:
- AC-6.1: Evaluar después de cada mano: stack=0, leave_threshold_up, leave_threshold_down, session_max_hands.
- AC-6.2: min_hands_before_leave debe cumplirse antes de evaluar thresholds.
- AC-6.3: Al salir: liquidar sesión (wallet settlement), actualizar ELO, bot vuelve a "idle".
- AC-6.4: Si ambas sillas quedan vacías, destruir mesa.
- AC-6.5: Cuando una silla queda vacía, el scheduler busca siguiente bot en cola.

### US-7: Battle Setup
**Como** usuario, **quiero** configurar y confirmar el despliegue de mi bot, **para** tener control antes de competir.

**Acceptance Criteria**:
- AC-7.1: Seleccionar Primary Unit (bot) y Battleground (arena).
- AC-7.2: Elegir Batch Simulation Size (1/5/10/20 manos).
- AC-7.3: Ver Risk Summary: costo, max reward, total commitment.
- AC-7.4: Botón "Confirm & Deploy".
- AC-7.5: Panel de sincronización con terminal de logs tácticos durante el deploy.

---

## Scope

**In**: 3 arenas + práctica, cola/dequeue, matchmaking por ELO, scheduler APScheduler, ejecución batch, condiciones de salida, liquidación, Battle Setup.
**Out**: Streaming en vivo, espectadores, matchmaking multi-jugador (>2), torneos.

---

## Business Rules

1. Blinds fijos por arena (no escalan).
2. Buy-in mínimo y máximo definido por arena.
3. Un bot solo puede estar en una mesa a la vez.
4. Si stack=0, el bot se levanta automáticamente.
5. Matchmaking: misma arena + ELO compatible + no mismo usuario + no rematch reciente.
6. Scheduler ejecuta cada 30 segundos (configurable).
7. El scheduler es idempotente: si se ejecuta 2 veces seguidas, no genera estado inconsistente.

---

## Dependencies

| Dependencia | Tipo | Uso |
|-------------|------|-----|
| poker-engine | Feature | Ejecución de manos |
| bot-builder | Feature | Configs de bots, estados |
| wallet-economy | Feature | Buy-in locking, settlement |

---

## Pantallas Stitch

- `arena_selection/`: "Select Arena" con 3 cards + analytics
- `battle_setup_runner/`: "Battle Setup" con unit selector + terminal
