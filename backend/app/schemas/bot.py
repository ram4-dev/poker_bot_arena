from pydantic import BaseModel, Field
from datetime import datetime


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


class CreateBotRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    avatar: str = Field(default="bot_default", max_length=50)
    preset: str


class UpdateBotRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = None
    avatar: str | None = None


class CreateVersionRequest(BaseModel):
    config: BotConfigSchema


class BotVersionResponse(BaseModel):
    id: str
    version_number: int
    config: dict
    preset_origin: str | None
    wins: int
    losses: int
    hands_played: int
    total_profit: int
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_model(cls, v):
        return cls(
            id=v.id,
            version_number=v.version_number,
            config=v.config_json,
            preset_origin=v.preset_origin,
            wins=v.wins,
            losses=v.losses,
            hands_played=v.hands_played,
            total_profit=v.total_profit,
            created_at=v.created_at,
        )


class BotResponse(BaseModel):
    id: str
    name: str
    description: str | None
    avatar: str
    status: str
    elo: int
    total_wins: int
    total_losses: int
    total_hands: int
    winrate: float
    active_version: BotVersionResponse | None
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_model(cls, bot):
        total = bot.total_wins + bot.total_losses
        winrate = bot.total_wins / total if total > 0 else 0.0
        av = BotVersionResponse.from_model(bot.active_version) if bot.active_version else None
        return cls(
            id=bot.id,
            name=bot.name,
            description=bot.description,
            avatar=bot.avatar,
            status=bot.status,
            elo=bot.elo,
            total_wins=bot.total_wins,
            total_losses=bot.total_losses,
            total_hands=bot.total_hands,
            winrate=round(winrate, 2),
            active_version=av,
            created_at=bot.created_at,
        )
