# Spec Tecnica: Frontend Contract y Quality Refactor

**Feature**: frontend-contract-quality-refactor | **Status**: Approved | **Lang**: es

---

## Contexto

La revision detecto problemas de frontend que no son de seguridad sino de calidad:

1. Los clientes TS no reflejan el contrato real del backend.
2. Las páginas compensan esa deriva con parsing manual ad hoc.
3. El modelo de fetching/polling es inconsistente y rompe lint.
4. Hay tipado débil y silenciamiento de errores en pantallas principales.

Este refactor busca estabilizar la capa de consumo de API y hacer las páginas previsibles.

---

## Objetivos

1. Alinear tipos de frontend con contratos reales del backend.
2. Centralizar normalización de respuestas en la capa API, no en las páginas.
3. Eliminar hacks locales, `any` y lógica defensiva repetida.
4. Dejar polling y loading states compatibles con lint y fáciles de mantener.

---

## Decisiones de Arquitectura

### AD-1: La capa `src/api/*` define el contrato canónico del frontend
- **Decision**: Las páginas no interpretan payloads ambiguos. Los módulos API devuelven tipos ya normalizados.
- **Razon**: Hoy `DashboardPage` corrige a mano distintos shapes y nombres.

### AD-2: Separar DTO bruto de ViewModel
- **Decision**: Cuando el backend no coincida con el shape que la UI necesita, el mapeo se hace en `src/api/*`.
- **Patron**:
```ts
type AgentListDto = { agents: AgentDto[] }
type Agent = { ...view model... }
```
- **Razon**: La UI consume una forma estable aunque el backend use wrappers paginados o nombres distintos.

### AD-3: El frontend usa naming consistente propio
- **Decision**: Elegir un set de nombres de UI y mantenerlo en todos los módulos.
- **Ejemplo**:
  - `recentSessions`
  - `rivalName`
  - `completedAt`
  - `items`
- **Razon**: Evita mezclar backend DTOs con naming de presentación.

### AD-4: Cero `any` en API client modules
- **Decision**: Cada request tiene DTO tipado de entrada y salida.
- **Razon**: El cliente HTTP es la primera línea de defensa contra drift de contrato.

### AD-5: Polling reusable y sin violaciones de hooks
- **Decision**: Mover fetch loops repetidos a hooks o helpers bien tipados.
- **Opciones válidas**:
  - Hook reutilizable `usePollingQuery`
  - React Query/TanStack Query si el stack ya lo permite
  - `useEffect` con función interna estable y cleanup correcto

### AD-6: Errores visibles y centralizados
- **Decision**: No hacer `catch {}` silencioso en páginas que dependen de datos remotos.
- **Razon**: La UI debe distinguir entre “sin datos” y “falló el fetch”.

---

## Refactor Propuesto

### 1. API Layer

#### `frontend/src/api/agents.ts`
- Separar DTOs backend de tipos UI.
- Corregir contratos actuales:
  - `listAgents()` recibe `{ agents: AgentResponse[] }`
  - `getAgentHistory()` recibe `{ items, total, limit, offset }`
  - `getSessionLog()` recibe `{ session_id, hands, total_hands }`
- Exportar funciones que devuelvan tipos ya transformados si la UI necesita nombres distintos.

#### `frontend/src/api/wallet.ts`
- Eliminar `any`.
- Tipar wrappers de paginación y normalización.

#### `frontend/src/api/client.ts`
- Mantener la responsabilidad en transporte, no en transformar shapes de negocio.

### 2. Hooks y consumo de datos

#### `AuthContext`
- Resolver `loading` inicial sin patrón rechazado por lint.
- Evitar side effects ambiguos en el `useEffect` de bootstrap.

#### `DashboardPage`
- Dejar de usar `client.get(...)` inline para historia de agentes.
- Consumir `getAgentHistory()` tipado.
- Manejar `loading` y `error` explícitos.
- Mover polling a helper o hook.

#### `LeaderboardPage`
- Refactorizar el flow de fetch para cumplir reglas de hooks.
- Tipar respuesta de leaderboard y seasons.

### 3. Contratos de ViewModel

#### Tipos de UI recomendados
```ts
type AgentCardModel = {
  id: string
  name: string
  status: 'idle' | 'queued' | 'playing' | 'suspended'
  elo: number
  totalWins: number
  totalLosses: number
  totalHands: number
  winrate: number
}

type RecentSessionModel = {
  sessionId: string
  arenaName: string
  rivalName: string | null
  handsPlayed: number
  profit: number | null
  eloChange: number | null
  completedAt: string | null
}
```

### 4. Error handling de UI

#### Regla
- Páginas con fetch remoto deben tener al menos:
  - `loading`
  - `error`
  - `empty`

#### No permitido
- `catch {}` vacío en páginas principales.
- “si vino otra forma de payload, intento adivinarla” dentro del componente.

### 5. Lint y ergonomía

#### Objetivo
- `npm run lint` pasa sin excepciones ni reglas deshabilitadas.

#### Regla
- No usar `useCallback` solo para satisfacer dependencias si el diseño del fetch puede simplificarse.
- No mezclar acceso raw a axios con módulos API typed en la misma página.

---

## Archivos Impactados

```text
frontend/src/
  api/agents.ts
  api/wallet.ts
  api/leaderboard.ts
  api/client.ts
  context/AuthContext.tsx
  pages/DashboardPage.tsx
  pages/LeaderboardPage.tsx
  pages/AgentHistoryPage.tsx
  components/AgentCard.tsx
```

---

## Testing Strategy

### Unit
- `agents api normalizes list response correctly`
- `agent history mapper converts backend dto to recent session model`
- `wallet api returns typed ledger response`

### UI/Component
- `DashboardPage shows error state when agent history fetch fails`
- `DashboardPage renders recent sessions from normalized models`
- `LeaderboardPage handles loading and empty states`

### Quality Gates
- `npm run lint` exits 0
- No `any` en `src/api/*`
- No `catch {}` vacío en páginas principales
- Ninguna página principal consume `client.get()` directo si existe módulo API tipado

---

## Criterios de Aceptacion

1. `src/api/*` refleja el contrato real del backend o lo normaliza explícitamente.
2. `DashboardPage`, `LeaderboardPage` y `AuthContext` dejan de contener parsing defensivo ad hoc.
3. No hay `any` en los módulos API tocados.
4. Las páginas principales manejan `loading/error/empty` de forma explícita.
5. El lint del frontend queda en verde.

---

## Riesgos y Trade-offs

- Si el backend sigue cambiando sus responses, conviene fijar primero schemas backend estables.
- Introducir DTOs y mappers suma código, pero reduce ambigüedad y bugs silenciosos.
- Si luego se adopta React Query, parte del trabajo de polling podrá simplificarse, pero los contratos tipados seguirán siendo necesarios.
