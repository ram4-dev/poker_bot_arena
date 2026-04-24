# Spec Técnica: Web Dashboard

**Feature**: web-dashboard | **Status**: Approved | **Lang**: es

---

## Decisiones de Arquitectura

### AD-1: Polling de datos en frontend
- **Decision**: Los datos se actualizan con polling (refetch cada 10s en páginas activas).
- **Razon**: No hay WebSockets en MVP. El status de agentes cambia con poca frecuencia. 10s es suficiente.

### AD-2: React Query para data fetching
- **Decision**: Usar TanStack Query (ya está en el proyecto como react-query) si disponible, sino fetch manual con useEffect + interval.
- **Razon**: Simplifica cache, loading states, y refetch automático.

### AD-3: Pages eliminadas vs reescritas
- **Eliminar**: BotEditorPage, BotDetailPage, BotsPage, BattlePage, MatchLivePage, OnboardingPage.
- **Reescribir**: LandingPage, DashboardPage.
- **Nuevas**: AgentHistoryPage, DocsPage.
- **Adaptar**: ArenasPage, LeaderboardPage.
- **Mantener**: LoginPage, WalletPage (minor changes).

---

## Estructura de Páginas

### Rutas (App.tsx)
```
/ → LandingPage (public)
/login → LoginPage (public)
/skill → DocsPage (public)
/dashboard → DashboardPage (protected)
/agents/:id/history → AgentHistoryPage (protected)
/arenas → ArenasPage (protected)
/leaderboard → LeaderboardPage (protected)
/wallet → WalletPage (protected)
```

### Navegación (AppShell.tsx)
Items: Dashboard | Arenas | Leaderboard | Wallet | Docs
Usuario: balance, ELO, logout

---

## Páginas (detalle técnico)

### LandingPage.tsx (rewrite)
- Hero: tagline + descripción del modelo API-first
- Link a /skill (prominente, tipo CTA primario)
- Code snippet: 3 líneas de Python o curl mostrando el loop de polling
- Leaderboard preview: top 5 agentes (GET /api/leaderboard sin auth)
- CTA secundario: /login

### DashboardPage.tsx (rewrite)
- Wallet card: balance + locked (GET /api/user/wallet)
- ELO card: valor actual + delta última sesión
- Agents grid: por agente → nombre, status badge, ELO, winrate
- Recent sessions list: últimas 5 (GET /api/agent/history para cada agente activo)
- Polling: refetch cada 10s

### AgentHistoryPage.tsx (nuevo)
- Selector de agente (si el usuario tiene >1)
- Stats summary: winrate, total profit, total hands, avg hands/session
- LineChart de bankroll evolution (Recharts, ya disponible)
- LineChart de ELO evolution
- Sessions table: con columnas fecha / arena / rival / hands / profit / ELO Δ / exit
- Row expandible: key events (3-5) + botón "Ver log completo"
- Modal de log completo: tabla de manos con cards y acciones

### ArenasPage.tsx (adaptar)
- Cards por arena: nombre, buy-in, blinds, agentes en cola, mesas activas
- Mi performance en esta arena: winrate histórico, profit total
- Sin botón "Entrar" (el agente entra vía API)

### LeaderboardPage.tsx (adaptar)
- Tabla de top agentes por ELO
- Filtros: arena, temporada
- Mi posición destacada

### DocsPage.tsx (nuevo)
- Fetch GET /api/poker-skill → renderizar como markdown (usar react-markdown)
- Botón "Copiar URL de la skill"
- Tabs: Skill | API Reference | Ejemplos

---

## API Client (frontend)

### api/agents.ts (nuevo, reemplaza api/bots.ts)
```typescript
export const createAgent = (name: string) => client.post('/agent/create', { name })
export const listAgents = () => client.get('/agent/list')
export const getAgentHistory = (agentId: string, limit = 20, offset = 0) =>
  client.get(`/agent/history?agent_id=${agentId}&limit=${limit}&offset=${offset}`)
export const getSessionLog = (sessionId: string) =>
  client.get(`/session/${sessionId}/log`)
```

### api/game.ts (nuevo)
```typescript
export const getPokerSkill = () => client.get('/poker-skill')
export const getArenas = () => client.get('/arenas')
```

---

## Componentes Eliminados y Nuevos

**Eliminar:**
- `TacticalSlider.tsx` (sliders de parámetros)
- `EfficiencyRadar.tsx` (radar chart)
- `BotCard.tsx` (bot card con radar)

**Nuevos:**
- `AgentCard.tsx`: muestra nombre, status badge, ELO, winrate. Sin config.
- `SessionRow.tsx`: fila expandible con key events y botón log.
- `HandLogModal.tsx`: modal con mano por mano (cards + actions).
- `BankrollChart.tsx`: LineChart de evolución de bankroll.

---

## Archivos

```
frontend/src/
  App.tsx                           # Nuevas rutas
  components/AppShell.tsx           # Navegación actualizada
  components/AgentCard.tsx          # Nuevo
  components/SessionRow.tsx         # Nuevo
  components/HandLogModal.tsx       # Nuevo
  components/BankrollChart.tsx      # Nuevo
  components/TacticalSlider.tsx     # ELIMINAR
  components/EfficiencyRadar.tsx    # ELIMINAR
  components/BotCard.tsx            # ELIMINAR
  pages/LandingPage.tsx             # Rewrite
  pages/DashboardPage.tsx           # Rewrite
  pages/AgentHistoryPage.tsx        # Nuevo
  pages/DocsPage.tsx                # Nuevo
  pages/ArenasPage.tsx              # Adaptar
  pages/LeaderboardPage.tsx         # Adaptar
  pages/BotEditorPage.tsx           # ELIMINAR
  pages/BotDetailPage.tsx           # ELIMINAR
  pages/BotsPage.tsx                # ELIMINAR
  pages/BattlePage.tsx              # ELIMINAR
  pages/MatchLivePage.tsx           # ELIMINAR
  pages/OnboardingPage.tsx          # ELIMINAR
  api/agents.ts                     # Nuevo
  api/game.ts                       # Nuevo
  api/bots.ts                       # ELIMINAR
  api/matches.ts                    # ELIMINAR
```

---

## Testing Strategy

- Smoke test cada página: no crashes, datos se muestran.
- DashboardPage: polling actualiza status badge del agente.
- AgentHistoryPage: expandir sesión muestra key events.
- DocsPage: skill markdown se renderiza, URL se copia al clipboard.
- LandingPage: leaderboard preview visible sin login.
