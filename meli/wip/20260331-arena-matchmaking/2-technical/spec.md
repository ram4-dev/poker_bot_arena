# Spec Tecnica: Arena & Matchmaking

**Feature**: arena-matchmaking | **Status**: Approved | **Lang**: es

---

## Decisiones de Arquitectura

### AD-1: APScheduler en-proceso con FastAPI
- **Decision**: AsyncIOScheduler de APScheduler corre dentro del proceso FastAPI, disparando `scheduler_tick()` cada 30 segundos.
- **Razon**: No hay Redis/Celery en el entorno local. APScheduler es suficiente para MVP single-server.
- **Migracion**: `scheduler_tick()` es una funcion async pura que recibe session. Extraible a Celery task trivialmente.

### AD-2: Scheduler idempotente
- **Decision**: Cada tick es idempotente. Si se ejecuta 2 veces seguidas, no genera estado inconsistente.
- **Razon**: En caso de crash/restart, el tick puede re-ejecutarse sin riesgo.
- **Implementacion**: Cada paso del tick opera sobre estados especificos (queued→playing, playing→idle) y usa queries con WHERE status = X.

### AD-3: Una mano = un game de PyPokerEngine
- **Decision**: Cada mano individual se ejecuta como un "game" de PyPokerEngine con max_round=1 y stacks actualizados.
- **Razon**: PyPokerEngine no tiene concepto de cash game con multiples manos. Simulamos cash game ejecutando manos individuales en loop.

### AD-4: Arenas como datos semilla (seed)
- **Decision**: Las 3 arenas + practica se crean via migracion/seed. No hay CRUD de arenas.
- **Razon**: Las arenas son fijas para MVP. No hay caso de uso para crear/editar arenas.

---

## Modelo de Datos

### Arena
```python
class Arena(Base):
    __tablename__ = "arenas"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    slug: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
        # "low", "mid", "high", "practice"
    buy_in: Mapped[int] = mapped_column(Integer, nullable=False)
    small_blind: Mapped[int] = mapped_column(Integer, nullable=False)
    big_blind: Mapped[int] = mapped_column(Integer, nullable=False)
    reward_multiplier: Mapped[float] = mapped_column(Float, default=1.0)
        # 1.0 para normales, 0.1 para practica
    is_practice: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
```

**Seed data**:
| slug | name | buy_in | small_blind | big_blind | reward_multiplier | is_practice |
|------|------|--------|-------------|-----------|-------------------|-------------|
| low | Low Stakes | 100 | 1 | 2 | 1.0 | false |
| mid | Mid Stakes | 500 | 5 | 10 | 1.0 | false |
| high | High Stakes | 2000 | 20 | 40 | 1.0 | false |
| practice | Practice | 0 | 1 | 2 | 0.1 | true |

### Table (mesa activa)
```python
class Table(Base):
    __tablename__ = "tables"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    arena_id: Mapped[str] = mapped_column(ForeignKey("arenas.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), default="active")
        # "active" | "completed"
    seat_1_session_id: Mapped[str | None] = mapped_column(ForeignKey("sessions.id"), nullable=True)
    seat_2_session_id: Mapped[str | None] = mapped_column(ForeignKey("sessions.id"), nullable=True)
    hands_played: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
```

### Session
```python
class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    bot_id: Mapped[str] = mapped_column(ForeignKey("bots.id"), nullable=False, index=True)
    bot_version_id: Mapped[str] = mapped_column(ForeignKey("bot_versions.id"), nullable=False)
    arena_id: Mapped[str] = mapped_column(ForeignKey("arenas.id"), nullable=False, index=True)
    table_id: Mapped[str | None] = mapped_column(ForeignKey("tables.id"), nullable=True)
    opponent_session_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="queued")
        # "queued" | "playing" | "completed"
    buy_in: Mapped[int] = mapped_column(Integer, nullable=False)
    initial_stack: Mapped[int] = mapped_column(Integer, nullable=False)
    final_stack: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hands_played: Mapped[int] = mapped_column(Integer, default=0)
    hands_won: Mapped[int] = mapped_column(Integer, default=0)
    exit_reason: Mapped[str | None] = mapped_column(String(30), nullable=True)
        # "stack_zero" | "threshold_up" | "threshold_down" | "max_hands" | "opponent_left"
    elo_before: Mapped[int | None] = mapped_column(Integer, nullable=True)
    elo_after: Mapped[int | None] = mapped_column(Integer, nullable=True)
    queued_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship()
    bot: Mapped["Bot"] = relationship()
    bot_version: Mapped["BotVersion"] = relationship()
    arena: Mapped["Arena"] = relationship()
    hands: Mapped[list["Hand"]] = relationship(back_populates="session")
```

### Hand
```python
class Hand(Base):
    __tablename__ = "hands"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    table_id: Mapped[str] = mapped_column(ForeignKey("tables.id"), nullable=False, index=True)
    session_1_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"), nullable=False)
    session_2_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"), nullable=False)
    hand_number: Mapped[int] = mapped_column(Integer, nullable=False)
    winner_session_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
        # null si draw
    pot: Mapped[int] = mapped_column(Integer, nullable=False)
    community_cards: Mapped[str | None] = mapped_column(String(50), nullable=True)
        # JSON string: ["Ah","Kd","Qs","Jc","Td"]
    player_1_hole: Mapped[str | None] = mapped_column(String(20), nullable=True)
    player_2_hole: Mapped[str | None] = mapped_column(String(20), nullable=True)
    player_1_stack_after: Mapped[int] = mapped_column(Integer, nullable=False)
    player_2_stack_after: Mapped[int] = mapped_column(Integer, nullable=False)
    winning_hand_rank: Mapped[str | None] = mapped_column(String(30), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    session: Mapped["Session"] = relationship(foreign_keys=[session_1_id])
    events: Mapped[list["HandEvent"]] = relationship(back_populates="hand")
```

### HandEvent
```python
class HandEvent(Base):
    __tablename__ = "hand_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    hand_id: Mapped[str] = mapped_column(ForeignKey("hands.id"), nullable=False, index=True)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)  # orden dentro de la mano
    street: Mapped[str] = mapped_column(String(10), nullable=False)
        # "preflop" | "flop" | "turn" | "river" | "showdown"
    player_seat: Mapped[int] = mapped_column(Integer, nullable=False)  # 1 o 2
    action: Mapped[str] = mapped_column(String(10), nullable=False)
        # "fold" | "check" | "call" | "raise" | "all_in"
    amount: Mapped[int] = mapped_column(Integer, default=0)
    pot_after: Mapped[int] = mapped_column(Integer, nullable=False)

    hand: Mapped["Hand"] = relationship(back_populates="events")
```

---

## API Contracts

### GET /api/arenas
```
Headers: Authorization: Bearer <token>

Response 200:
{
    "arenas": [
        {
            "id": "uuid",
            "name": "Low Stakes",
            "slug": "low",
            "buy_in": 100,
            "small_blind": 1,
            "big_blind": 2,
            "is_practice": false,
            "reward_multiplier": 1.0,
            "stats": {
                "bots_in_queue": 3,
                "active_tables": 2,
                "estimated_reward": 150
            }
        }
    ]
}
```

### POST /api/arenas/{arena_id}/queue
```
Request:
{
    "bot_id": "uuid"
}

Response 201:
{
    "session_id": "uuid",
    "status": "queued",
    "arena": "Low Stakes",
    "bot": { "name": "Alpha Strike", "version": 3 }
}

Errors:
  400: {"detail": "Bot is not idle"}
  400: {"detail": "Insufficient balance for buy-in"}
  400: {"detail": "Bot has no active version"}
  404: {"detail": "Arena not found"}
```

**Flujo**:
1. Validar bot idle, tiene version activa, pertenece al usuario.
2. Validar balance >= buy_in (o buy_in=0 si practica).
3. `wallet_service.lock_buy_in(user_id, buy_in)`.
4. Crear Session(status="queued").
5. Bot.status = "queued".

### DELETE /api/arenas/{arena_id}/queue/{session_id}
```
Response 200:
{
    "message": "Bot removed from queue",
    "refunded": 100
}

Errors:
  400: {"detail": "Session is not in queued status"}
  403: {"detail": "Not your session"}
```

**Flujo**:
1. Validar session.status == "queued".
2. `wallet_service.unlock_buy_in(user_id, buy_in)`.
3. Session.status = "cancelled", Bot.status = "idle".

### GET /api/sessions
```
Query: ?limit=20&offset=0&status=completed

Response 200:
{
    "items": [
        {
            "id": "uuid",
            "arena": { "name": "Low Stakes" },
            "bot": { "name": "Alpha Strike" },
            "opponent_bot": { "name": "Rival Bot" },
            "status": "completed",
            "profit": 250,
            "hands_played": 45,
            "hands_won": 28,
            "exit_reason": "threshold_up",
            "elo_change": +15,
            "completed_at": "..."
        }
    ],
    "total": 30,
    "limit": 20,
    "offset": 0
}
```

### GET /api/sessions/{session_id}
```
Response 200:
{
    ... session completa con ...
    "hands": [
        {
            "hand_number": 1,
            "pot": 20,
            "winner": "player_1",
            "community_cards": ["Ah","Kd","Qs","Jc","Td"],
            "winning_hand_rank": "Straight",
            "events": [ { "street": "preflop", "action": "raise", "amount": 6 }, ... ]
        }
    ]
}
```

### POST /api/admin/tick
```
Response 200:
{
    "matched": 2,        // pares emparejados
    "hands_executed": 10, // manos jugadas en total
    "sessions_completed": 1,
    "tables_cleaned": 0
}
```

---

## Scheduler Tick (Core Loop)

### scheduler/tick.py

```python
async def scheduler_tick(session: AsyncSession) -> TickResult:
    """
    Ciclo completo ejecutado cada 30 segundos.
    Idempotente: puede re-ejecutarse sin riesgo.
    """
    # Paso 1: MATCH — Emparejar bots en cola
    matched = await matchmaker.process_queue(session)

    # Paso 2: EXECUTE — Ejecutar manos en mesas activas
    for table in await get_active_tables(session):
        hands_result = await session_manager.execute_hands(session, table, count=HANDS_PER_TICK)

        # Paso 3: EVALUATE — Evaluar condiciones de salida
        for seat_session in [table.seat_1, table.seat_2]:
            exit_reason = evaluate_exit(seat_session)
            if exit_reason:
                await session_manager.close_session(session, seat_session, exit_reason)

    # Paso 4: CLEANUP — Destruir mesas vacias, reemplazar sillas
    await cleanup_tables(session)

    return TickResult(matched, hands_executed, sessions_completed)
```

---

## Servicios

### matchmaker.py

```python
async def process_queue(session: AsyncSession) -> int:
    """
    Para cada arena, buscar pares compatibles en la cola.
    Criterios:
    - Misma arena
    - ELO dentro de +-200 (se amplia +50/min en cola)
    - No mismo usuario
    - No rematch reciente (5 min cooldown)

    Retorna numero de pares emparejados.
    """

async def find_match(session, queued_session) -> Session | None:
    """Busca un oponente compatible para una session en cola."""

async def create_table(session, session_1, session_2, arena) -> Table:
    """Crea mesa, asigna sesiones, ambos bots pasan a 'playing'."""
```

**Ampliacion de ELO**: `elo_range = 200 + (minutes_in_queue * 50)`, max 1000.

**Cooldown rematches**: Query `sessions WHERE bot_1 + bot_2 mismo par AND completed_at > now()-5min`.

### session_manager.py

```python
async def execute_hands(session, table: Table, count: int) -> list[HandResult]:
    """
    Ejecuta `count` manos en una mesa.
    1. Cargar configs de ambos bots (BotVersion.config_json).
    2. Instanciar ConfigurableBot x2.
    3. Para cada mano:
       a. Ejecutar via runner.run_hand() en thread pool.
       b. Persistir Hand + HandEvents.
       c. Actualizar stacks en sessions.
       d. Evaluar condiciones de salida.
    """

async def close_session(session, sess: Session, exit_reason: str):
    """
    1. sess.status = 'completed', sess.final_stack = current_stack.
    2. wallet_service.settle_session(user_id, buy_in, final_stack).
    3. elo_service.update_elo(sess, opponent_session).
    4. bot_service.update_bot_stats(bot_id, version_id, won, hands, profit).
    5. bot.status = 'idle'.
    """
```

---

## Archivos

```
backend/app/
  api/arenas.py           # Endpoints arenas, queue, dequeue
  api/sessions.py         # Endpoints sessions list, detail
  api/admin.py            # Trigger tick manual
  services/matchmaker.py  # Logica de matchmaking
  services/session_manager.py  # Ejecucion de manos, cierre de sesiones
  models/arena.py         # Arena model
  models/table.py         # Table model
  models/session.py       # Session model
  models/hand.py          # Hand, HandEvent models
  schemas/arena.py        # ArenaResponse, QueueRequest
  schemas/session.py      # SessionResponse, SessionDetailResponse
  scheduler/tick.py       # scheduler_tick()
  scheduler/jobs.py       # APScheduler setup en FastAPI lifespan
```

---

## Testing Strategy

### Unit Tests
- `test_matchmaker.py`:
  - 2 bots misma arena, ELO compatible → match.
  - 2 bots misma arena, ELO muy lejos → no match.
  - 2 bots mismo usuario → no match.
  - Bot en cola 3 min, ELO lejos pero rango ampliado → match.
  - Rematch < 5min → no match.

### Integration Tests
- `test_scheduler.py`:
  - Flujo completo: register x2 → create bots → queue → tick → mesas creadas → tick x5 → sessions completed → wallets settled → ELO updated.
  - Queue + cancel → refund correcto.
  - Bot sin balance → error al queue.
  - Arena practica: buy_in=0, ganancias x0.1.
