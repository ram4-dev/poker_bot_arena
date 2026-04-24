# Spec Tecnica: Game API

**Feature**: game-api | **Status**: Approved | **Lang**: es

---

## Decisiones de Arquitectura

### AD-1: TableManager con estado en memoria
- **Decision**: TableManager mantiene HoldemHand instances activas en un dict en memoria (keyed by table_id), con persistencia en DB para recovery.
- **Razon**: Acceder al estado del engine por cada request debe ser O(1). La DB es autoritativa para persistencia pero el estado activo vive en RAM.
- **Trade-off**: Si el proceso reinicia, el estado en memoria se pierde. Recovery desde DB (recrear HoldemHand desde ultimas acciones). Aceptable para MVP single-instance.

### AD-2: Polling puro (sin webhooks)
- **Decision**: Solo polling. El agente llama GET /game/state periodicamente.
- **Razon**: Polling es trivial de implementar para el agente (1 linea de codigo). Webhooks requieren que el agente tenga endpoint publico. El MVP prioriza baja friccion de onboarding.
- **Rate limit**: 2 req/s por agente (120/min) para evitar spam.

### AD-3: SessionManager simplificado
- **Decision**: SessionManager solo maneja lifecycle (create/start/close), no ejecuta manos.
- **Razon**: La ejecucion de manos es responsabilidad del TableManager + engine. SessionManager solo coordina wallet, ELO, y state transitions de Session.

---

## API Contracts

### POST /api/arena/join
```
Request:
{ "agent_id": "uuid", "arena_id": "low" }

Response 200:
{ "status": "queued", "position": 3 }

Errors:
  400: "Agent already queued or playing"
  400: "Insufficient balance. Need {buy_in}, have {balance}"
  404: "Agent not found"
  403: "Agent belongs to another user"
```

### GET /api/game/state?agent_id=uuid
```
Response 200 (not your turn):
{ "status": "waiting" }

Response 200 (your turn):
{
  "status": "your_turn",
  "hand_id": "uuid",
  "phase": "preflop",
  "my_cards": ["Ah", "Kd"],
  "community_cards": [],
  "my_stack": 1450,
  "opponent_stack": 550,
  "pot": 30,
  "my_position": "dealer",
  "current_bet": 20,
  "min_raise": 40,
  "actions_this_round": [
    { "actor": "opponent", "action": "raise", "amount": 20 }
  ],
  "hand_history": [],
  "session": {
    "hands_played": 5,
    "initial_stack": 1000,
    "current_profit": 450
  },
  "timeout_seconds": 30
}

Response 200 (not in game):
{ "status": "idle" }

Response 429:
{ "error": "Rate limit: max 2 requests/second" }
```

### POST /api/game/action
```
Request:
{ "agent_id": "uuid", "hand_id": "uuid", "action": "raise", "amount": 200 }

Response 200 (valid):
{ "status": "ok", "next": "waiting" }

Response 200 (invalid, retries left):
{
  "status": "invalid_action",
  "message": "Raise must be >= 40 and <= 1450",
  "retries_left": 1
}

Response 200 (auto-fold after 3rd invalid):
{
  "status": "auto_fold",
  "message": "Maximum retries exceeded. Auto-folded."
}

Errors:
  400: "Not your turn"
  400: "hand_id does not match active hand"
```

### POST /api/game/leave
```
Request:
{ "agent_id": "uuid" }

Response 200:
{
  "status": "left",
  "session_result": {
    "hands_played": 34,
    "buy_in": 1000,
    "final_stack": 1430,
    "profit": 430,
    "elo_change": 12
  }
}
```

---

## Servicios

### services/table_manager.py
```python
class TableManager:
    _hands: dict[str, HoldemHand] = {}  # table_id -> HoldemHand (singleton per app)

    async def get_or_load_hand(self, db, table_id: str) -> HoldemHand | None:
        """Retorna hand activa. Si no esta en memoria, intenta reconstruir desde DB."""

    async def get_game_state(self, db, agent_id: str) -> dict:
        """Retorna game_state para el agente. Setea action_deadline si es su turno."""

    async def process_action(self, db, agent_id: str, hand_id: str,
                              action: str, amount: int) -> dict:
        """Valida y aplica accion. Maneja retry_count. Auto-fold si excede."""

    async def start_new_hand(self, db, table_id: str) -> Hand:
        """Inicia nueva mano en la mesa. Crea registro Hand en DB. Setea dealer_seat."""

    async def complete_hand(self, db, table_id: str, result: HandResult):
        """Persiste resultado, actualiza stacks en sessions, crea HandEvents."""

    async def process_leave(self, db, agent_id: str) -> dict:
        """Salida voluntaria. Auto-fold si en mano activa. Cierra sesion."""
```

### services/session_manager.py (rewrite)
```python
async def create_session(db, agent_id: str, arena_id: str) -> Session:
    """Crea Session en status queued. Lockea buy-in en wallet."""

async def start_session(db, session_id: str, table_id: str):
    """Transiciona Session a playing. Setea started_at."""

async def close_session(db, session_id: str, exit_reason: str, final_stack: int):
    """Cierra Session. Settle wallet. Update ELO. Update agent stats. Reset agent status."""
```

---

## Archivos

```
backend/app/
  api/game.py                 # Router con /game/state, /game/action, /game/leave
  api/arenas.py               # Agregar POST /arena/join
  services/table_manager.py   # Nuevo
  services/session_manager.py # Rewrite
  schemas/game.py             # GameStateResponse, ActionRequest, ActionResponse, LeaveResponse
  main.py                     # Registrar router game
```

---

## Testing Strategy

### Integration Tests (test_game_api.py)
- Flujo completo: register -> create agent -> join arena -> tick (matchmaker) -> poll state -> action -> poll -> action -> hand complete -> leave.
- Accion invalida: retries_left decrementa, al 3ro auto-fold.
- Polling cuando no es turno: `{"status": "waiting"}`.
- Leave desde cola: devuelve buy-in, no session_result.
- Leave en medio de mano: fold automatico, session_result correcto.
