"""Queue all fictional bots into arenas so matches can start."""
import asyncio
from app.database import engine, async_session, Base
from app.models import *  # noqa: F401, F403


# Which arena each user goes to based on balance
ARENA_ASSIGNMENTS = {
    "demo_architect":  ["practice", "low"],
    "poker_king":      ["low", "mid"],
    "zen_master":      ["practice", "low"],
    "ghost_bluffer":   ["practice", "low"],
    "math_wizard":     ["low", "mid"],
    "risky_business":  ["practice", "low"],
    "the_oracle":      ["low", "mid"],
}


async def queue_bots():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        from sqlalchemy import select
        from app.models.user import User
        from app.models.bot import Bot
        from app.models.arena import Arena
        from app.models.session import Session as GameSession
        from app.services.wallet_service import lock_buy_in

        arenas_by_slug = {
            a.slug: a for a in (await session.execute(select(Arena))).scalars().all()
        }

        for username, arena_slugs in ARENA_ASSIGNMENTS.items():
            user = (await session.execute(
                select(User).where(User.username == username)
            )).scalar_one_or_none()
            if not user:
                print(f"  User not found: {username}")
                continue

            bots = (await session.execute(
                select(Bot).where(Bot.user_id == user.id, Bot.status == "idle")
            )).scalars().all()

            if not bots:
                print(f"  {username}: no idle bots")
                continue

            # Assign bots round-robin across arenas
            for idx, bot in enumerate(bots):
                if not bot.active_version_id:
                    continue

                arena_slug = arena_slugs[idx % len(arena_slugs)]
                arena = arenas_by_slug.get(arena_slug)
                if not arena:
                    continue

                # Skip if already queued somewhere
                already = (await session.execute(
                    select(GameSession).where(
                        GameSession.bot_id == bot.id,
                        GameSession.status.in_(["queued", "playing"]),
                    )
                )).scalar_one_or_none()
                if already:
                    print(f"  {bot.name} already in queue/playing, skipping")
                    continue

                # Lock buy-in for paid arenas
                if arena.buy_in > 0:
                    try:
                        await lock_buy_in(session, user.id, arena.buy_in)
                    except Exception as e:
                        print(f"  {bot.name}: can't afford {arena.name} ({e}), using practice")
                        arena = arenas_by_slug["practice"]

                gs = GameSession(
                    user_id=user.id,
                    bot_id=bot.id,
                    bot_version_id=bot.active_version_id,
                    arena_id=arena.id,
                    buy_in=arena.buy_in,
                    initial_stack=arena.buy_in if arena.buy_in > 0 else 1000,
                    elo_before=bot.elo,
                )
                session.add(gs)
                bot.status = "queued"
                await session.flush()
                print(f"  Queued [{arena.name}] {bot.name} ({username})")

        await session.commit()
        print("\nDone queuing bots.")


if __name__ == "__main__":
    asyncio.run(queue_bots())
