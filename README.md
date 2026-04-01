# Bot Arena

Competitive poker bot builder. Create bots with configurable strategies, deploy them to arenas, and watch them compete in real time.

The core loop: **Build → Deploy → Watch → Analyze → Iterate.**

---

## Stack

| Layer | Tech |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy async, SQLite, Alembic |
| Poker engine | PyPokerEngine + Treys (hand evaluation) |
| Scheduler | APScheduler (tick every 30s) |
| Auth | JWT (access) + UUID refresh tokens |
| Frontend | React 18, TypeScript, Vite, Recharts |

---

## Quick Start

```bash
# 1. Install everything
make setup

# 2. Seed arenas + demo user
make seed

# 3. Run backend + frontend
make dev
```

- Backend: http://localhost:8000
- Frontend: http://localhost:5173
- API docs: http://localhost:8000/docs

### Demo credentials

| Email | Password | Notes |
|---|---|---|
| demo@botarena.com | demo1234 | Demo user, 3 bots pre-created |
| poker_king@botarena.com | king1234 | ELO 1240 |
| the_oracle@botarena.com | oracle1234 | ELO 1420 |
| math_wizard@botarena.com | math1234 | ELO 1180 |
| zen_master@botarena.com | zen1234 | ELO 980 |
| ghost_bluffer@botarena.com | ghost1234 | ELO 870 |
| risky_business@botarena.com | risky1234 | ELO 760 |

---

## Project Structure

```
bot_arena/
├── backend/
│   ├── app/
│   │   ├── api/          # Route handlers (auth, bots, arenas, sessions, matches, ...)
│   │   ├── engine/       # Poker engine (configurable_bot, runner, hand_evaluator, presets)
│   │   ├── models/       # SQLAlchemy models
│   │   ├── schemas/      # Pydantic request/response schemas
│   │   ├── services/     # Business logic (matchmaker, wallet, elo, session_manager, ...)
│   │   ├── scheduler/    # APScheduler tick loop
│   │   ├── seed.py       # Demo data seeder
│   │   └── queue_bots.py # Enqueue all bots into arenas for testing
│   └── alembic/          # DB migrations
├── frontend/
│   └── src/
│       ├── api/          # Axios client + typed API functions
│       ├── pages/        # Route-level components (11 pages)
│       ├── components/   # Shared UI (AppShell, BotCard, EfficiencyRadar, ...)
│       └── utils/        # Helpers (cards.ts for PyPokerEngine card parsing)
└── Makefile
```

---

## Bot Configuration

Each bot is defined by 17 float parameters (0.0–1.0):

| Category | Parameters |
|---|---|
| Pre-flop | `hand_threshold`, `raise_tendency`, `three_bet_frequency` |
| Post-flop | `aggression`, `bluff_frequency`, `fold_to_pressure`, `continuation_bet` |
| Sizing | `bet_size_tendency`, `overbet_willingness` |
| Meta | `risk_tolerance`, `survival_priority`, `adaptation_speed` |
| Table management | `leave_threshold_up`, `leave_threshold_down`, `min_hands_before_leave`, `rebuy_willingness`, `session_max_hands` |

### Built-in presets

| Preset | Style |
|---|---|
| `aggressive` | High raise tendency, low fold rate, frequent bluffs |
| `conservative` | Tight preflop, high fold to pressure, low bluff |
| `balanced` | All parameters at 0.5 |
| `opportunist` | Adaptive, high continuation bet, medium bluff |
| `bluffer` | Very high bluff frequency, overbet willing |

---

## Arenas

| Arena | Buy-in | Blinds |
|---|---|---|
| Practice | Free | 1/2 |
| Low Stakes | 100 | 1/2 |
| Mid Stakes | 500 | 5/10 |
| High Stakes | 2000 | 20/40 |

---

## How the Game Loop Works

1. User queues a bot into an arena → `GameSession` created with `status=queued`
2. Every tick, `matchmaker.process_queue()` pairs queued sessions → creates a `Table`
3. `session_manager.execute_hands()` runs N hands via PyPokerEngine per tick
4. Each hand stores: hole cards, community cards, all actions (street + action + amount + hand strength), stacks
5. Session ends when a bot hits a threshold (stack too low/high, max hands, or stack zero)
6. ELO and wallet settle on session close

### Manual tick

```bash
make tick
# or
curl -X POST http://localhost:8000/api/admin/tick
```

---

## Key Make Commands

```bash
make setup          # Install deps + run migrations
make dev            # Start backend + frontend (hot reload)
make dev-backend    # Backend only
make dev-frontend   # Frontend only
make seed           # Create arenas + demo users + bots
make tick           # Trigger one game tick manually
make db-reset       # Drop DB and re-run migrations
make db-migrate m="description"  # Generate Alembic migration
make db-upgrade     # Apply pending migrations
make test           # Run all tests
make lint           # Ruff lint check
make format         # Ruff format
```

---

## Pages

| Route | Description |
|---|---|
| `/dashboard` | KPIs, performance chart, active bot, recent sessions |
| `/bots` | Fleet overview, create bot modal |
| `/bots/:id` | Bot analytics: ELO, streak, profit curve, version history |
| `/bots/:id/edit` | 17-parameter tactical editor with radar preview |
| `/arenas` | Arena selection + deploy panel |
| `/battle` | Quick deploy, active deployments |
| `/matches` | Live match list — all active tables, auto-refresh 5s |
| `/matches/:tableId` | Live match viewer — animated hand replay second by second |
| `/history/:sessionId` | Session report: charts, insights, full hand log with cards |
| `/leaderboard` | User and bot rankings by ELO |
| `/wallet` | Balance, ledger, emergency rescue |

---

## Development Notes

- **Card format**: PyPokerEngine uses `SuitRank` (e.g. `HA` = Ace of Hearts, `CT` = Ten of Clubs). The frontend `parseCard()` utility in `src/utils/cards.ts` handles display conversion including `T → 10`.
- **Event ordering**: bot actions are interleaved via a shared `action_counter` between both bots in `runner.py`, so the event log reflects the real action sequence.
- **No WebSocket**: the live viewer polls `GET /api/matches/:tableId/live` every 4s and animates events client-side.
- **Migrations**: after modifying any SQLAlchemy model, run `make db-migrate m="description"` then `make db-upgrade`.
