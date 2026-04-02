from pydantic import BaseModel, Field
from datetime import datetime


class CreateAgentRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class AgentResponse(BaseModel):
    id: str
    name: str
    status: str
    elo: int
    total_wins: int
    total_losses: int
    total_hands: int
    winrate: float
    consecutive_timeouts: int
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_model(cls, agent):
        total = agent.total_wins + agent.total_losses
        winrate = agent.total_wins / total if total > 0 else 0.0
        return cls(
            id=agent.id,
            name=agent.name,
            status=agent.status,
            elo=agent.elo,
            total_wins=agent.total_wins,
            total_losses=agent.total_losses,
            total_hands=agent.total_hands,
            winrate=round(winrate, 2),
            consecutive_timeouts=agent.consecutive_timeouts,
            created_at=agent.created_at,
        )


class AgentListResponse(BaseModel):
    agents: list[AgentResponse]
