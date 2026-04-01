from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.api.deps import get_current_user
from app.models.user import User
from app.models.bot import Bot
from app.models.ranking import SeasonRanking

router = APIRouter()


def _current_season() -> str:
    now = datetime.now()
    quarter = (now.month - 1) // 3 + 1
    return f"{now.year}-Q{quarter}"


@router.get("/users")
async def user_leaderboard(
    season: str | None = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    current = _current_season()
    target_season = season or current

    if target_season == current or target_season == "current":
        # Live ranking
        total = (await session.execute(select(func.count()).select_from(User))).scalar()
        users = (await session.execute(
            select(User).order_by(User.elo.desc()).limit(limit).offset(offset)
        )).scalars().all()

        items = []
        for i, u in enumerate(users):
            total_games = 0
            bots = (await session.execute(select(Bot).where(Bot.user_id == u.id))).scalars().all()
            wins = sum(b.total_wins for b in bots)
            losses = sum(b.total_losses for b in bots)
            total_games = wins + losses
            winrate = wins / total_games if total_games > 0 else 0

            items.append({
                "rank": offset + i + 1,
                "entity_id": u.id,
                "name": u.username,
                "elo": u.elo,
                "winrate": round(winrate, 2),
                "total_wins": wins,
                "total_losses": losses,
                "badges": _calculate_badges(winrate, wins, u),
            })

        # My position
        my_rank = (await session.execute(
            select(func.count()).select_from(User).where(User.elo > user.elo)
        )).scalar() + 1

        return {
            "items": items,
            "total": total,
            "my_position": {"rank": my_rank, "username": user.username, "elo": user.elo},
            "season": target_season,
        }
    else:
        # Historical
        rankings = (await session.execute(
            select(SeasonRanking)
            .where(SeasonRanking.season == target_season, SeasonRanking.entity_type == "user")
            .order_by(SeasonRanking.rank)
            .limit(limit).offset(offset)
        )).scalars().all()

        items = []
        for r in rankings:
            u = (await session.execute(select(User).where(User.id == r.entity_id))).scalar_one_or_none()
            items.append({
                "rank": r.rank, "entity_id": r.entity_id,
                "name": u.username if u else "Unknown",
                "elo": r.elo, "winrate": round(r.winrate, 2),
                "total_wins": r.wins, "total_losses": r.losses, "badges": [],
            })

        total = (await session.execute(
            select(func.count()).select_from(SeasonRanking)
            .where(SeasonRanking.season == target_season, SeasonRanking.entity_type == "user")
        )).scalar()

        return {"items": items, "total": total, "season": target_season}


@router.get("/bots")
async def bot_leaderboard(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    total = (await session.execute(select(func.count()).select_from(Bot))).scalar()
    bots = (await session.execute(
        select(Bot).order_by(Bot.elo.desc()).limit(limit).offset(offset)
    )).scalars().all()

    items = []
    for i, b in enumerate(bots):
        owner = (await session.execute(select(User).where(User.id == b.user_id))).scalar_one()
        total_games = b.total_wins + b.total_losses
        winrate = b.total_wins / total_games if total_games > 0 else 0
        items.append({
            "rank": offset + i + 1,
            "entity_id": b.id,
            "name": b.name,
            "creator": owner.username,
            "elo": b.elo,
            "winrate": round(winrate, 2),
            "total_wins": b.total_wins,
            "total_losses": b.total_losses,
            "badges": [],
        })

    return {"items": items, "total": total, "season": _current_season()}


@router.get("/seasons")
async def list_seasons(session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    current = _current_season()
    result = await session.execute(
        select(SeasonRanking.season).distinct().order_by(SeasonRanking.season.desc())
    )
    available = [current] + [r[0] for r in result.all() if r[0] != current]
    return {"current": current, "available": available}


def _calculate_badges(winrate: float, wins: int, user: User) -> list[str]:
    badges = []
    if winrate >= 0.70 and wins >= 10:
        badges.append("strategy_master")
    if wins >= 5:
        badges.append("bot_on_fire")
    return badges
