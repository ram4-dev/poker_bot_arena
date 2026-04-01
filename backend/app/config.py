from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./bot_arena.db"
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    SCHEDULER_INTERVAL_SECONDS: int = 30
    HANDS_PER_TICK: int = 5
    INITIAL_BALANCE: int = 5000
    DAILY_RESCUE: int = 500
    MAX_BOTS: int = 3
    MAX_VERSIONS_PER_DAY: int = 10
    ELO_INITIAL: int = 1000
    ELO_K: int = 32
    ELO_RANGE: int = 200
    ELO_RANGE_EXPANSION_PER_MINUTE: int = 50
    REMATCH_COOLDOWN_MINUTES: int = 5
    RATE_LIMIT_PER_MINUTE: int = 60

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
