# Spec Funcional: Integration y Cleanup

**Feature**: integration-cleanup | **Status**: Approved | **Lang**: es

---

## Problema

Una vez implementadas las features 1-6, el sistema necesita wiring final, datos de seed actualizados para v3, tests E2E que validen el flujo completo, y limpieza de código muerto (pypokerengine, schemas huérfanos, scripts obsoletos).

---

## Objetivos

1. Flujo completo funcionando E2E: register → create agent → join arena → play → leave.
2. Seed data v3 (arenas correctas, sin bots/versions).
3. Limpieza de dependencias y código muerto.
4. Test suite básico que dé confianza para deploy.

---

## User Stories

### US-1: E2E funcional
**Como** desarrollador, **quiero** un test que simule dos agentes jugando una sesión completa, **para** tener confianza de que el sistema funciona de punta a punta.

**Acceptance Criteria**:
- AC-1.1: Test registra 2 usuarios, cada uno crea un agente.
- AC-1.2: Ambos se unen a la misma arena.
- AC-1.3: Scheduler tick empareja los agentes.
- AC-1.4: Agente 1 hace polling y recibe game_state.
- AC-1.5: Agente 1 envía acción válida. Engine avanza.
- AC-1.6: Agente 2 hace polling y recibe game_state. Envía acción.
- AC-1.7: El loop continúa hasta que la mano termina.
- AC-1.8: Ambos se levantan. Wallet settlement y ELO update verificados.

### US-2: Seed data v3
**Como** desarrollador, **quiero** datos de seed actualizados, **para** poder probar el sistema con datos realistas.

**Acceptance Criteria**:
- AC-2.1: 4 arenas: Practice (buy-in 100, blinds 1/2), Bronze (500, 5/10), Silver (1000, 10/20), Gold (5000, 50/100).
- AC-2.2: 1 usuario demo + 5 usuarios ficticios con 1 agente cada uno, en cola en distintas arenas.
- AC-2.3: No hay datos de BotVersion ni presets.

### US-3: Limpieza de código
**Como** desarrollador, **quiero** eliminar todo el código v1 que no aplica en v3, **para** evitar confusión y dependencias innecesarias.

**Acceptance Criteria**:
- AC-3.1: pypokerengine y treys eliminados de requirements.txt.
- AC-3.2: No hay imports de ConfigurableBot, BotConfig, presets, runner.
- AC-3.3: queue_bots.py eliminado.
- AC-3.4: No hay schemas de BotVersion, BotConfigSchema.

---

## Scope

**In**: Tests E2E, seed data v3, cleanup de dependencias y código muerto.
**Out**: Features nuevas, cambios de lógica.

---

## Dependencies

| Dependencia | Tipo | Uso |
|-------------|------|-----|
| Todas las anteriores (1-6) | Feature | Sistema completo implementado |
