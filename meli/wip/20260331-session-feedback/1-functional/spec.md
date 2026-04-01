# Spec Funcional: Session Feedback

**Feature**: session-feedback | **Status**: Draft | **Lang**: es

---

## Problema

Sin feedback claro post-partida, el usuario no sabe qué pasó ni qué cambiar. El producto se siente como tirar una moneda al aire. El feedback es lo que cierra el loop de iteración y hace que el usuario vuelva a editar su bot.

---

## Objetivos

1. Proveer resumen claro y accionable después de cada sesión.
2. Destacar momentos clave para que el usuario entienda causa-efecto.
3. Facilitar la decisión de qué ajustar en la próxima versión del bot.

---

## User Stories

### US-1: Resumen de sesión
**Como** usuario, **quiero** ver un resumen de la sesión cuando mi bot se levanta, **para** saber cómo le fue.

**Acceptance Criteria**:
- AC-1.1: KPIs grandes: XP ganado/perdido, win rate (manos ganadas/jugadas), cambio de ranking (PTS), duración total.
- AC-1.2: Session outcome badge: "Victory" o "Defeat".
- AC-1.3: Nombre y ELO del rival.
- AC-1.4: Arena donde se jugó.

### US-2: Eventos clave
**Como** usuario, **quiero** ver los 3-5 momentos más relevantes de la sesión, **para** entender qué decisiones importaron.

**Acceptance Criteria**:
- AC-2.1: Se seleccionan los 3-5 eventos más impactantes por tamaño de pot y significancia estratégica.
- AC-2.2: Cada evento tiene descripción generada por template con variables contextuales.
- AC-2.3: Ejemplos de templates:
  - "Perdió pot de {pot_size} fichas por exceso de agresividad en el {phase}."
  - "Bluff exitoso en mano #{n}: el rival foldeó ante un overbet de {amount}."
  - "All-in en mano #{n}: ganó con {winning_hand} vs {losing_hand}."
  - "El rival explotó su alta fold_to_pressure con raises frecuentes."
  - "Se levantó al alcanzar {multiplier}x el buy-in (leave_threshold_up)."
- AC-2.4: 15-20 templates disponibles, sin LLM.

### US-3: Performance Breakdown
**Como** usuario, **quiero** ver un gráfico de performance por mano, **para** visualizar la tendencia.

**Acceptance Criteria**:
- AC-3.1: Bar chart mostrando ganancia/pérdida por mano (verde wins, rojo losses).
- AC-3.2: Eje X: número de mano. Eje Y: fichas ganadas/perdidas.

### US-4: Architect Insights
**Como** usuario, **quiero** ver análisis de fortalezas, vulnerabilidades y recomendaciones, **para** saber qué ajustar.

**Acceptance Criteria**:
- AC-4.1: Strength: qué hizo bien el bot (ej: "performed optimally in opening rounds").
- AC-4.2: Vulnerability: qué hizo mal (ej: "struggled in defensive strategies").
- AC-4.3: Advisory: recomendación concreta (ej: "Adjust entropy threshold to 0.96 for defensive matchups").
- AC-4.4: Insights derivados del análisis de HandEvents (patterns de acciones).

### US-5: CTAs post-sesión
**Como** usuario, **quiero** acciones rápidas después de ver resultados, **para** continuar el loop.

**Acceptance Criteria**:
- AC-5.1: "Go to Dashboard" → navega al dashboard.
- AC-5.2: "Tweak Bot (v2.5)" → navega al editor con la versión actual.
- AC-5.3: "Battle Again" → re-entra a la misma arena.

### US-6: Top Rivals
**Como** usuario, **quiero** ver los rivales que enfrentó mi bot, **para** contexto.

**Acceptance Criteria**:
- AC-6.1: Tabla: bot designation, architect (dueño), outcome (win/loss badge).

---

## Scope

**In**: Resumen de sesión, eventos clave via templates, performance chart, Architect Insights, CTAs, top rivals.
**Out**: Replay mano a mano interactivo, chat post-partida, compartir resultados socialmente, LLM para generar insights.

---

## Business Rules

1. Los eventos se generan a partir de HandEvents logueados por el engine.
2. Generación por templates con variables (no requiere LLM).
3. Se seleccionan los 3-5 más impactantes por pot size y significancia.
4. Insights se derivan de patterns en las acciones (frecuencia fold, agresividad, etc.).

---

## Dependencies

| Dependencia | Tipo | Uso |
|-------------|------|-----|
| arena-matchmaking | Feature | Sesiones completadas con HandEvents |
| bot-builder | Feature | Versión del bot, comparación |

---

## Pantallas Stitch

- `battle_session_results/`: "Session Success/Defeat" con KPIs, chart, insights, rivals
