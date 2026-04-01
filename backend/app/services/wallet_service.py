from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.config import get_settings
from app.models.user import User
from app.models.ledger import LedgerEntry

settings = get_settings()


async def get_balance(session: AsyncSession, user_id: str) -> dict:
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")

    # can_rescue: balance is 0 and no rescue in the last 24h
    can_rescue = False
    if user.balance == 0:
        day_ago = datetime.now(timezone.utc) - timedelta(hours=24)
        rescue_count = await session.execute(
            select(func.count()).select_from(LedgerEntry).where(
                LedgerEntry.user_id == user_id,
                LedgerEntry.type == "daily_rescue",
                LedgerEntry.created_at > day_ago,
            )
        )
        can_rescue = rescue_count.scalar() == 0

    return {
        "balance": user.balance,
        "locked_balance": user.locked_balance,
        "total": user.balance + user.locked_balance,
        "can_rescue": can_rescue,
    }


async def lock_buy_in(session: AsyncSession, user_id: str, amount: int) -> LedgerEntry:
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    if user.balance < amount:
        raise HTTPException(400, "Insufficient balance for buy-in")

    user.balance -= amount
    user.locked_balance += amount

    entry = LedgerEntry(
        user_id=user_id,
        type="buy_in_lock",
        amount=-amount,
        balance_after=user.balance,
        description=f"Buy-in locked: {amount}",
    )
    session.add(entry)
    await session.commit()
    return entry


async def unlock_buy_in(session: AsyncSession, user_id: str, amount: int) -> LedgerEntry:
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")

    user.locked_balance -= amount
    user.balance += amount

    entry = LedgerEntry(
        user_id=user_id,
        type="buy_in_unlock",
        amount=amount,
        balance_after=user.balance,
        description=f"Buy-in refunded: {amount}",
    )
    session.add(entry)
    await session.commit()
    return entry


async def settle_session(
    session: AsyncSession, user_id: str, buy_in: int, final_stack: int, session_id: str,
    reward_multiplier: float = 1.0,
) -> LedgerEntry:
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")

    user.locked_balance -= buy_in

    # Apply reward multiplier (practice arena = 0.1)
    if reward_multiplier < 1.0:
        profit = final_stack - buy_in
        adjusted_profit = int(profit * reward_multiplier)
        credited = buy_in + adjusted_profit
    else:
        credited = final_stack

    user.balance += credited
    net = credited - buy_in

    entry = LedgerEntry(
        user_id=user_id,
        type="session_result",
        amount=net,
        balance_after=user.balance,
        reference_id=session_id,
        description=f"Session result: {'+'if net >= 0 else ''}{net}",
    )
    session.add(entry)
    await session.commit()
    return entry


async def daily_rescue(session: AsyncSession, user_id: str) -> LedgerEntry:
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")

    if user.balance > 0:
        raise HTTPException(400, "Balance must be 0 to claim rescue")

    # Check if already claimed today
    day_ago = datetime.now(timezone.utc) - timedelta(hours=24)
    result = await session.execute(
        select(func.count()).select_from(LedgerEntry).where(
            LedgerEntry.user_id == user_id,
            LedgerEntry.type == "daily_rescue",
            LedgerEntry.created_at > day_ago,
        )
    )
    if result.scalar() > 0:
        raise HTTPException(429, "Daily rescue already claimed. Try again later")

    user.balance += settings.DAILY_RESCUE

    entry = LedgerEntry(
        user_id=user_id,
        type="daily_rescue",
        amount=settings.DAILY_RESCUE,
        balance_after=user.balance,
        description="Daily rescue bonus",
    )
    session.add(entry)
    await session.commit()
    return entry


async def get_ledger(
    session: AsyncSession, user_id: str,
    type_filter: str | None = None, limit: int = 20, offset: int = 0
) -> tuple[list[LedgerEntry], int]:
    query = select(LedgerEntry).where(LedgerEntry.user_id == user_id)
    count_query = select(func.count()).select_from(LedgerEntry).where(LedgerEntry.user_id == user_id)

    if type_filter:
        query = query.where(LedgerEntry.type == type_filter)
        count_query = count_query.where(LedgerEntry.type == type_filter)

    total = (await session.execute(count_query)).scalar()
    result = await session.execute(
        query.order_by(LedgerEntry.created_at.desc()).limit(limit).offset(offset)
    )
    return list(result.scalars().all()), total
