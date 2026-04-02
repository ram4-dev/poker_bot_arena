"""Seed script: creates arenas, demo user, and fictional users with agents (v3)."""
import asyncio
from app.database import engine, async_session, Base
from app.models import *  # noqa: F401, F403


FICTIONAL_USERS = [
    {"username": "bluff_master", "agent_name": "BluffBot", "elo": 1100},
    {"username": "tight_player", "agent_name": "TightAgent", "elo": 950},
    {"username": "aggro_smith", "agent_name": "AggroSmith", "elo": 1200},
    {"username": "ranker_99", "agent_name": "RankBot99", "elo": 1150},
    {"username": "practice_king", "agent_name": "PracticeKing", "elo": 800},
]

TEST_AGENTS = [
    {"email": "agent_alpha@test.com", "username": "agent_alpha", "password": "alpha1234", "agent_name": "AlphaBot"},
    {"email": "agent_beta@test.com",  "username": "agent_beta",  "password": "beta1234",  "agent_name": "BetaBot"},
]


async def seed():
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        from app.models.arena import Arena
        from app.models.user import User
        from app.models.agent import Agent
        from app.models.ledger import LedgerEntry
        from app.services.auth_service import hash_password
        from sqlalchemy import select

        # --- Arenas ---
        existing = (await session.execute(select(Arena))).scalars().all()
        if existing:
            print("Arenas already seeded")
        else:
            arenas = [
                Arena(name="Practice", slug="practice", buy_in=100, small_blind=1, big_blind=2, reward_multiplier=0.1, is_practice=True),
                Arena(name="Bronze", slug="bronze", buy_in=500, small_blind=5, big_blind=10),
                Arena(name="Silver", slug="silver", buy_in=1000, small_blind=10, big_blind=20),
                Arena(name="Gold", slug="gold", buy_in=5000, small_blind=50, big_blind=100),
            ]
            session.add_all(arenas)
            await session.commit()
            print("Arenas seeded: Practice, Bronze, Silver, Gold")

        # --- Demo user ---
        demo = (await session.execute(select(User).where(User.email == "demo@botarena.com"))).scalar_one_or_none()
        if not demo:
            demo = User(
                email="demo@botarena.com",
                username="demo",
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

            agent = Agent(user_id=demo.id, name="DemoAgent", elo=1000)
            session.add(agent)

            await session.commit()
            print("Demo user created: demo@botarena.com / demo1234 (1 agent)")
        else:
            print("Demo user already exists")

        # --- Test agents (alphabot / betabot) ---
        for t in TEST_AGENTS:
            existing_ta = (await session.execute(
                select(User).where(User.email == t["email"])
            )).scalar_one_or_none()
            if existing_ta:
                print(f"Test agent already exists: {t['username']}")
                continue
            ta_user = User(
                email=t["email"],
                username=t["username"],
                password_hash=hash_password(t["password"]),
                balance=5000,
                onboarding_completed=True,
            )
            session.add(ta_user)
            await session.flush()
            session.add(LedgerEntry(
                user_id=ta_user.id, type="initial_grant",
                amount=5000, balance_after=5000, description="Welcome bonus",
            ))
            session.add(Agent(user_id=ta_user.id, name=t["agent_name"], elo=1000))
            await session.commit()
            print(f"Test agent created: {t['username']} ({t['email']}) -- {t['agent_name']}")

        # --- Fictional users ---
        for u_data in FICTIONAL_USERS:
            username = u_data["username"]
            email = f"{username}@botarena.com"
            password = f"{username}1234"

            existing_user = (await session.execute(
                select(User).where(User.email == email)
            )).scalar_one_or_none()

            if existing_user:
                print(f"User already exists: {username}")
                continue

            user = User(
                email=email,
                username=username,
                password_hash=hash_password(password),
                balance=5000,
                onboarding_completed=True,
            )
            session.add(user)
            await session.flush()

            session.add(LedgerEntry(
                user_id=user.id, type="initial_grant",
                amount=5000, balance_after=5000,
                description="Welcome bonus",
            ))

            agent = Agent(
                user_id=user.id,
                name=u_data["agent_name"],
                elo=u_data["elo"],
            )
            session.add(agent)

            await session.commit()
            print(f"Created user: {username} ({email}) -- 1 agent: {u_data['agent_name']}")


if __name__ == "__main__":
    asyncio.run(seed())
