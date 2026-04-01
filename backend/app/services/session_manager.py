import json
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.bot import Bot, BotVersion
from app.models.table import Table
from app.models.session import Session as GameSession
from app.models.hand import Hand, HandEvent as HandEventModel
from app.engine.types import BotConfig
from app.engine.runner import run_session
from app.services import wallet_service, elo_service, bot_service


async def execute_hands(session: AsyncSession, table: Table, count: int) -> int:
    """Execute `count` hands on a table. Returns number of hands executed."""
    sess1 = (await session.execute(
        select(GameSession).where(GameSession.id == table.seat_1_session_id)
    )).scalar_one_or_none()
    sess2 = (await session.execute(
        select(GameSession).where(GameSession.id == table.seat_2_session_id)
    )).scalar_one_or_none()

    if not sess1 or not sess2:
        return 0

    # If one session already completed, close the other and table
    if sess1.status == "completed" or sess2.status == "completed":
        from app.models.arena import Arena as ArenaModel
        arena_obj = (await session.execute(select(ArenaModel).where(ArenaModel.id == table.arena_id))).scalar_one()
        if sess1.status == "playing":
            await close_session(session, sess1, "opponent_exit", arena_obj)
        if sess2.status == "playing":
            await close_session(session, sess2, "opponent_exit", arena_obj)
        table.status = "completed"
        from datetime import datetime, timezone
        table.completed_at = datetime.now(timezone.utc)
        await session.commit()
        return 0

    if sess1.status != "playing" or sess2.status != "playing":
        return 0

    # Load bot configs
    ver1 = (await session.execute(select(BotVersion).where(BotVersion.id == sess1.bot_version_id))).scalar_one()
    ver2 = (await session.execute(select(BotVersion).where(BotVersion.id == sess2.bot_version_id))).scalar_one()

    from app.models.arena import Arena
    arena = (await session.execute(select(Arena).where(Arena.id == table.arena_id))).scalar_one()

    config1 = BotConfig(**ver1.config_json)
    config2 = BotConfig(**ver2.config_json)

    # Current stacks
    stack1 = sess1.initial_stack if sess1.hands_played == 0 else _get_last_stack(sess1, table, 1)
    stack2 = sess2.initial_stack if sess2.hands_played == 0 else _get_last_stack(sess2, table, 2)

    # For practice arenas (buy_in=0), use initial_stack as effective starting stack
    effective_buy_in = arena.buy_in if arena.buy_in > 0 else sess1.initial_stack

    # Run hands via engine (synchronous, in thread pool would be better but OK for MVP)
    import asyncio
    result = await asyncio.to_thread(
        run_session, config1, config2, effective_buy_in, arena.small_blind, arena.big_blind, max_hands=count
    )

    # Persist results
    hands_executed = 0
    for hr in result.hand_results:
        hand = Hand(
            table_id=table.id,
            session_1_id=sess1.id,
            session_2_id=sess2.id,
            hand_number=sess1.hands_played + hr.hand_number,
            winner_session_id=sess1.id if hr.winner == "player_1" else (sess2.id if hr.winner == "player_2" else None),
            pot=hr.pot,
            community_cards=json.dumps(hr.community_cards) if hr.community_cards else None,
            player_1_hole=json.dumps(hr.player_1_hole) if hr.player_1_hole else None,
            player_2_hole=json.dumps(hr.player_2_hole) if hr.player_2_hole else None,
            player_1_stack_after=hr.player_1_stack,
            player_2_stack_after=hr.player_2_stack,
            winning_hand_rank=hr.winning_hand_rank,
        )
        session.add(hand)
        await session.flush()

        for seq, event in enumerate(hr.events):
            he = HandEventModel(
                hand_id=hand.id,
                sequence=seq,
                street=event.street,
                player_seat=1 if event.player == "player_1" else 2,
                action=event.action,
                amount=event.amount,
                pot_after=event.pot_after,
                hand_strength=event.hand_strength if event.hand_strength else None,
                hole_cards=",".join(event.hole_cards) if event.hole_cards else None,
            )
            session.add(he)

        if hr.winner == "player_1":
            sess1.hands_won += 1
        elif hr.winner == "player_2":
            sess2.hands_won += 1

        hands_executed += 1

    # Update session stats
    sess1.hands_played += hands_executed
    sess2.hands_played += hands_executed
    table.hands_played += hands_executed

    # Update stacks from final hand
    if result.hand_results:
        last = result.hand_results[-1]
        sess1.final_stack = last.player_1_stack
        sess2.final_stack = last.player_2_stack

    await session.commit()

    # Check exit conditions
    await _check_exits(session, table, sess1, sess2, config1, config2, arena)

    return hands_executed


def _get_last_stack(sess: GameSession, table: Table, seat: int) -> int:
    return sess.final_stack if sess.final_stack is not None else sess.initial_stack


async def _check_exits(session: AsyncSession, table, sess1, sess2, config1, config2, arena):
    exit1 = _evaluate_exit(sess1, config1, arena.buy_in)
    exit2 = _evaluate_exit(sess2, config2, arena.buy_in)

    if exit1:
        await close_session(session, sess1, exit1, arena)
        # Close opponent too if they're still playing (game ends when one exits)
        if not exit2 and sess2.status == "playing":
            await close_session(session, sess2, "opponent_exit", arena)
    if exit2:
        await close_session(session, sess2, exit2, arena)
        # Close opponent too if they're still playing
        if not exit1 and sess1.status == "playing":
            await close_session(session, sess1, "opponent_exit", arena)

    # If both seats empty, close table
    await session.refresh(table)
    s1 = (await session.execute(select(GameSession).where(GameSession.id == table.seat_1_session_id))).scalar_one_or_none()
    s2 = (await session.execute(select(GameSession).where(GameSession.id == table.seat_2_session_id))).scalar_one_or_none()

    s1_done = not s1 or s1.status == "completed"
    s2_done = not s2 or s2.status == "completed"

    if s1_done and s2_done:
        table.status = "completed"
        table.completed_at = datetime.now(timezone.utc)
        await session.commit()


def _evaluate_exit(sess: GameSession, config: BotConfig, buy_in: int) -> str | None:
    if sess.status != "playing":
        return None

    stack = sess.final_stack if sess.final_stack is not None else sess.initial_stack

    if stack <= 0:
        return "stack_zero"

    if sess.hands_played >= config.min_hands_before_leave:
        if buy_in > 0 and stack >= buy_in * config.leave_threshold_up:
            return "threshold_up"
        if buy_in > 0 and stack <= buy_in * config.leave_threshold_down:
            return "threshold_down"

    if sess.hands_played >= config.session_max_hands:
        return "max_hands"

    return None


async def close_session(session: AsyncSession, sess: GameSession, exit_reason: str, arena):
    sess.status = "completed"
    sess.exit_reason = exit_reason
    sess.completed_at = datetime.now(timezone.utc)

    final_stack = sess.final_stack if sess.final_stack is not None else sess.initial_stack

    # Settle wallet
    await wallet_service.settle_session(
        session, sess.user_id, sess.buy_in, final_stack, sess.id,
        reward_multiplier=arena.reward_multiplier,
    )

    # Update ELO
    if sess.opponent_session_id:
        opp = (await session.execute(
            select(GameSession).where(GameSession.id == sess.opponent_session_id)
        )).scalar_one_or_none()
        if opp:
            await elo_service.update_elo(session, sess, opp)

    # Update bot stats
    won = (final_stack or 0) > sess.buy_in
    profit = (final_stack or 0) - sess.buy_in
    await bot_service.update_bot_stats(session, sess.bot_id, sess.bot_version_id, won, sess.hands_played, profit)

    # Reset bot status
    bot = (await session.execute(select(Bot).where(Bot.id == sess.bot_id))).scalar_one()
    bot.status = "idle"

    await session.commit()
