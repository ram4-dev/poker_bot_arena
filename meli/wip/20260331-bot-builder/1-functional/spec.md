# Spec Funcional: Bot Builder

**Feature**: bot-builder | **Status**: Draft | **Lang**: es

---

## Problema

Los usuarios necesitan una herramienta para crear, configurar y versionar sus bots de poker. El builder debe ser lo suficientemente intuitivo para que la configuración se sienta como una decisión estratégica, no como programación.

---

## Objetivos

1. Permitir crear y gestionar hasta 3 bots con personalidad única.
2. Hacer que el ajuste de parámetros se sienta como una decisión estratégica via sliders + radar chart.
3. Proveer versionado inmutable para percibir progreso.

---

## User Stories

### US-1: Crear bot
**Como** usuario, **quiero** crear un bot eligiendo un preset, nombre e icono, **para** tener mi primera unidad de combate.

**Acceptance Criteria**:
- AC-1.1: Formulario con nombre (requerido), icono/color (selector), descripción (opcional).
- AC-1.2: Selector de preset: Agresivo, Conservador, Balanceado, Oportunista, Bluffero.
- AC-1.3: Al crear, se genera automáticamente la versión v1 con los valores del preset.
- AC-1.4: Máximo 3 bots por usuario. Botón "Create" deshabilitado con tooltip si ya tiene 3.
- AC-1.5: Bot se crea con status "idle" y ELO 1000.

### US-2: Editar configuración
**Como** usuario, **quiero** ajustar los 14 parámetros de mi bot via sliders, **para** refinar su estrategia.

**Acceptance Criteria**:
- AC-2.1: Sliders agrupados en 5 categorías:
  - Preflop: hand_threshold (0-1), raise_tendency (0-1), three_bet_frequency (0-1)
  - Postflop: aggression (0-1), bluff_frequency (0-1), fold_to_pressure (0-1), continuation_bet (0-1)
  - Sizing: bet_size_tendency (0-1), overbet_willingness (0-1)
  - Meta: risk_tolerance (0-1), survival_priority (0-1), adaptation_speed (0-1, reservado)
  - Gestión de Mesa: leave_threshold_up (float, ej: 1.5), leave_threshold_down (float, ej: 0.3), min_hands_before_leave (int, 5-50), rebuy_willingness (0-1), session_max_hands (int, 20-500)
- AC-2.2: Radar chart (pentagon/hexagon) muestra el perfil resultante en tiempo real.
- AC-2.3: Selector de preset que pre-llena todos los sliders.
- AC-2.4: Se puede cambiar nombre, icono y descripción del bot.

### US-3: Guardar nueva versión
**Como** usuario, **quiero** guardar mis cambios como nueva versión, **para** mantener historial y poder comparar.

**Acceptance Criteria**:
- AC-3.1: Botón "Save as New Version" crea versión inmutable (v1, v2, v3...).
- AC-3.2: La nueva versión se marca como activa automáticamente.
- AC-3.3: Máximo 10 versiones por día por bot (rate limit).
- AC-3.4: Versiones anteriores no se pueden borrar ni modificar.
- AC-3.5: Botón "Apply Changes" actualiza la versión activa sin crear nueva (solo metadata como nombre).

### US-4: Ver lista de bots (Fleet Overview)
**Como** usuario, **quiero** ver todos mis bots con su estado actual, **para** gestionar mi flota.

**Acceptance Criteria**:
- AC-4.1: Grid/lista con cards de cada bot.
- AC-4.2: Cada card muestra: nombre, avatar, status badge (idle/queued/playing), versión activa, ELO, winrate.
- AC-4.3: Tabs para filtrar: All, Active, Idle.
- AC-4.4: Stats agregados: total bots deployed, total XP.
- AC-4.5: Click en bot → navega a detalle.

### US-5: Ver detalle de bot (Deep Dive)
**Como** usuario, **quiero** ver estadísticas detalladas de mi bot, **para** entender su rendimiento.

**Acceptance Criteria**:
- AC-5.1: Header: avatar, nombre, winrate, XP, ELO, efficiency.
- AC-5.2: Last 10 Streak: barra visual de últimos 10 resultados (W/L).
- AC-5.3: Top Performances: mejores partidas.
- AC-5.4: Strategic Insights: vulnerabilidades detectadas, fatigue alerts, recomendaciones.
- AC-5.5: Match Log: tabla con fecha, oponente, arena, resultado (+/- XP).

### US-6: Comparar versiones
**Como** usuario, **quiero** comparar 2 versiones de mi bot lado a lado, **para** ver qué cambié y si mejoró.

**Acceptance Criteria**:
- AC-6.1: Seleccionar 2 versiones del historial.
- AC-6.2: Ver diff de configuración (qué parámetros cambiaron y cuánto).
- AC-6.3: Ver stats lado a lado: winrate, profit/loss, manos jugadas, ELO change.

---

## Scope

**In**: CRUD bots, 14 sliders con presets, radar chart, versionado inmutable, Fleet Overview, Bot Detail, comparación versiones.
**Out**: Código arbitrario de bots, marketplace, compartir bots, clonar bots de otros usuarios.

---

## Business Rules

1. Máximo 3 bots por usuario.
2. Máximo 10 versiones por día por bot.
3. Solo 1 versión activa por bot a la vez.
4. Versiones inmutables: no se borran ni modifican.
5. ELO inicial del bot: 1000.
6. Status del bot: idle (disponible), queued (en cola), playing (en mesa).
7. No se puede editar un bot que está en status "playing".

---

## Dependencies

| Dependencia | Tipo | Uso |
|-------------|------|-----|
| auth-onboarding | Feature | Usuario autenticado requerido |
| poker-engine | Feature | Presets de configuración (valores) |

---

## Pantallas Stitch

- `my_bots_overview/`: Fleet Overview con grid de bots
- `bot_tactical_editor/`: Tactical Editor con sliders + radar
- `bot_deep_dive_detail/`: Detalle con stats e insights
- `states_feedback_components/`: Empty state "The Hangar is Empty"
