# Spec Funcional: Wallet & Economy

**Feature**: wallet-economy | **Status**: Draft | **Lang**: es

---

## Problema

El juego necesita un sistema económico con moneda ficticia que genere tensión y decisiones estratégicas. Sin un costo real percibido, las arenas no generan engagement.

---

## Objetivos

1. Gestionar balance de moneda ficticia con operaciones atómicas.
2. Que las pérdidas "duelan" para generar tensión estratégica.
3. Proveer mecanismo de recuperación para que nadie quede fuera permanentemente.

---

## User Stories

### US-1: Ver balance
**Como** usuario, **quiero** ver mi balance disponible y bloqueado en todo momento, **para** saber cuánto puedo apostar.

**Acceptance Criteria**:
- AC-1.1: Balance visible en navbar (todas las pantallas).
- AC-1.2: Se muestra balance disponible y balance bloqueado (en mesa) por separado.
- AC-1.3: Pantalla de wallet muestra balance grande + gráfico de Performance Velocity.

### US-2: Historial de transacciones
**Como** usuario, **quiero** ver mi historial de movimientos económicos, **para** entender de dónde vienen mis ganancias y pérdidas.

**Acceptance Criteria**:
- AC-2.1: Tabla de transacciones (ledger) con: fecha, tipo, entidad, monto (+/-), balance resultante.
- AC-2.2: Filtrable por tipo (session_result, daily_rescue, initial_grant) y rango de fechas.
- AC-2.3: Tipos de transacción con badges visuales diferenciados.

### US-3: Rescate diario
**Como** usuario que perdió todo, **quiero** reclamar un rescate diario, **para** poder seguir jugando.

**Acceptance Criteria**:
- AC-3.1: Si balance = 0, aparece botón "Buy XP Credits" / rescate.
- AC-3.2: Otorga 500 fichas.
- AC-3.3: Máximo 1 vez por día (24h desde último rescate).
- AC-3.4: Se registra como LedgerEntry tipo "daily_rescue".

### US-4: Buy-in (bloqueo al entrar arena)
**Como** sistema, **quiero** bloquear el buy-in al entrar a una arena, **para** que las fichas en mesa no estén disponibles.

**Acceptance Criteria**:
- AC-4.1: Al entrar cola: balance -= buy_in, locked_balance += buy_in.
- AC-4.2: Operación atómica (una transacción).
- AC-4.3: Si balance < buy_in, no puede entrar (error claro).
- AC-4.4: Si cancela cola antes de ser emparejado, se devuelve el buy-in.

### US-5: Settlement (liquidación al salir)
**Como** sistema, **quiero** liquidar la sesión cuando un bot se levanta, **para** actualizar el balance correctamente.

**Acceptance Criteria**:
- AC-5.1: locked_balance -= buy_in, balance += fichas_finales.
- AC-5.2: Se crea LedgerEntry tipo "session_result" con monto = fichas_finales - buy_in.
- AC-5.3: Operación atómica.
- AC-5.4: Si fichas_finales > buy_in → ganancia. Si < → pérdida.

---

## Scope

**In**: Balance (disponible + bloqueado), buy-in locking, settlement, ledger, rescate diario, fichas iniciales, pantalla wallet.
**Out**: Moneda real, crypto, transferencias entre usuarios, compras in-app, retiros.

---

## Business Rules

1. Cada usuario nuevo recibe 5000 fichas al registrarse (initial_grant).
2. Balance nunca puede ser negativo.
3. Operaciones de wallet son atómicas (una transacción DB).
4. Rescate diario: solo si balance = 0, +500, máx 1/día.
5. Arena práctica: buy-in 0, ganancias multiplicadas por 0.1.
6. LedgerEntry tipos: session_result, daily_rescue, initial_grant.
7. Moneda 100% ficticia. Sin valor real.

---

## Dependencies

| Dependencia | Tipo | Uso |
|-------------|------|-----|
| auth-onboarding | Feature | Usuario autenticado, acreditación inicial |

---

## Pantallas Stitch

- `strategic_wallet/`: Digital Wallet con balance, Performance Velocity, Transaction Ledger
- `states_feedback_components/`: Alert "Deployment Blocked. Low XP" con CTA "Buy XP"
