"""End-to-end integration test for the full game loop.

Tests the service/function level (not HTTP): creates users, agents, arenas,
joins queue, scheduler tick matches, plays hands via poll+action, verifies
wallet settlement and agent stats.
"""

import pytest
import pytest_asyncio

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from app.database import Base
from app.models import *  # noqa: F401, F403 — ensure all models registered
from app.models.user import User
from app.models.agent import Agent
from app.models.arena import Arena
from app.models.session import Session as GameSession
from app.models.ledger import LedgerEntry
from app.services.auth_service import hash_password
from app.services import agent_service, wallet_service
from app.services.table_manager import get_game_state, process_action, _active_hands, start_new_hand
from app.scheduler.tick import scheduler_tick


@pytest_asyncio.fixture
async def db():
    """Create an in-memory SQLite database with all tables."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async_session_factory = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session_factory() as session:
        yield session
    await engine.dispose()


async def _create_user(db: AsyncSession, email: str, username: str, balance: int = 5000) -> User:
    """Helper to create a user with ledger entry."""
    user = User(
        email=email,
        username=username,
        password_hash=hash_password("test1234"),
        balance=balance,
        onboarding_completed=True,
    )
    db.add(user)
    await db.flush()
    db.add(LedgerEntry(
        user_id=user.id,
        type="initial_grant",
        amount=balance,
        balance_after=balance,
        description="Welcome bonus",
    ))
    await db.commit()
    await db.refresh(user)
    return user


async def _create_agent(db: AsyncSession, user_id: str, name: str) -> Agent:
    """Helper to create an agent without hitting the settings-based limit check."""
    agent = Agent(user_id=user_id, name=name, status="idle", elo=1000)
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return agent


@pytest.mark.asyncio
async def test_full_game_session(db: AsyncSession):
    """Full integration: 2 users join arena -> scheduler matches -> play hands -> verify."""
    # --- Setup: arena + 2 users + 2 agents ---
    arena = Arena(name="Test", slug="test", buy_in=500, small_blind=5, big_blind=10)
    db.add(arena)
    await db.commit()
    await db.refresh(arena)

    user1 = await _create_user(db, "p1@test.com", "player1")
    user2 = await _create_user(db, "p2@test.com", "player2")

    agent1 = await _create_agent(db, user1.id, "Agent1")
    agent2 = await _create_agent(db, user2.id, "Agent2")

    # --- Join arena (create sessions manually to avoid HTTPException from wallet) ---
    from app.services import session_manager
    sess1 = await session_manager.create_session(db, user1.id, agent1.id, arena.id)
    sess2 = await session_manager.create_session(db, user2.id, agent2.id, arena.id)

    assert sess1.status == "queued"
    assert sess2.status == "queued"

    # Verify balance locked
    await db.refresh(user1)
    await db.refresh(user2)
    assert user1.balance == 4500  # 5000 - 500 buy-in
    assert user2.balance == 4500

    # --- Scheduler tick: match queue + start first hand ---
    _active_hands.clear()  # Reset for test isolation
    stats = await scheduler_tick(db)
    assert stats["matched"] == 1

    await db.refresh(agent1)
    await db.refresh(agent2)
    assert agent1.status == "playing"
    assert agent2.status == "playing"

    # --- Play hand(s) via polling loop ---
    async def _act(agent_id):
        """Poll game state and take an action if it's our turn."""
        state = await get_game_state(db, agent_id)
        if state and state.get("status") == "your_turn":
            gs = state.get("game_state", {})
            hand_id = gs.get("hand_id")
            amount_to_call = gs.get("current_bet", 0)
            if hand_id:
                action = "call" if amount_to_call > 0 else "check"
                return await process_action(db, agent_id, hand_id, action, 0)
        return state

    for _ in range(200):  # Safety limit
        await _act(agent1.id)
        await _act(agent2.id)

        # Check if at least one hand completed
        await db.refresh(sess1)
        await db.refresh(sess2)
        if sess1.hands_played > 0 and sess2.hands_played > 0:
            break

        # If hand_complete, try starting next hand via scheduler
        s1 = await get_game_state(db, agent1.id)
        s2 = await get_game_state(db, agent2.id)
        if s1.get("status") == "hand_complete" or s2.get("status") == "hand_complete":
            await scheduler_tick(db)

    # --- Verify at least one hand was played ---
    await db.refresh(sess1)
    await db.refresh(sess2)
    assert sess1.hands_played > 0, f"sess1.hands_played={sess1.hands_played}"
    assert sess2.hands_played > 0, f"sess2.hands_played={sess2.hands_played}"

    # Stacks should have changed (one wins, one loses)
    assert sess1.final_stack is not None
    assert sess2.final_stack is not None
    # Conservation: total stacks = total buy-ins (no rake)
    assert sess1.final_stack + sess2.final_stack == 1000  # 500 + 500

    # --- Leave: close sessions via process_leave ---
    from app.services.table_manager import process_leave
    leave_result = await process_leave(db, agent1.id)
    assert leave_result is not None
    assert "hands_played" in leave_result
    assert leave_result["hands_played"] >= 1

    # Agent should be idle after leaving
    await db.refresh(agent1)
    assert agent1.status == "idle"

    # Verify wallet settlement happened (ledger entries exist)
    ledger = (await db.execute(
        select(LedgerEntry).where(
            LedgerEntry.user_id == user1.id,
            LedgerEntry.type == "session_result",
        )
    )).scalars().all()
    assert len(ledger) >= 1, "Expected at least one session_result ledger entry"


@pytest.mark.asyncio
async def test_queue_cancel(db: AsyncSession):
    """Test that a queued agent can leave and get refunded."""
    arena = Arena(name="Cancel", slug="cancel", buy_in=200, small_blind=1, big_blind=2)
    db.add(arena)
    await db.commit()
    await db.refresh(arena)

    user = await _create_user(db, "cancel@test.com", "canceller")
    agent = await _create_agent(db, user.id, "CancelBot")

    from app.services import session_manager
    sess = await session_manager.create_session(db, user.id, agent.id, arena.id)
    assert sess.status == "queued"

    await db.refresh(user)
    assert user.balance == 4800  # 5000 - 200

    # Leave while queued
    from app.services.table_manager import process_leave
    result = await process_leave(db, agent.id)
    assert result is not None
    assert result["profit"] == 0

    # Agent back to idle
    await db.refresh(agent)
    assert agent.status == "idle"
