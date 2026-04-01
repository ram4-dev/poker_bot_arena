from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.scheduler.tick import scheduler_tick

router = APIRouter()


@router.post("/tick")
async def trigger_tick(session: AsyncSession = Depends(get_session)):
    result = await scheduler_tick(session)
    return result
