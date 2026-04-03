import logging
from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)

_INSECURE_DEFAULT = "dev-secret-key-change-in-production"


class Settings(BaseSettings):
    ENV: str = "dev"
    DATABASE_URL: str = "sqlite+aiosqlite:///./bot_arena.db"
    SECRET_KEY: str = _INSECURE_DEFAULT
    ADMIN_API_KEY: str | None = None
    CORS_ORIGINS: str = "http://localhost:5173"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    SCHEDULER_INTERVAL_SECONDS: int = 5
    INITIAL_BALANCE: int = 5000
    DAILY_RESCUE: int = 500
    ELO_INITIAL: int = 1000
    ELO_K: int = 32
    RATE_LIMIT_PER_MINUTE: int = 60

    # v3 settings
    MAX_AGENTS_PER_USER: int = 3
    ACTION_TIMEOUT_SECONDS: int = 30
    MAX_ACTION_RETRIES: int = 2
    CONSECUTIVE_TIMEOUT_LIMIT: int = 3
    MATCHMAKER_ELO_RANGE_BASE: int = 200
    MATCHMAKER_ELO_EXPANSION_PER_MINUTE: int = 50
    MATCHMAKER_ELO_RANGE_CAP: int = 1000
    REMATCH_COOLDOWN_MINUTES: int = 5

    @model_validator(mode="after")
    def validate_secret_key(self) -> "Settings":
        if self.ENV == "test":
            return self
        insecure = not self.SECRET_KEY or self.SECRET_KEY == _INSECURE_DEFAULT
        if insecure:
            if self.ENV in ("production", "prod"):
                raise ValueError(
                    "SECRET_KEY must be set to a secure value in production. "
                    "Set the SECRET_KEY environment variable."
                )
            else:
                logger.critical(
                    "SECURITY WARNING: Using insecure default SECRET_KEY. "
                    "Set SECRET_KEY environment variable before deploying to production."
                )
        return self

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
