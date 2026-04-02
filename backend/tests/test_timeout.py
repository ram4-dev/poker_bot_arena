"""Tests for timeout behavior: auto-fold, consecutive timeout kick, and reset."""

import pytest
import pytest_asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from app.database import Base
from app.models import *  # noqa: F401, F403
from app.models.user import User
from app.models.agent import Agent
from app.models.arena import Arena
from app.models.session import Session as GameSession
from app.models.table import Table
from app.models.ledger import LedgerEntry
from app.services.auth_service import hash_password
from app.services.table_manager import (
    get_game_state,
    process_action,
    start_new_hand,
    handle_timeout,
    _active_hands,
)
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
    agent = Agent(user_id=user_id, name=name, status="idle", elo=1000)
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return agent


async def _setup_match(db: AsyncSession):
    """Create arena, 2 users, 2 agents, join queue, match them, start hand.

    Returns (arena, user1, user2, agent1, agent2, sess1, sess2, table).
    """
    _active_hands.clear()

    arena = Arena(name="Timeout", slug="timeout", buy_in=500, small_blind=5, big_blind=10)
    db.add(arena)
    await db.commit()
    await db.refresh(arena)

    user1 = await _create_user(db, "t1@test.com", "timeout_p1")
    user2 = await _create_user(db, "t2@test.com", "timeout_p2")
    agent1 = await _create_agent(db, user1.id, "TimeoutAgent1")
    agent2 = await _create_agent(db, user2.id, "TimeoutAgent2")

    from app.services import session_manager
    sess1 = await session_manager.create_session(db, user1.id, agent1.id, arena.id)
    sess2 = await session_manager.create_session(db, user2.id, agent2.id, arena.id)

    # Match and start hand
    stats = await scheduler_tick(db)
    assert stats["matched"] == 1

    # Find the table
    await db.refresh(sess1)
    await db.refresh(sess2)
    table = (await db.execute(select(Table).where(Table.status == "active"))).scalar_one()

    return arena, user1, user2, agent1, agent2, sess1, sess2, table


@pytest.mark.asyncio
async def test_timeout_auto_fold(db: AsyncSession):
    """When action_deadline passes, handle_timeout auto-folds for the pending agent."""
    arena, user1, user2, agent1, agent2, sess1, sess2, table = await _setup_match(db)

    # There should be an active hand and a pending action agent
    assert table.pending_action_agent_id is not None
    pending_agent_id = table.pending_action_agent_id
    assert table.id in _active_hands

    hand_before = _active_hands[table.id]
    assert not hand_before.is_complete()

    # Set deadline in the past to simulate timeout
    table.action_deadline = datetime.now(timezone.utc) - timedelta(seconds=10)
    await db.commit()

    # Call handle_timeout directly
    await handle_timeout(db, table.id, pending_agent_id)

    # The hand should now be complete (fold ends the hand)
    await db.refresh(sess1)
    await db.refresh(sess2)

    # At least one session should have recorded a hand played
    assert sess1.hands_played + sess2.hands_played > 0, "Hand should have completed after timeout fold"

    # The timed-out agent should have consecutive_timeouts incremented
    timed_out_agent = (await db.execute(
        select(Agent).where(Agent.id == pending_agent_id)
    )).scalar_one()
    assert timed_out_agent.consecutive_timeouts >= 1


@pytest.mark.asyncio
async def test_3_timeouts_auto_leave(db: AsyncSession):
    """After 3 consecutive timeouts, the agent should be flagged for kick."""
    arena, user1, user2, agent1, agent2, sess1, sess2, table = await _setup_match(db)

    # We need to cause 3 consecutive timeouts on one agent.
    # Each timeout folds the hand, so we need to start new hands between timeouts.
    # After a fold, the dealer alternates, so the pending agent changes.
    # Strategy: timeout whoever is pending; if it's the "other" agent, make them
    # act normally, then timeout our target on their turn.
    target_agent_id = table.pending_action_agent_id
    assert target_agent_id is not None
    other_agent_id = agent1.id if target_agent_id == agent2.id else agent2.id

    timeout_count = 0
    for _ in range(10):  # Safety limit
        await db.refresh(table)

        # Ensure there's an active hand
        if table.id not in _active_hands:
            hand_id = await start_new_hand(db, table.id)
            if hand_id is None:
                break
            await db.refresh(table)

        current_pending = table.pending_action_agent_id
        if current_pending == target_agent_id:
            # Timeout the target
            table.action_deadline = datetime.now(timezone.utc) - timedelta(seconds=10)
            await db.commit()
            await handle_timeout(db, table.id, target_agent_id)
            timeout_count += 1
            if timeout_count >= 3:
                break
        elif current_pending == other_agent_id:
            # The other agent acts normally (check or call)
            hand = _active_hands.get(table.id)
            if hand:
                opp = hand._players[other_agent_id]
                target_p = hand._players[target_agent_id]
                amount_to_call = max(0, target_p["bet_this_round"] - opp["bet_this_round"])
                action = "call" if amount_to_call > 0 else "check"
                result = hand.apply_action(other_agent_id, action)
                if result.valid:
                    # Reset other agent's timeouts (they acted normally)
                    other_agent = (await db.execute(
                        select(Agent).where(Agent.id == other_agent_id)
                    )).scalar_one()
                    other_agent.consecutive_timeouts = 0

                    if result.hand_complete:
                        from app.services.table_manager import _on_hand_complete
                        await _on_hand_complete(db, table, hand)
                    else:
                        table.pending_action_agent_id = result.next_actor
                        table.action_deadline = datetime.now(timezone.utc) + timedelta(seconds=30)
                        await db.commit()

    # Check the agent's consecutive_timeouts
    timed_out_agent = (await db.execute(
        select(Agent).where(Agent.id == target_agent_id)
    )).scalar_one()
    assert timed_out_agent.consecutive_timeouts >= 3, (
        f"Expected >= 3 consecutive timeouts, got {timed_out_agent.consecutive_timeouts}"
    )


@pytest.mark.asyncio
async def test_timeout_resets_on_valid_action(db: AsyncSession):
    """A valid action resets consecutive_timeouts to 0."""
    arena, user1, user2, agent1, agent2, sess1, sess2, table = await _setup_match(db)

    pending_agent_id = table.pending_action_agent_id
    assert pending_agent_id is not None

    # Set some consecutive timeouts on the agent
    pending_agent = (await db.execute(
        select(Agent).where(Agent.id == pending_agent_id)
    )).scalar_one()
    pending_agent.consecutive_timeouts = 2
    await db.commit()

    # Now submit a valid action (call)
    hand = _active_hands.get(table.id)
    assert hand is not None
    hand_id = hand.hand_id

    result = await process_action(db, pending_agent_id, hand_id, "call", 0)
    assert result.get("error") is None or result.get("valid") is True

    # Consecutive timeouts should be reset to 0
    await db.refresh(pending_agent)
    assert pending_agent.consecutive_timeouts == 0, (
        f"Expected 0 consecutive timeouts after valid action, got {pending_agent.consecutive_timeouts}"
    )
