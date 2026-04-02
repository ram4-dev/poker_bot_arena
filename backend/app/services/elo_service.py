from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.user import User
from app.models.agent import Agent
from app.models.session import Session as GameSession

settings = get_settings()


def calculate_profit_ratio(final_stack: int, buy_in: int) -> float:
    if buy_in == 0:
        return 0.5
    return max(0.0, min(1.0, final_stack / (2 * buy_in)))


def calculate_elo_delta(player_elo: int, opponent_elo: int, actual_score: float) -> int:
    expected = 1 / (1 + 10 ** ((opponent_elo - player_elo) / 400))
    return round(settings.ELO_K * (actual_score - expected))


async def update_elo(session: AsyncSession, player_sess: GameSession, opponent_sess: GameSession):
    """Update ELO ratings for both agents after a completed session."""
    # Get agents
    p_agent = (await session.execute(select(Agent).where(Agent.id == player_sess.agent_id))).scalar_one()
    o_agent = (await session.execute(select(Agent).where(Agent.id == opponent_sess.agent_id))).scalar_one()

    actual_p = calculate_profit_ratio(player_sess.final_stack, player_sess.buy_in)
    actual_o = calculate_profit_ratio(opponent_sess.final_stack, opponent_sess.buy_in)

    delta_p = calculate_elo_delta(p_agent.elo, o_agent.elo, actual_p)
    delta_o = calculate_elo_delta(o_agent.elo, p_agent.elo, actual_o)

    # Update agent ELO
    player_sess.elo_before = p_agent.elo
    p_agent.elo = max(0, p_agent.elo + delta_p)
    player_sess.elo_after = p_agent.elo

    opponent_sess.elo_before = o_agent.elo
    o_agent.elo = max(0, o_agent.elo + delta_o)
    opponent_sess.elo_after = o_agent.elo

    # Recalculate user ELO (weighted average of agent ELOs)
    await recalculate_user_elo(session, player_sess.user_id)
    await recalculate_user_elo(session, opponent_sess.user_id)


async def recalculate_user_elo(session: AsyncSession, user_id: str):
    """Recalculate a user's ELO as the weighted average of their agents' ELOs."""
    result = await session.execute(select(Agent).where(Agent.user_id == user_id))
    agents = list(result.scalars().all())

    if not agents:
        return

    total_hands = sum(a.total_hands for a in agents)
    if total_hands == 0:
        avg_elo = sum(a.elo for a in agents) // len(agents)
    else:
        weighted = sum(a.elo * a.total_hands for a in agents)
        avg_elo = weighted // total_hands

    user = (await session.execute(select(User).where(User.id == user_id))).scalar_one()
    user.elo = avg_elo
