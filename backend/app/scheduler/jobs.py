import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import get_settings
from app.database import async_session
from app.scheduler.tick import scheduler_tick

logger = logging.getLogger(__name__)
settings = get_settings()


async def _tick_job():
    try:
        async with async_session() as session:
            result = await scheduler_tick(session)
            if result["matched"] > 0 or result["hands_executed"] > 0:
                logger.info(f"Tick: matched={result['matched']}, hands={result['hands_executed']}")
    except Exception as e:
        logger.error(f"Scheduler tick error: {e}")


def start_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler()
    scheduler.add_job(_tick_job, "interval", seconds=settings.SCHEDULER_INTERVAL_SECONDS, id="main_tick")
    scheduler.start()
    logger.info(f"Scheduler started (interval={settings.SCHEDULER_INTERVAL_SECONDS}s)")
    return scheduler


def stop_scheduler(scheduler: AsyncIOScheduler):
    scheduler.shutdown(wait=False)
    logger.info("Scheduler stopped")
