from pydantic import BaseModel
from datetime import datetime


class WalletResponse(BaseModel):
    balance: int
    locked_balance: int
    total: int
    can_rescue: bool = False


class LedgerEntryResponse(BaseModel):
    id: str
    type: str
    amount: int
    balance_after: int
    reference_id: str | None
    description: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedLedgerResponse(BaseModel):
    items: list[LedgerEntryResponse]
    total: int
    limit: int
    offset: int


class RescueResponse(BaseModel):
    balance: int
    ledger_entry: LedgerEntryResponse
