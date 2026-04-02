from pydantic import BaseModel


class JoinArenaRequest(BaseModel):
    agent_id: str
    arena_id: str


class JoinArenaResponse(BaseModel):
    status: str  # "queued"
    position: int


class ActionRequest(BaseModel):
    agent_id: str
    hand_id: str
    action: str  # fold, check, call, raise, all_in
    amount: int = 0


class LeaveRequest(BaseModel):
    agent_id: str


class SessionResultResponse(BaseModel):
    hands_played: int
    buy_in: int
    final_stack: int
    profit: int
    elo_change: int
