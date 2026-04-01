from pydantic import BaseModel
from datetime import datetime


class HandEventResponse(BaseModel):
    sequence: int
    street: str
    player_seat: int
    action: str
    amount: int
    pot_after: int
    hand_strength: float | None = None
    hole_cards: list[str] = []


class HandResponse(BaseModel):
    hand_number: int
    pot: int
    winner_session_id: str | None
    community_cards: list[str] = []
    winning_hand_rank: str | None
    player_1_stack_after: int
    player_2_stack_after: int
    player_1_hole: list[str] = []
    player_2_hole: list[str] = []
    events: list[HandEventResponse]


class SessionSummaryResponse(BaseModel):
    id: str
    arena_name: str
    bot_name: str
    opponent_bot_name: str | None
    status: str
    profit: int | None
    hands_played: int
    hands_won: int
    exit_reason: str | None
    elo_change: int | None
    completed_at: datetime | None


class KeyEventResponse(BaseModel):
    hand_number: int
    type: str
    description: str
    impact: str


class InsightsResponse(BaseModel):
    strength: str
    vulnerability: str
    advisory: str


class SessionDetailResponse(BaseModel):
    id: str
    status: str
    arena_name: str
    bot_name: str
    bot_version: int
    opponent_bot_name: str | None
    opponent_user: str | None
    outcome: str | None
    kpis: dict
    key_events: list[KeyEventResponse]
    performance: list[dict]
    insights: InsightsResponse | None
    rivals: list[dict]
    hands: list[HandResponse]


class PaginatedSessionsResponse(BaseModel):
    items: list[SessionSummaryResponse]
    total: int
    limit: int
    offset: int
