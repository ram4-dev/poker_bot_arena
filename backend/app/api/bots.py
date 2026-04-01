from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.bot import (
    CreateBotRequest, UpdateBotRequest, CreateVersionRequest,
    BotResponse, BotVersionResponse,
)
from app.services import bot_service

router = APIRouter()


@router.get("")
async def list_bots(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    bots = await bot_service.get_bots(session, user.id)
    total_xp = sum(b.total_wins * 100 for b in bots)  # Simplified XP calc
    deployed = sum(1 for b in bots if b.status != "idle")
    return {
        "bots": [BotResponse.from_model(b) for b in bots],
        "stats": {"total_bots": len(bots), "total_deployed": deployed, "total_xp": total_xp},
    }


@router.post("", status_code=201)
async def create_bot(
    req: CreateBotRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    bot = await bot_service.create_bot(session, user.id, req.name, req.description, req.avatar, req.preset)
    return BotResponse.from_model(bot)


@router.get("/{bot_id}")
async def get_bot(bot_id: str, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    bot = await bot_service.get_bot(session, user.id, bot_id)
    return BotResponse.from_model(bot)


@router.put("/{bot_id}")
async def update_bot(
    bot_id: str, req: UpdateBotRequest,
    user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session),
):
    bot = await bot_service.update_bot(session, user.id, bot_id, req.name, req.description, req.avatar)
    return BotResponse.from_model(bot)


@router.post("/{bot_id}/versions", status_code=201)
async def create_version(
    bot_id: str, req: CreateVersionRequest,
    user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session),
):
    version = await bot_service.create_version(session, user.id, bot_id, req.config.model_dump())
    return BotVersionResponse.from_model(version)


@router.get("/{bot_id}/versions")
async def list_versions(
    bot_id: str, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session),
):
    versions = await bot_service.get_versions(session, user.id, bot_id)
    return {"versions": [BotVersionResponse.from_model(v) for v in versions]}


@router.get("/{bot_id}/versions/compare")
async def compare_versions(
    bot_id: str,
    v1: int = Query(...), v2: int = Query(...),
    user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session),
):
    return await bot_service.compare_versions(session, user.id, bot_id, v1, v2)
