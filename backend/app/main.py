from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, agent, arenas, sessions, wallet, leaderboard, admin, game, matches
from app.scheduler.jobs import start_scheduler, stop_scheduler
from app.config import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = start_scheduler()
    yield
    stop_scheduler(scheduler)


app = FastAPI(
    title="Bot Arena API",
    description="Competitive bot engineering platform",
    version="0.1.0",
    lifespan=lifespan,
)

_cors_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
_allow_all = _cors_origins == ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _allow_all else _cors_origins,
    allow_credentials=not _allow_all,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(agent.router, prefix="/api", tags=["agent"])
app.include_router(arenas.router, prefix="/api/arenas", tags=["arenas"])
app.include_router(sessions.router, prefix="/api/sessions", tags=["sessions"])
app.include_router(wallet.router, prefix="/api/wallet", tags=["wallet"])
app.include_router(leaderboard.router, prefix="/api/leaderboard", tags=["leaderboard"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(game.router, prefix="/api", tags=["game"])
app.include_router(matches.router, prefix="/api/matches", tags=["matches"])


@app.get("/ping")
async def ping():
    return {"status": "pong"}
