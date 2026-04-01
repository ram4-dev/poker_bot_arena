from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.wallet import WalletResponse, LedgerEntryResponse, PaginatedLedgerResponse, RescueResponse
from app.services import wallet_service

router = APIRouter()


@router.get("", response_model=WalletResponse)
async def get_wallet(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    return await wallet_service.get_balance(session, user.id)


@router.get("/ledger")
async def get_ledger(
    type: str | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    items, total = await wallet_service.get_ledger(session, user.id, type, limit, offset)
    return PaginatedLedgerResponse(
        items=[LedgerEntryResponse.model_validate(e) for e in items],
        total=total, limit=limit, offset=offset,
    )


@router.post("/rescue")
async def rescue(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    entry = await wallet_service.daily_rescue(session, user.id)
    return RescueResponse(
        balance=user.balance,
        ledger_entry=LedgerEntryResponse.model_validate(entry),
    )
