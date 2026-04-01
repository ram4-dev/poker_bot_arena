from pydantic import BaseModel


class QueueRequest(BaseModel):
    bot_id: str


class ArenaStatsResponse(BaseModel):
    bots_in_queue: int
    active_tables: int
    estimated_reward: int


class ArenaResponse(BaseModel):
    id: str
    name: str
    slug: str
    buy_in: int
    small_blind: int
    big_blind: int
    is_practice: bool
    reward_multiplier: float
    stats: ArenaStatsResponse

    model_config = {"from_attributes": True}


class QueueResponse(BaseModel):
    session_id: str
    status: str
    arena: str
    bot_name: str
