# Spec Funcional: Poker Engine

**Feature**: poker-engine | **Status**: Draft | **Lang**: es

---

## Problema

Se necesita un motor de poker que ejecute partidas entre dos bots configurables y produzca resultados determinísticos (con varianza controlada) basados en los parámetros de cada bot. El motor debe ser puro (sin I/O, sin DB) para ser testeable en aislamiento.

---

## Objetivos

1. Ejecutar manos completas de Texas Hold'em entre 2 bots configurados.
2. Traducir 14 parámetros de configuración en decisiones de poker realistas.
3. Producir eventos detallados de cada mano para replay y feedback.

---

## User Stories

### US-1: Ejecutar mano completa
**Como** sistema, **quiero** ejecutar una mano de Texas Hold'em entre 2 bots con sus configs, **para** producir un resultado (ganador, pot, eventos).

**Acceptance Criteria**:
- AC-1.1: Se ejecutan las 4 calles estándar: preflop → flop → turn → river → showdown.
- AC-1.2: Blinds se postean automáticamente (SB/BB rotan cada mano).
- AC-1.3: Se genera una lista de HandEvents con cada acción (fold, check, call, raise, all_in) y su monto.
- AC-1.4: Si alguien foldea, el otro gana el pot sin showdown.
- AC-1.5: En showdown, gana la mejor combinación de 5 cartas (de 2 hole + 5 community).
- AC-1.6: Se manejan correctamente los escenarios de all-in.

### US-2: Bot configurable con 14 parámetros
**Como** sistema, **quiero** que un bot tome decisiones basadas en sus 14 parámetros de config, **para** que cada configuración produzca un estilo de juego distinto.

**Acceptance Criteria**:
- AC-2.1: Preflop: hand_threshold determina selectividad, raise_tendency decide call vs raise, three_bet_frequency controla re-raises.
- AC-2.2: Postflop: aggression, bluff_frequency, fold_to_pressure, continuation_bet determinan el comportamiento.
- AC-2.3: Sizing: bet_size_tendency (relativo al pot), overbet_willingness.
- AC-2.4: Meta: risk_tolerance (draws/marginales), survival_priority (short stack → tighter).
- AC-2.5: Varianza de ±10-15% aplicada a cada decisión para evitar determinismo total.
- AC-2.6: Todas las acciones validadas como legales (no apostar más de lo que tiene, min-raise válido).

### US-3: Ejecutar sesión completa
**Como** sistema, **quiero** ejecutar una sesión de N manos entre 2 bots, **para** simular una sesión de cash game.

**Acceptance Criteria**:
- AC-3.1: Se ejecutan manos hasta que se cumpla una condición de salida.
- AC-3.2: Condiciones de salida: stack=0, leave_threshold_up alcanzado, leave_threshold_down alcanzado, session_max_hands alcanzado.
- AC-3.3: min_hands_before_leave debe cumplirse antes de evaluar thresholds.
- AC-3.4: Se retorna resultado de sesión con: lista de resultados por mano, stacks finales, manos jugadas.

### US-4: Presets de configuración
**Como** sistema, **quiero** ofrecer 5 presets predefinidos, **para** que los usuarios tengan un punto de partida.

**Acceptance Criteria**:
- AC-4.1: Preset Agresivo: hand_threshold bajo, aggression alto, bluff alto, leave_threshold_up alto.
- AC-4.2: Preset Conservador: hand_threshold alto, aggression bajo, fold_to_pressure alto, survival alto.
- AC-4.3: Preset Balanceado: todos los valores ~0.5.
- AC-4.4: Preset Oportunista: bluff medio-alto, adaptation_speed alto, fold_to_pressure bajo.
- AC-4.5: Preset Bluffero: bluff alto, aggression alto, bet_size_tendency alto.

---

## Scope

**In**: Motor de mano, lógica de decisión, evaluación de manos, sesión completa, presets, tipos/dataclasses.
**Out**: Persistencia en DB, API endpoints, UI, matchmaking, wallet.

---

## Business Rules

1. El engine es puro: sin I/O, sin side effects. Inputs y outputs son dataclasses.
2. Varianza ±10-15% en todas las decisiones.
3. Evaluación de manos usa treys (mejores 5 de 7 cartas).
4. hand_strength normalizado 0.0-1.0 para decisiones mid-hand.
5. El engine usa PyPokerEngine como base (BasePokerPlayer).

---

## Dependencies

| Dependencia | Tipo | Uso |
|-------------|------|-----|
| PyPokerEngine | Library | Game engine (dealer, calles, pot, showdown) |
| treys | Library | Evaluación de fuerza de mano mid-hand |
