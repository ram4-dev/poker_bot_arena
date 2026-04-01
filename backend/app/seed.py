"""Seed script: creates arenas, demo user, and fictional users with bots."""
import asyncio
from app.database import engine, async_session, Base
from app.models import *  # noqa: F401, F403


FICTIONAL_USERS = [
    {
        "email": "poker_king@botarena.com",
        "username": "poker_king",
        "password": "king1234",
        "balance": 8000,
        "elo": 1240,
        "bots": [
            ("Iron Fist", "aggressive"),
            ("The Crusher", "opportunist"),
        ],
    },
    {
        "email": "zen_master@botarena.com",
        "username": "zen_master",
        "password": "zen1234",
        "balance": 3200,
        "elo": 980,
        "bots": [
            ("Stone Wall", "conservative"),
            ("Slow Burn", "balanced"),
        ],
    },
    {
        "email": "ghost_bluffer@botarena.com",
        "username": "ghost_bluffer",
        "password": "ghost1234",
        "balance": 1500,
        "elo": 870,
        "bots": [
            ("Smoke Screen", "bluffer"),
            ("Mirage", "aggressive"),
        ],
    },
    {
        "email": "math_wizard@botarena.com",
        "username": "math_wizard",
        "password": "math1234",
        "balance": 6500,
        "elo": 1180,
        "bots": [
            ("Probability Engine", "balanced"),
            ("Expected Value", "conservative"),
            ("Edge Finder", "opportunist"),
        ],
    },
    {
        "email": "risky_business@botarena.com",
        "username": "risky_business",
        "password": "risky1234",
        "balance": 500,
        "elo": 760,
        "bots": [
            ("All In Andy", "aggressive"),
            ("Moonshot", "bluffer"),
        ],
    },
    {
        "email": "the_oracle@botarena.com",
        "username": "the_oracle",
        "password": "oracle1234",
        "balance": 12000,
        "elo": 1420,
        "bots": [
            ("Foresight", "opportunist"),
            ("Prescient", "balanced"),
            ("Clairvoyant", "conservative"),
        ],
    },
]


async def seed():
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        from app.models.arena import Arena
        from sqlalchemy import select

        # --- Arenas ---
        existing = (await session.execute(select(Arena))).scalars().all()
        if existing:
            print("Arenas already seeded")
        else:
            arenas = [
                Arena(name="Low Stakes", slug="low", buy_in=100, small_blind=1, big_blind=2),
                Arena(name="Mid Stakes", slug="mid", buy_in=500, small_blind=5, big_blind=10),
                Arena(name="High Stakes", slug="high", buy_in=2000, small_blind=20, big_blind=40),
                Arena(name="Practice", slug="practice", buy_in=0, small_blind=1, big_blind=2, reward_multiplier=0.1, is_practice=True),
            ]
            session.add_all(arenas)
            await session.commit()
            print("Arenas seeded: Low, Mid, High, Practice")

        # --- Demo user ---
        from app.models.user import User
        from app.models.bot import Bot, BotVersion
        from app.models.ledger import LedgerEntry
        from app.services.auth_service import hash_password
        from app.engine.presets import PRESETS

        demo = (await session.execute(select(User).where(User.email == "demo@botarena.com"))).scalar_one_or_none()
        if not demo:
            demo = User(
                email="demo@botarena.com",
                username="demo_architect",
                password_hash=hash_password("demo1234"),
                balance=5000,
                onboarding_completed=True,
            )
            session.add(demo)
            await session.flush()

            session.add(LedgerEntry(
                user_id=demo.id, type="initial_grant",
                amount=5000, balance_after=5000, description="Welcome bonus",
            ))

            for name, preset_key in [("Alpha Strike", "aggressive"), ("Guardian", "conservative"), ("Phantom", "bluffer")]:
                config = PRESETS[preset_key]
                bot = Bot(user_id=demo.id, name=name, avatar=f"bot_{preset_key}")
                session.add(bot)
                await session.flush()
                ver = BotVersion(
                    bot_id=bot.id, version_number=1,
                    config_json=config.__dict__, preset_origin=preset_key,
                )
                session.add(ver)
                await session.flush()
                bot.active_version_id = ver.id

            await session.commit()
            print("Demo user created: demo@botarena.com / demo1234")
        else:
            print("Demo user already exists")

        # --- Fictional users ---
        for u_data in FICTIONAL_USERS:
            existing_user = (await session.execute(
                select(User).where(User.email == u_data["email"])
            )).scalar_one_or_none()

            if existing_user:
                print(f"User already exists: {u_data['username']}")
                continue

            user = User(
                email=u_data["email"],
                username=u_data["username"],
                password_hash=hash_password(u_data["password"]),
                balance=u_data["balance"],
                elo=u_data["elo"],
                onboarding_completed=True,
            )
            session.add(user)
            await session.flush()

            session.add(LedgerEntry(
                user_id=user.id, type="initial_grant",
                amount=u_data["balance"], balance_after=u_data["balance"],
                description="Welcome bonus",
            ))

            for bot_name, preset_key in u_data["bots"]:
                config = PRESETS[preset_key]
                bot = Bot(user_id=user.id, name=bot_name, avatar=f"bot_{preset_key}")
                session.add(bot)
                await session.flush()
                ver = BotVersion(
                    bot_id=bot.id, version_number=1,
                    config_json=config.__dict__, preset_origin=preset_key,
                )
                session.add(ver)
                await session.flush()
                bot.active_version_id = ver.id

            await session.commit()
            print(f"Created user: {u_data['username']} ({u_data['email']}) — {len(u_data['bots'])} bots")


if __name__ == "__main__":
    asyncio.run(seed())
