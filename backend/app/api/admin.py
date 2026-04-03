from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.api.deps import require_admin_user
from app.scheduler.tick import scheduler_tick

router = APIRouter()


@router.post("/tick")
async def trigger_tick(
    session: AsyncSession = Depends(get_session),
    _admin=Depends(require_admin_user),
):
    result = await scheduler_tick(session)
    return result
