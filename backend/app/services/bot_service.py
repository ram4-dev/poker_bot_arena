from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from app.config import get_settings
from app.models.bot import Bot, BotVersion
from app.engine.presets import get_preset

settings = get_settings()


async def create_bot(
    session: AsyncSession, user_id: str, name: str, description: str | None, avatar: str, preset: str
) -> Bot:
    # Check max bots
    result = await session.execute(
        select(func.count()).select_from(Bot).where(Bot.user_id == user_id)
    )
    if result.scalar() >= settings.MAX_BOTS:
        raise HTTPException(400, f"Maximum {settings.MAX_BOTS} bots allowed")

    config = get_preset(preset)

    bot = Bot(user_id=user_id, name=name, description=description, avatar=avatar)
    session.add(bot)
    await session.flush()

    version = BotVersion(
        bot_id=bot.id,
        version_number=1,
        config_json=config.__dict__,
        preset_origin=preset.lower(),
    )
    session.add(version)
    await session.flush()

    bot.active_version_id = version.id
    await session.commit()
    await session.refresh(bot, ["active_version", "versions"])

    return bot


async def get_bots(session: AsyncSession, user_id: str) -> list[Bot]:
    result = await session.execute(
        select(Bot)
        .where(Bot.user_id == user_id)
        .options(selectinload(Bot.active_version))
        .order_by(Bot.created_at.desc())
    )
    return list(result.scalars().all())


async def get_bot(session: AsyncSession, user_id: str, bot_id: str) -> Bot:
    result = await session.execute(
        select(Bot)
        .where(Bot.id == bot_id)
        .options(selectinload(Bot.active_version), selectinload(Bot.versions))
    )
    bot = result.scalar_one_or_none()
    if not bot:
        raise HTTPException(404, "Bot not found")
    if bot.user_id != user_id:
        raise HTTPException(403, "Bot belongs to another user")
    return bot


async def update_bot(
    session: AsyncSession, user_id: str, bot_id: str,
    name: str | None = None, description: str | None = None, avatar: str | None = None
) -> Bot:
    bot = await get_bot(session, user_id, bot_id)
    if bot.status == "playing":
        raise HTTPException(409, "Cannot edit bot while playing")

    if name is not None:
        bot.name = name
    if description is not None:
        bot.description = description
    if avatar is not None:
        bot.avatar = avatar

    await session.commit()
    await session.refresh(bot, ["active_version"])
    return bot


async def create_version(session: AsyncSession, user_id: str, bot_id: str, config_dict: dict) -> BotVersion:
    bot = await get_bot(session, user_id, bot_id)
    if bot.status == "playing":
        raise HTTPException(409, "Cannot create version while bot is playing")

    # Rate limit: max 10/day
    day_ago = datetime.now(timezone.utc) - timedelta(hours=24)
    result = await session.execute(
        select(func.count()).select_from(BotVersion).where(
            BotVersion.bot_id == bot_id, BotVersion.created_at > day_ago
        )
    )
    if result.scalar() >= settings.MAX_VERSIONS_PER_DAY:
        raise HTTPException(429, "Maximum 10 versions per day. Try again tomorrow")

    # Get next version number
    result = await session.execute(
        select(func.max(BotVersion.version_number)).where(BotVersion.bot_id == bot_id)
    )
    max_ver = result.scalar() or 0

    version = BotVersion(
        bot_id=bot_id,
        version_number=max_ver + 1,
        config_json=config_dict,
        preset_origin=None,
    )
    session.add(version)
    await session.flush()

    bot.active_version_id = version.id
    await session.commit()
    await session.refresh(version)

    return version


async def get_versions(session: AsyncSession, user_id: str, bot_id: str) -> list[BotVersion]:
    await get_bot(session, user_id, bot_id)  # ownership check
    result = await session.execute(
        select(BotVersion).where(BotVersion.bot_id == bot_id).order_by(BotVersion.version_number.desc())
    )
    return list(result.scalars().all())


async def compare_versions(session: AsyncSession, user_id: str, bot_id: str, v1: int, v2: int) -> dict:
    await get_bot(session, user_id, bot_id)
    result1 = await session.execute(
        select(BotVersion).where(BotVersion.bot_id == bot_id, BotVersion.version_number == v1)
    )
    result2 = await session.execute(
        select(BotVersion).where(BotVersion.bot_id == bot_id, BotVersion.version_number == v2)
    )
    ver1 = result1.scalar_one_or_none()
    ver2 = result2.scalar_one_or_none()
    if not ver1 or not ver2:
        raise HTTPException(404, "Version not found")

    diff = {}
    for key in ver1.config_json:
        val1 = ver1.config_json[key]
        val2 = ver2.config_json.get(key, val1)
        if val1 != val2:
            diff[key] = {"from": val1, "to": val2, "delta": round(val2 - val1, 3) if isinstance(val1, (int, float)) else None}

    total1 = ver1.wins + ver1.losses
    total2 = ver2.wins + ver2.losses
    return {
        "version_1": {"version_number": v1, "config": ver1.config_json, "stats": {
            "wins": ver1.wins, "losses": ver1.losses, "winrate": round(ver1.wins / total1, 2) if total1 > 0 else 0
        }},
        "version_2": {"version_number": v2, "config": ver2.config_json, "stats": {
            "wins": ver2.wins, "losses": ver2.losses, "winrate": round(ver2.wins / total2, 2) if total2 > 0 else 0
        }},
        "diff": diff,
    }


async def update_bot_stats(session: AsyncSession, bot_id: str, version_id: str, won: bool, hands: int, profit: int):
    result = await session.execute(select(Bot).where(Bot.id == bot_id))
    bot = result.scalar_one_or_none()
    if not bot:
        return

    if won:
        bot.total_wins += 1
    else:
        bot.total_losses += 1
    bot.total_hands += hands

    result = await session.execute(select(BotVersion).where(BotVersion.id == version_id))
    version = result.scalar_one_or_none()
    if version:
        if won:
            version.wins += 1
        else:
            version.losses += 1
        version.hands_played += hands
        version.total_profit += profit

    await session.commit()
