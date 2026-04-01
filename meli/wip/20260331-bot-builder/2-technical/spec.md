# Spec Tecnica: Bot Builder

**Feature**: bot-builder | **Status**: Approved | **Lang**: es

---

## Decisiones de Arquitectura

### AD-1: Versionado inmutable con BotVersion separado
- **Decision**: Separar Bot (entidad mutable: nombre, avatar, status) de BotVersion (inmutable: config + stats).
- **Razon**: Permite historial completo, comparacion entre versiones, y rollback conceptual. El bot es la "identidad" y las versiones son las "iteraciones de estrategia".

### AD-2: Config como JSON embebido en BotVersion
- **Decision**: Los 14 parametros se guardan como JSON en BotVersion.config_json.
- **Razon**: Flexibilidad para agregar parametros sin migraciones. Validacion via Pydantic al crear/leer.
- **Trade-off**: No se puede hacer query por parametro individual en DB. Aceptable: no hay caso de uso para eso.

### AD-3: Max 3 bots enforced en servicio y DB
- **Decision**: Validacion en bot_service + CHECK indirecto (count query antes de INSERT).
- **Razon**: SQLite no soporta triggers complejos. La validacion en servicio es suficiente para MVP.

---

## Modelo de Datos

### Bot
```python
class Bot(Base):
    __tablename__ = "bots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    avatar: Mapped[str] = mapped_column(String(50), default="bot_default")  # icon identifier
    status: Mapped[str] = mapped_column(String(20), default="idle")
        # "idle" | "queued" | "playing"
    elo: Mapped[int] = mapped_column(Integer, default=1000)
    total_wins: Mapped[int] = mapped_column(Integer, default=0)
    total_losses: Mapped[int] = mapped_column(Integer, default=0)
    total_hands: Mapped[int] = mapped_column(Integer, default=0)
    active_version_id: Mapped[str | None] = mapped_column(ForeignKey("bot_versions.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())

    owner: Mapped["User"] = relationship(back_populates="bots")
    versions: Mapped[list["BotVersion"]] = relationship(back_populates="bot", order_by="BotVersion.version_number.desc()")
    active_version: Mapped["BotVersion | None"] = relationship(foreign_keys=[active_version_id])
```

### BotVersion
```python
class BotVersion(Base):
    __tablename__ = "bot_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    bot_id: Mapped[str] = mapped_column(ForeignKey("bots.id"), nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)  # 1, 2, 3...
    config_json: Mapped[dict] = mapped_column(JSON, nullable=False)
        # Los 14 parametros de BotConfig serializados
    preset_origin: Mapped[str | None] = mapped_column(String(20), nullable=True)
        # "aggressive", "conservative", etc. Null si fue custom
    wins: Mapped[int] = mapped_column(Integer, default=0)
    losses: Mapped[int] = mapped_column(Integer, default=0)
    hands_played: Mapped[int] = mapped_column(Integer, default=0)
    total_profit: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    bot: Mapped["Bot"] = relationship(back_populates="versions")

    __table_args__ = (
        UniqueConstraint("bot_id", "version_number", name="uq_bot_version"),
    )
```

---

## API Contracts

### GET /api/bots
```
Headers: Authorization: Bearer <token>

Response 200:
{
    "bots": [
        {
            "id": "uuid",
            "name": "Alpha Strike",
            "description": "Mi bot agresivo",
            "avatar": "bot_red",
            "status": "idle",
            "elo": 1050,
            "winrate": 0.65,
            "total_wins": 13,
            "total_losses": 7,
            "total_hands": 200,
            "active_version": {
                "id": "uuid",
                "version_number": 3,
                "config": { ... 14 params ... },
                "preset_origin": null
            },
            "created_at": "..."
        }
    ],
    "stats": {
        "total_bots": 2,
        "total_deployed": 1,
        "total_xp": 3500
    }
}
```

### POST /api/bots
```
Request:
{
    "name": "Alpha Strike",
    "description": "optional",
    "avatar": "bot_red",
    "preset": "aggressive"     // required: aggressive|conservative|balanced|opportunist|bluffer
}

Response 201:
{
    "id": "uuid",
    "name": "Alpha Strike",
    "active_version": { "version_number": 1, "config": { ... } },
    ...
}

Errors:
  400: {"detail": "Maximum 3 bots allowed"}
  422: Validation errors
```

**Flujo**: Validar max 3 bots → crear Bot → crear BotVersion v1 con preset → set active_version.

### PUT /api/bots/{bot_id}
```
Request:
{
    "name": "Alpha Strike v2",    // opcional
    "description": "updated",     // opcional
    "avatar": "bot_blue"          // opcional
}

Response 200: { ... bot actualizado ... }

Errors:
  403: {"detail": "Bot belongs to another user"}
  409: {"detail": "Cannot edit bot while playing"}
```

### POST /api/bots/{bot_id}/versions
```
Request:
{
    "config": {
        "hand_threshold": 0.4,
        "raise_tendency": 0.7,
        ... // los 14 parametros, todos requeridos
    }
}

Response 201:
{
    "id": "uuid",
    "version_number": 4,
    "config": { ... },
    "created_at": "..."
}

Errors:
  409: {"detail": "Cannot create version while bot is playing"}
  429: {"detail": "Maximum 10 versions per day. Try again tomorrow"}
  422: Config validation errors (parametros fuera de rango)
```

**Flujo**: Validar bot no playing → validar rate limit (10/dia) → validar config ranges → crear BotVersion → set como active_version.

### GET /api/bots/{bot_id}/versions
```
Response 200:
{
    "versions": [
        { "id": "uuid", "version_number": 3, "config": {...}, "wins": 5, "losses": 2, "created_at": "..." },
        { "id": "uuid", "version_number": 2, "config": {...}, "wins": 8, "losses": 6, "created_at": "..." },
        ...
    ]
}
```

### GET /api/bots/{bot_id}/versions/compare?v1=2&v2=3
```
Response 200:
{
    "version_1": { "version_number": 2, "config": {...}, "stats": { "wins": 8, "losses": 6, "winrate": 0.57 } },
    "version_2": { "version_number": 3, "config": {...}, "stats": { "wins": 5, "losses": 2, "winrate": 0.71 } },
    "diff": {
        "hand_threshold": { "from": 0.5, "to": 0.4, "delta": -0.1 },
        "aggression": { "from": 0.5, "to": 0.7, "delta": +0.2 }
    }
}
```

### GET /api/bots/{bot_id}
```
Response 200:
{
    "id": "uuid",
    "name": "Alpha Strike",
    ... // todos los campos del bot
    "active_version": { ... },
    "recent_sessions": [ ... ],     // ultimas 10 sesiones
    "streak": ["W","W","L","W",...], // ultimos 10 resultados
    "insights": {                    // derivados de stats
        "strength": "High aggression yields 65% winrate in mid-stakes",
        "vulnerability": "Struggles against conservative opponents",
        "advisory": "Consider reducing bluff_frequency below 0.5"
    }
}
```

---

## Servicios

### bot_service.py

```python
async def create_bot(session, user_id, name, description, avatar, preset) -> Bot
async def update_bot(session, user_id, bot_id, name, description, avatar) -> Bot
async def get_bots(session, user_id) -> list[Bot]
async def get_bot_detail(session, user_id, bot_id) -> Bot  # con sessions, streak, insights
async def create_version(session, user_id, bot_id, config: BotConfigSchema) -> BotVersion
async def get_versions(session, user_id, bot_id) -> list[BotVersion]
async def compare_versions(session, user_id, bot_id, v1: int, v2: int) -> dict
async def update_bot_stats(session, bot_id, version_id, won: bool, hands: int, profit: int)
    # Llamado post-session para actualizar contadores
```

---

## Validacion de Config (Pydantic)

```python
class BotConfigSchema(BaseModel):
    hand_threshold: float = Field(ge=0.0, le=1.0)
    raise_tendency: float = Field(ge=0.0, le=1.0)
    three_bet_frequency: float = Field(ge=0.0, le=1.0)
    aggression: float = Field(ge=0.0, le=1.0)
    bluff_frequency: float = Field(ge=0.0, le=1.0)
    fold_to_pressure: float = Field(ge=0.0, le=1.0)
    continuation_bet: float = Field(ge=0.0, le=1.0)
    bet_size_tendency: float = Field(ge=0.0, le=1.0)
    overbet_willingness: float = Field(ge=0.0, le=1.0)
    risk_tolerance: float = Field(ge=0.0, le=1.0)
    survival_priority: float = Field(ge=0.0, le=1.0)
    adaptation_speed: float = Field(ge=0.0, le=1.0)
    leave_threshold_up: float = Field(ge=1.0, le=5.0)
    leave_threshold_down: float = Field(ge=0.0, le=1.0)
    min_hands_before_leave: int = Field(ge=5, le=50)
    rebuy_willingness: float = Field(ge=0.0, le=1.0)
    session_max_hands: int = Field(ge=20, le=500)
```

---

## Archivos

```
backend/app/
  api/bots.py               # Endpoints CRUD bots + versions
  services/bot_service.py    # Business logic
  models/bot.py              # Bot, BotVersion models
  schemas/bot.py             # BotConfigSchema, BotResponse, VersionResponse, CompareResponse
```

---

## Testing Strategy

### Unit Tests
- `test_bot_service.py`:
  - Crear bot: version v1 creada con preset, status idle, elo 1000.
  - Crear 4to bot → error max 3.
  - Crear version: numero incrementa, marcada activa.
  - Crear 11va version en un dia → error rate limit.
  - Editar bot playing → error.
  - Comparar versiones: diff correcto.

### Integration Tests
- `test_bots_api.py`:
  - Register → create bot → edit config → new version → list bots → detail.
  - Flujo onboarding: register → onboarding con preset → bot creado v1.
