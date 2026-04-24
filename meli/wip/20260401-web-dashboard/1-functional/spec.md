# Spec Funcional: Web Dashboard

**Feature**: web-dashboard | **Status**: Approved | **Lang**: es

---

## Problema

El frontend v1 tiene 14 páginas incluyendo un editor de bots con 17 sliders, páginas de battle deployment, y live match viewing. En v3, el juego sucede enteramente vía API del lado del agente del usuario. El dashboard web es solo para visualización: ver resultados, analizar historial, y encontrar la poker skill.

---

## Objetivos

1. Dashboard de visualización (read-only). Nada se juega desde el browser.
2. 6 páginas claras orientadas a análisis y onboarding.
3. La landing page comunica claramente el modelo API-first.

---

## User Stories

### US-1: Landing Page
**Como** visitante, **quiero** entender qué es Bot Arena y cómo empezar, **para** conectar mi agente rápidamente.

**Acceptance Criteria**:
- AC-1.1: Explica el modelo: "Conectá tu agente. Leé la poker skill. Empezá a competir."
- AC-1.2: Link directo y prominente a la poker skill.
- AC-1.3: Quick start: snippet de código de ejemplo (3-5 líneas de curl o Python).
- AC-1.4: Preview del leaderboard (top 5 agentes por ELO).
- AC-1.5: CTA: "Registrarse" o "Ver la Skill".

### US-2: Dashboard (logueado)
**Como** usuario, **quiero** ver un resumen de mi estado, **para** saber cómo van mis agentes.

**Acceptance Criteria**:
- AC-2.1: Wallet: balance disponible y locked.
- AC-2.2: ELO del usuario.
- AC-2.3: Lista de agentes con: nombre, status badge (idle/queued/playing), ELO, winrate.
- AC-2.4: Últimas 5 sesiones con resultado (+ o - fichas), arena, rival.
- AC-2.5: Indicador de agentes activos en tiempo real (status badge se actualiza).

### US-3: Historial de Agente
**Como** usuario, **quiero** analizar el rendimiento de mi agente sesión por sesión, **para** iterar su lógica.

**Acceptance Criteria**:
- AC-3.1: Lista de sesiones con: fecha, arena, rival+ELO, manos, resultado, ELO delta, exit_reason.
- AC-3.2: Gráfico de evolución de bankroll (acumulado de profits por sesión).
- AC-3.3: Gráfico de evolución de ELO.
- AC-3.4: Key events de la sesión (máx 5): templates tipo "Ganó pot grande con flush en mano #12".
- AC-3.5: Botón "Ver log completo" que muestra todas las manos de la sesión (mano por mano con cartas y acciones).

### US-4: Arenas
**Como** usuario, **quiero** ver el estado de cada arena, **para** decidir dónde mandar mi agente.

**Acceptance Criteria**:
- AC-4.1: Por arena: nombre, buy-in, blinds, agentes en cola, mesas activas.
- AC-4.2: Performance histórica de mis agentes en esa arena: winrate, profit total.
- AC-4.3: No hay botón "Entrar" desde la web. El agente entra programáticamente vía API.

### US-5: Leaderboard
**Como** usuario, **quiero** ver el ranking de agentes, **para** saber mi posición relativa.

**Acceptance Criteria**:
- AC-5.1: Ranking de agentes por ELO (top 50).
- AC-5.2: Filtro por arena y temporada.
- AC-5.3: Mi posición destacada aunque no esté en top 50.
- AC-5.4: Por agente: nombre, usuario, ELO, winrate, manos jugadas.

### US-6: Docs / Poker Skill
**Como** usuario o visitante, **quiero** leer la poker skill formateada y ver ejemplos de integración, **para** configurar mi agente.

**Acceptance Criteria**:
- AC-6.1: Renderiza el contenido de poker_skill.md como HTML/markdown.
- AC-6.2: Botón "Copiar skill URL" para pegar en el agente.
- AC-6.3: Ejemplos de integración con Python, curl, Claude Code.
- AC-6.4: Accesible sin login.

---

## Scope

**In**: 6 páginas read-only (Landing, Dashboard, AgentHistory, Arenas, Leaderboard, Docs).
**Out**: Editor de bots (no existe), battle deployment (no existe), live match terminal (no existe), onboarding multi-paso (registro directo).

---

## Business Rules

1. Nada se juega desde el browser. Es solo visualización.
2. Los datos se actualizan por polling del frontend (no WebSockets).
3. El log completo de sesión se muestra en un modal o expandible, no en página separada.

---

## Dependencies

| Dependencia | Tipo | Uso |
|-------------|------|-----|
| agent-api-skill | Feature | API endpoints para datos |
