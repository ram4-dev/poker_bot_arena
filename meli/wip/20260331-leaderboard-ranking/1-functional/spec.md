# Spec Funcional: Leaderboard & Ranking

**Feature**: leaderboard-ranking | **Status**: Draft | **Lang**: es

---

## Problema

Sin un sistema de ranking visible, los usuarios no tienen una referencia de dónde están parados ni motivación competitiva para mejorar. El leaderboard es el driver social del engagement.

---

## Objetivos

1. Proveer ranking transparente basado en ELO (no bankroll).
2. Motivar competencia y mejora continua con temporadas y badges.
3. Implementar anti-abuso básico para mantener la integridad.

---

## User Stories

### US-1: Ver leaderboard de usuarios
**Como** usuario, **quiero** ver el ranking global de usuarios por ELO, **para** saber mi posición.

**Acceptance Criteria**:
- AC-1.1: Tabla: rank, avatar, nombre, total XP/ELO, winrate, último match (tiempo relativo), badges.
- AC-1.2: Mi posición aparece fija en el footer (ej: "#422 - ARCHITECT_01 (YOU)").
- AC-1.3: Paginado o scroll infinito.

### US-2: Ver leaderboard de bots
**Como** usuario, **quiero** ver el ranking de los mejores bots, **para** inspirarme.

**Acceptance Criteria**:
- AC-2.1: Tab "Top Bots" con misma estructura que usuarios.
- AC-2.2: Muestra: nombre del bot, creator, ELO, winrate, badges.

### US-3: Temporadas
**Como** usuario, **quiero** que haya temporadas competitivas, **para** tener ciclos de competencia frescos.

**Acceptance Criteria**:
- AC-3.1: Tab "Monthly Season" con ranking del mes/quarter actual.
- AC-3.2: Temporadas automáticas por quarter (ej: "2026-Q2").
- AC-3.3: Al cerrar temporada, snapshot de ELO y rankings en SeasonRanking.
- AC-3.4: Filtro de temporada en dropdown.

### US-4: Filtros
**Como** usuario, **quiero** filtrar el leaderboard por arena y temporada, **para** ver rankings específicos.

**Acceptance Criteria**:
- AC-4.1: Filtro "Global Filter" con opciones por arena (Low/Mid/High/All).
- AC-4.2: Filtro por temporada (current, previous quarters).
- AC-4.3: Filtros combinables.

### US-5: Badges
**Como** usuario, **quiero** ver badges de logros en el leaderboard, **para** reconocimiento.

**Acceptance Criteria**:
- AC-5.1: Badges: "Strategy Master", "Bot on Fire", "Rookie of the Month".
- AC-5.2: Se asignan automáticamente basados en métricas (winrate alto, streak, nuevo usuario top).
- AC-5.3: Se muestran como chips coloridos junto al nombre.

### US-6: ELO System
**Como** sistema, **quiero** calcular ELO después de cada sesión, **para** mantener rankings actualizados.

**Acceptance Criteria**:
- AC-6.1: ELO estándar con K=32.
- AC-6.2: Expected score: 1 / (1 + 10^((opp_elo - player_elo) / 400)).
- AC-6.3: Actual score basado en ratio de profit (no solo win/loss): 0 = perdió todo, 0.5 = break even, 1 = duplicó.
- AC-6.4: Delta = K × (actual - expected), aplicado a bot y usuario.
- AC-6.5: ELO inicial: 1000 para usuarios y bots.

---

## Scope

**In**: Leaderboard usuarios y bots, ELO system, temporadas por quarter, badges, filtros, anti-abuso básico.
**Out**: Ranking por bankroll, rewards por posición, premios por temporada, leaderboard de equipos/clanes.

---

## Business Rules

1. Ranking por ELO, no por bankroll (para evitar que gane quien más juega).
2. ELO se actualiza al finalizar cada sesión (no por mano).
3. User ELO = promedio ponderado de sus bots.
4. Temporadas se detectan automáticamente por quarter.
5. Badges se recalculan periódicamente.

### Anti-abuso (incluido en esta feature)

6. Rate limit: 60 requests/minuto por usuario.
7. Máx 10 versiones/día por bot.
8. Detección multi-cuenta: mismo IP >2 registros en 24h → flag.
9. Logs inmutables de todas las manos.
10. No emparejar bots del mismo usuario (en matchmaking).
11. Cooldown 5 min entre rematches.

---

## Dependencies

| Dependencia | Tipo | Uso |
|-------------|------|-----|
| auth-onboarding | Feature | Usuarios registrados |
| arena-matchmaking | Feature | Sesiones completadas para calcular ELO |

---

## Pantallas Stitch

- `global_leaderboard/`: "Ascend the Architect Hierarchy", tabs, ranking table, posición propia en footer
