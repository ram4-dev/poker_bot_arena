import re
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.auth import (
    RegisterRequest, LoginRequest, RefreshRequest,
    TokenResponse, UserResponse,
)
from app.services import auth_service

router = APIRouter()


def _derive_username(email: str) -> str:
    """Generate a safe username from email prefix."""
    base = re.sub(r'[^a-zA-Z0-9_-]', '_', email.split('@')[0])[:30]
    return base or "operator"


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(req: RegisterRequest, request: Request, session: AsyncSession = Depends(get_session)):
    ip = request.client.host if request.client else None
    username = req.username or _derive_username(req.email)
    user, access, refresh = await auth_service.register(session, req.email, username, req.password, ip)
    return TokenResponse(access_token=access, refresh_token=refresh, user=UserResponse.model_validate(user))


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, session: AsyncSession = Depends(get_session)):
    user, access, refresh = await auth_service.login(session, req.email, req.password)
    return TokenResponse(access_token=access, refresh_token=refresh, user=UserResponse.model_validate(user))


@router.post("/refresh")
async def refresh(req: RefreshRequest, session: AsyncSession = Depends(get_session)):
    access, refresh = await auth_service.refresh_tokens(session, req.refresh_token)
    return {"access_token": access, "refresh_token": refresh, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return UserResponse.model_validate(user)
