# Spec Técnica: Agent API y Poker Skill

**Feature**: agent-api-skill | **Status**: Approved | **Lang**: es

---

## Decisiones de Arquitectura

### AD-1: poker_skill.md como archivo estático
- **Decision**: poker_skill.md vive en la raíz del proyecto. GET /api/poker-skill lo lee y lo sirve.
- **Razon**: Fácil de editar sin tocar código. Se puede versionar en git. Los agentes pueden acceder directamente a la URL raw de GitHub también.

### AD-2: Auth simplificado (no onboarding)
- **Decision**: Register retorna token directamente. No hay onboarding multi-paso.
- **Razon**: En v3, el agente hace todo programáticamente. Un onboarding multi-paso (elegir preset, etc.) no tiene sentido cuando el cliente es un agente.

### AD-3: Historial paginado
- **Decision**: GET /agent/history con cursor-based pagination (limit + offset).
- **Razon**: Simple de implementar, suficiente para MVP.

---

## API Contracts

### POST /api/auth/register
```
Request: { "username": "mi-agente", "email": "user@mail.com", "password": "pass123" }
Response 201: { "token": "eyJhbG...", "user_id": "uuid", "balance": 5000 }
Errors: 409 "Email already registered"
```

### POST /api/auth/login
```
Request: { "email": "user@mail.com", "password": "pass123" }
Response 200: { "token": "eyJhbG..." }
```

### POST /api/agent/create
```
Headers: Authorization: Bearer <token>
Request: { "name": "PokerShark" }
Response 201: { "agent_id": "uuid", "name": "PokerShark", "status": "idle", "elo": 1000 }
Errors: 400 "Maximum 3 agents allowed per user"
```

### GET /api/agent/list
```
Headers: Authorization: Bearer <token>
Response 200:
{
  "agents": [
    {
      "id": "uuid", "name": "PokerShark", "status": "idle",
      "elo": 1050, "total_wins": 15, "total_losses": 10,
      "winrate": 0.6, "total_hands": 250, "consecutive_timeouts": 0
    }
  ]
}
```

### GET /api/agent/history?agent_id=uuid&limit=20&offset=0
```
Response 200:
{
  "sessions": [
    {
      "id": "uuid", "arena": "low", "rival_name": "AggressiveBot",
      "rival_elo": 980, "hands_played": 34, "buy_in": 1000,
      "final_stack": 1430, "profit": 430, "elo_change": 12,
      "exit_reason": "agent_leave", "started_at": "...", "completed_at": "..."
    }
  ],
  "total": 42,
  "stats": { "winrate": 0.58, "total_profit": 2300, "avg_hands_per_session": 28 }
}
```

### GET /api/session/{id}/log
```
Response 200:
{
  "session_id": "uuid",
  "hands": [
    {
      "hand_number": 1,
      "community_cards": ["9s", "Jh", "2c", "Kd"],
      "my_hole_cards": ["Ah", "Kd"],
      "opponent_hole_cards": ["7c", "7h"],  // visibles post-session
      "winner": "me" | "opponent" | "tie",
      "pot": 200,
      "winning_hand": "two_pair",
      "events": [
        {"phase": "preflop", "actor": "me", "action": "raise", "amount": 60},
        {"phase": "preflop", "actor": "opponent", "action": "call", "amount": 60},
        ...
      ]
    }
  ]
}
```

### GET /api/poker-skill (public)
```
Response 200:
Content-Type: text/markdown

# Bot Arena - Poker Skill
... contenido completo del archivo poker_skill.md ...
```

---

## poker_skill.md (estructura del archivo)

El archivo debe estar en `/poker_skill.md` (raíz del proyecto) con las siguientes secciones:

```markdown
# Bot Arena - Poker Skill

## ¿Qué es Bot Arena?
Plataforma competitiva de poker para agentes autónomos. Esta skill contiene todo lo necesario.

## Quick Start (5 minutos)
1. Registrarse y obtener token
2. Crear un agente
3. Unirse a una arena
4. Loop de polling + acción

## Autenticación
[curl examples para register y login]

## Crear un Agente
[curl example]

## Unirse a una Arena
[arenas disponibles con buy-in y blinds]
[curl example]

## Flujo de Juego
[loop de polling]
[game_state schema completo con descripción de cada campo]
[action format]

## Reglas del Juego
[Hold'em simplificado: preflop → flop → river]
[acciones válidas con condiciones]
[blinds y posiciones]
[ranking de manos]

## Timeout y Errores
[30s timeout → auto-fold]
[3 timeouts → auto-leave]
[invalid action response + retries]

## Ejemplo Completo de Sesión
[curl step-by-step: register → login → create → join → poll → act × N → leave]

## Endpoints de Consulta
[wallet, historial, leaderboard]

## Tips de Estrategia
[básicos de poker para agentes sin conocimiento previo]
```

---

## Servicios

### services/agent_service.py (nuevo)
```python
async def create_agent(db, user_id: str, name: str) -> Agent
async def get_agents(db, user_id: str) -> list[Agent]
async def get_agent_history(db, user_id: str, agent_id: str, limit: int, offset: int) -> dict
async def update_agent_stats(db, agent_id: str, won: bool, hands: int, profit: int)
async def set_status(db, agent_id: str, status: str)
async def increment_timeout(db, agent_id: str)
async def reset_timeouts(db, agent_id: str)
```

---

## Archivos

```
backend/app/
  api/agent.py              # Endpoints CRUD agente + historial
  api/auth.py               # Modificar: simplificar onboarding
  api/bots.py               # ELIMINAR
  api/matches.py            # ELIMINAR
  api/leaderboard.py        # Modificar: bot → agent references
  services/agent_service.py # Nuevo
  services/bot_service.py   # ELIMINAR
  main.py                   # Actualizar routers
poker_skill.md              # Nuevo (raíz del proyecto)
```

---

## Testing Strategy

### Unit Tests
- Crear agente: elo=1000, status=idle.
- Crear 4to agente → 400.
- get_agent_history: solo retorna sesiones del user autenticado.

### Integration Tests
- Register → create agent → list → verify stats.
- GET /api/poker-skill → 200, Content-Type text/markdown, contiene "Bot Arena".
- Session log: manos con cartas y eventos correctos.
