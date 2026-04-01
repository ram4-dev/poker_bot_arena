from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, bots, arenas, sessions, wallet, leaderboard, admin, matches
from app.scheduler.jobs import start_scheduler, stop_scheduler


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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(bots.router, prefix="/api/bots", tags=["bots"])
app.include_router(arenas.router, prefix="/api/arenas", tags=["arenas"])
app.include_router(sessions.router, prefix="/api/sessions", tags=["sessions"])
app.include_router(wallet.router, prefix="/api/wallet", tags=["wallet"])
app.include_router(leaderboard.router, prefix="/api/leaderboard", tags=["leaderboard"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(matches.router, prefix="/api/matches", tags=["matches"])


@app.get("/ping")
async def ping():
    return {"status": "pong"}
