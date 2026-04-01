# Spec Tecnica: Leaderboard & Ranking

**Feature**: leaderboard-ranking | **Status**: Approved | **Lang**: es

---

## Decisiones de Arquitectura

### AD-1: ELO estandar K=32 con score basado en profit ratio
- **Decision**: Usar formula ELO clasica pero con actual_score basado en ratio de profit, no solo win/loss binario.
- **Razon**: Un bot que duplico el buy-in deberia ganar mas ELO que uno que gano 1 ficha. Refleja mejor la calidad del juego.
- **Formula**:
  - `expected = 1 / (1 + 10^((opp_elo - player_elo) / 400))`
  - `actual = profit_ratio` donde: 0 = perdio todo, 0.5 = break even, 1 = duplico o mas
  - `profit_ratio = clamp(final_stack / (2 * buy_in), 0, 1)`
  - `delta = K * (actual - expected)` donde K=32
  - Se aplica a bot Y usuario

### AD-2: User ELO = promedio ponderado de bots
- **Decision**: ELO del usuario = promedio de ELO de sus bots, ponderado por manos jugadas.
- **Razon**: Refleja la calidad general del "arquitecto", no solo su mejor bot.
- **Implementacion**: Recalcular en cada update de ELO de bot.

### AD-3: Temporadas automaticas por quarter
- **Decision**: Temporadas se determinan automaticamente por quarter fiscal (Q1: Jan-Mar, Q2: Apr-Jun, etc.).
- **Razon**: Sin admin manual. Se detecta el quarter actual con `datetime.now()`.
- **Snapshot**: Al inicio de cada quarter, se guardan los rankings del quarter anterior en SeasonRanking.

### AD-4: Badges como reglas estaticas (no ML)
- **Decision**: Badges se asignan por reglas simples evaluadas periodicamente.
- **Razon**: Determinista y debuggeable. No requiere ML para MVP.

---

## Modelo de Datos

### SeasonRanking
```python
class SeasonRanking(Base):
    __tablename__ = "season_rankings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    season: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
        # "2026-Q1", "2026-Q2", etc.
    entity_type: Mapped[str] = mapped_column(String(10), nullable=False)
        # "user" | "bot"
    entity_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    elo: Mapped[int] = mapped_column(Integer, nullable=False)
    wins: Mapped[int] = mapped_column(Integer, default=0)
    losses: Mapped[int] = mapped_column(Integer, default=0)
    winrate: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    __table_args__ = (
        UniqueConstraint("season", "entity_type", "entity_id", name="uq_season_entity"),
    )
```

**Nota**: Los rankings "en vivo" se calculan on-the-fly desde User.elo y Bot.elo. SeasonRanking solo almacena snapshots de temporadas cerradas.

---

## Servicios

### elo_service.py

```python
ELO_K = 32
ELO_INITIAL = 1000

async def update_elo(
    session: AsyncSession,
    player_session: Session,
    opponent_session: Session
) -> tuple[int, int]:
    """
    Calcula y aplica delta ELO para ambos jugadores (bot + user).

    1. Obtener ELO actual de ambos bots.
    2. Calcular expected score para cada uno.
    3. Calcular actual score basado en profit ratio.
    4. Aplicar delta a bot.elo y user.elo.
    5. Retornar (elo_before, elo_after) para el player.
    """

def calculate_profit_ratio(final_stack: int, buy_in: int) -> float:
    """
    0.0 = perdio todo (final_stack = 0)
    0.5 = break even (final_stack = buy_in)
    1.0 = duplico o mas (final_stack >= 2 * buy_in)
    """
    return max(0.0, min(1.0, final_stack / (2 * buy_in)))

def calculate_elo_delta(player_elo: int, opponent_elo: int, actual_score: float) -> int:
    expected = 1 / (1 + 10 ** ((opponent_elo - player_elo) / 400))
    return round(ELO_K * (actual_score - expected))

async def recalculate_user_elo(session: AsyncSession, user_id: str):
    """User ELO = promedio ponderado de ELO de sus bots por manos jugadas."""
```

### leaderboard_service.py

```python
async def get_user_leaderboard(
    session: AsyncSession,
    arena_slug: str | None = None,    # filtro por arena
    season: str | None = None,         # "2026-Q1" o "current"
    limit: int = 50,
    offset: int = 0
) -> tuple[list[dict], int]:
    """
    Retorna ranking de usuarios por ELO.
    Si season = "current" o None → query live desde User.elo.
    Si season = "2026-Q1" → query desde SeasonRanking.
    """

async def get_bot_leaderboard(
    session: AsyncSession,
    arena_slug: str | None = None,
    season: str | None = None,
    limit: int = 50,
    offset: int = 0
) -> tuple[list[dict], int]:
    """Ranking de bots por ELO."""

async def get_user_position(session: AsyncSession, user_id: str) -> int:
    """Retorna la posicion del usuario en el ranking global."""

async def snapshot_season(session: AsyncSession, season: str):
    """
    Snapshot de ELO y rankings al cerrar temporada.
    Crear SeasonRanking para cada user y bot.
    """

def get_current_season() -> str:
    """Retorna '2026-Q1', '2026-Q2', etc. basado en fecha actual."""
    now = datetime.now()
    quarter = (now.month - 1) // 3 + 1
    return f"{now.year}-Q{quarter}"
```

### Badge Rules

```python
BADGE_RULES = {
    "strategy_master": {
        "description": "Strategy Master",
        "condition": lambda stats: stats["winrate"] >= 0.70 and stats["sessions"] >= 10,
        "color": "gold"
    },
    "bot_on_fire": {
        "description": "Bot on Fire",
        "condition": lambda stats: stats["current_streak"] >= 5,
        "color": "orange"
    },
    "rookie_of_month": {
        "description": "Rookie of the Month",
        "condition": lambda stats: stats["days_since_register"] <= 30 and stats["elo"] >= 1200,
        "color": "green"
    }
}

async def calculate_badges(session: AsyncSession, entity_type: str, entity_id: str) -> list[str]:
    """Evalua todas las reglas de badges y retorna las que aplican."""
```

---

## API Contracts

### GET /api/leaderboard/users
```
Query: ?season=current&arena=low&limit=50&offset=0

Response 200:
{
    "items": [
        {
            "rank": 1,
            "user_id": "uuid",
            "username": "architect_01",
            "elo": 1350,
            "winrate": 0.72,
            "total_wins": 45,
            "total_losses": 18,
            "last_match": "2026-03-31T14:30:00Z",
            "badges": ["strategy_master", "bot_on_fire"]
        }
    ],
    "total": 150,
    "my_position": {
        "rank": 42,
        "username": "my_username",
        "elo": 1050
    },
    "season": "2026-Q1",
    "filters": {
        "arena": "low",
        "season": "current"
    }
}
```

### GET /api/leaderboard/bots
```
Query: ?season=current&arena=all&limit=50&offset=0

Response 200:
{
    "items": [
        {
            "rank": 1,
            "bot_id": "uuid",
            "bot_name": "Alpha Strike",
            "creator": "architect_01",
            "elo": 1400,
            "winrate": 0.75,
            "total_wins": 30,
            "total_losses": 10,
            "badges": ["bot_on_fire"]
        }
    ],
    "total": 300,
    "season": "2026-Q1"
}
```

### GET /api/leaderboard/seasons
```
Response 200:
{
    "current": "2026-Q1",
    "available": ["2026-Q1"]
}
```

---

## Anti-Abuso (implementado en esta feature)

| Regla | Implementacion |
|-------|---------------|
| Rate limit 60 req/min | Middleware FastAPI con sliding window por user_id (in-memory dict) |
| Max 10 versiones/dia | Query count en bot_service.create_version() |
| Deteccion multi-cuenta (IP) | Log en User.registration_ip, query en auth register |
| No emparejar mismo usuario | WHERE en matchmaker.find_match() |
| Cooldown 5 min rematches | Query en matchmaker.find_match() |

### Rate Limiter Middleware

```python
class RateLimiter:
    """Sliding window rate limiter. In-memory para MVP."""

    def __init__(self, requests_per_minute: int = 60):
        self._requests: dict[str, list[float]] = {}

    async def check(self, user_id: str) -> bool:
        """Retorna True si permitido, False si excedido."""
```

---

## Archivos

```
backend/app/
  api/leaderboard.py           # Endpoints users, bots, seasons
  services/elo_service.py      # ELO calculation, user ELO recalc
  services/leaderboard_service.py  # Rankings, badges, seasons
  models/ranking.py            # SeasonRanking model
  schemas/leaderboard.py       # LeaderboardResponse, BadgeSchema
  middleware/rate_limiter.py   # Rate limit middleware
```

---

## Testing Strategy

### Unit Tests
- `test_elo_service.py`:
  - profit_ratio: stack=0 → 0.0, stack=buy_in → 0.5, stack=2*buy_in → 1.0.
  - ELO delta: equal ELO + win → +16, equal ELO + loss → -16.
  - ELO delta: higher ELO wins vs lower → small gain. Lower beats higher → big gain.
  - User ELO recalc: promedio ponderado correcto.

- `test_leaderboard_service.py`:
  - Ranking ordenado por ELO desc.
  - Filtro por arena funciona.
  - Filtro por season (current vs historico).
  - Badges: winrate 75% + 10 sessions → strategy_master.
  - Badges: streak 5 → bot_on_fire.
  - My position correcto.

- `test_rate_limiter.py`:
  - 60 requests OK, 61st → blocked.
  - Window slides: despues de 1 min, requests viejas se limpian.

### Integration Tests
- `test_leaderboard_api.py`:
  - 3 usuarios con distintos ELOs → ranking correcto.
  - Despues de sesion → ELO actualizado → ranking refleja cambio.
  - Season snapshot → rankings historicos disponibles.
