# Spec Técnica: Data Model Migration

**Feature**: data-model-migration | **Status**: Approved | **Lang**: es

---

## Decisiones de Arquitectura

### AD-1: Agent sin versiones
- **Decision**: Agent es una entidad simple. No hay AgentVersion. La "versión" de un agente es su prompt/lógica externa, invisible para la plataforma.
- **Razon**: La plataforma no almacena ni ejecuta código del usuario. Solo registra stats por agente.
- **Trade-off**: No se puede comparar rendimiento entre versiones del lado de la plataforma. Aceptable: el usuario maneja eso externamente.

### AD-2: Timeout tracking en Table
- **Decision**: Table almacena pending_action_agent_id + action_deadline.
- **Razon**: El scheduler necesita consultar en batch qué mesas tienen timeout vencido. Más eficiente que leer Hand para cada mesa.
- **Trade-off**: Duplicación parcial del estado. Se mantiene sincronizado cuando el engine sirve game_state.

### AD-3: Clean migration (no data migration)
- **Decision**: El MVP usa SQLite con datos de seed/test. Se puede hacer clean reset.
- **Razon**: No hay datos de producción. Es más simple que migrar Bot→Agent con transformación de datos.

---

## Modelo de Datos

### Agent
```python
class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="idle")
        # "idle" | "queued" | "playing" | "suspended"
    elo: Mapped[int] = mapped_column(Integer, default=1000)
    total_wins: Mapped[int] = mapped_column(Integer, default=0)
    total_losses: Mapped[int] = mapped_column(Integer, default=0)
    total_hands: Mapped[int] = mapped_column(Integer, default=0)
    consecutive_timeouts: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())

    owner: Mapped["User"] = relationship(back_populates="agents")
    sessions: Mapped[list["Session"]] = relationship(back_populates="agent")
```

### Session (cambios)
```python
# Reemplazar bot_id + bot_version_id con:
agent_id: Mapped[str] = mapped_column(ForeignKey("agents.id"), nullable=False, index=True)
timeout_count: Mapped[int] = mapped_column(Integer, default=0)
# exit_reason agrega: "timeout_exceeded" | "agent_leave"
```

### Table (cambios)
```python
current_hand_id: Mapped[str | None] = mapped_column(ForeignKey("hands.id"), nullable=True)
dealer_seat: Mapped[int] = mapped_column(Integer, default=1)  # 1 o 2
pending_action_agent_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
action_deadline: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
```

### Hand (cambios)
```python
phase: Mapped[str] = mapped_column(String(20), default="preflop")
    # "preflop" | "flop" | "river" | "showdown" | "complete"
current_bet: Mapped[int] = mapped_column(Integer, default=0)
pot_main: Mapped[int] = mapped_column(Integer, default=0)
```

---

## Settings (config.py)

```python
ACTION_TIMEOUT_SECONDS: int = 30
MAX_ACTION_RETRIES: int = 2
CONSECUTIVE_TIMEOUT_LIMIT: int = 3
MAX_AGENTS_PER_USER: int = 3
SCHEDULER_INTERVAL_SECONDS: int = 5  # reducido de 30 a 5 para timeouts responsivos
MATCHMAKER_ELO_RANGE_BASE: int = 200
MATCHMAKER_ELO_EXPANSION_PER_MINUTE: int = 50
MATCHMAKER_ELO_RANGE_CAP: int = 1000
REMATCH_COOLDOWN_MINUTES: int = 5
```

---

## Migración Alembic

Crear nueva migración `20260401_v3_schema.py`:
1. DROP TABLE bot_versions
2. DROP TABLE bots (después de quitar FKs)
3. CREATE TABLE agents (schema arriba)
4. ALTER TABLE sessions: DROP bot_id, DROP bot_version_id, ADD agent_id, ADD timeout_count
5. ALTER TABLE tables: ADD current_hand_id, dealer_seat, pending_action_agent_id, action_deadline
6. ALTER TABLE hands: ADD phase, current_bet, pot_main
7. Actualizar user.agents relationship

---

## Archivos

```
backend/app/
  models/agent.py           # nuevo (reemplaza bot.py)
  models/bot.py             # eliminar
  models/session.py         # modificar
  models/table.py           # modificar
  models/hand.py            # modificar
  models/__init__.py        # actualizar imports
  schemas/agent.py          # nuevo (reemplaza schemas/bot.py)
  schemas/bot.py            # eliminar
  config.py                 # agregar settings
alembic/versions/
  20260401_v3_schema.py     # nueva migración
```

---

## Testing Strategy

### Unit Tests
- Crear Agent: status idle, elo 1000, consecutive_timeouts 0.
- Crear 4to agente → error max 3.
- Table.action_deadline: setear y verificar en DB.
- Session.timeout_count: incrementa correctamente.

### Integration Tests
- Migración corre sin errores sobre DB vacía.
- Relaciones FK son correctas (Agent→Sessions, Table→Hand).
