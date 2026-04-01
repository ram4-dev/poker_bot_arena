from pydantic import BaseModel
from datetime import datetime


class LeaderboardEntryResponse(BaseModel):
    rank: int
    entity_id: str
    name: str
    creator: str | None = None
    elo: int
    winrate: float
    total_wins: int
    total_losses: int
    last_match: datetime | None = None
    badges: list[str] = []


class MyPositionResponse(BaseModel):
    rank: int
    username: str
    elo: int


class LeaderboardResponse(BaseModel):
    items: list[LeaderboardEntryResponse]
    total: int
    my_position: MyPositionResponse | None = None
    season: str
    filters: dict = {}


class SeasonListResponse(BaseModel):
    current: str
    available: list[str]
