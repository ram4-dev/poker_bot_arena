from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.user import User
from app.models.bot import Bot
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
    # Get bots
    p_bot = (await session.execute(select(Bot).where(Bot.id == player_sess.bot_id))).scalar_one()
    o_bot = (await session.execute(select(Bot).where(Bot.id == opponent_sess.bot_id))).scalar_one()

    actual_p = calculate_profit_ratio(player_sess.final_stack, player_sess.buy_in)
    actual_o = calculate_profit_ratio(opponent_sess.final_stack, opponent_sess.buy_in)

    delta_p = calculate_elo_delta(p_bot.elo, o_bot.elo, actual_p)
    delta_o = calculate_elo_delta(o_bot.elo, p_bot.elo, actual_o)

    # Update bot ELO
    player_sess.elo_before = p_bot.elo
    p_bot.elo = max(0, p_bot.elo + delta_p)
    player_sess.elo_after = p_bot.elo

    opponent_sess.elo_before = o_bot.elo
    o_bot.elo = max(0, o_bot.elo + delta_o)
    opponent_sess.elo_after = o_bot.elo

    # Recalculate user ELO (weighted average of bot ELOs)
    await recalculate_user_elo(session, player_sess.user_id)
    await recalculate_user_elo(session, opponent_sess.user_id)


async def recalculate_user_elo(session: AsyncSession, user_id: str):
    result = await session.execute(select(Bot).where(Bot.user_id == user_id))
    bots = list(result.scalars().all())

    if not bots:
        return

    total_hands = sum(b.total_hands for b in bots)
    if total_hands == 0:
        avg_elo = sum(b.elo for b in bots) // len(bots)
    else:
        weighted = sum(b.elo * b.total_hands for b in bots)
        avg_elo = weighted // total_hands

    user = (await session.execute(select(User).where(User.id == user_id))).scalar_one()
    user.elo = avg_elo
