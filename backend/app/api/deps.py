from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_session
from app.models.user import User

settings = get_settings()
security = HTTPBearer()
security_optional = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: AsyncSession = Depends(get_session),
) -> User:
    try:
        payload = jwt.decode(credentials.credentials, settings.SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("sub")
        token_type = payload.get("type")
        if not user_id or token_type != "access":
            raise HTTPException(401, "Invalid token")
    except JWTError:
        raise HTTPException(401, "Invalid token")

    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(401, "User not found")
    return user


async def get_optional_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_optional),
    session: AsyncSession = Depends(get_session),
) -> User | None:
    """Return authenticated user if a valid token is present, else None."""
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, settings.SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("sub")
        token_type = payload.get("type")
        if not user_id or token_type != "access":
            return None
    except JWTError:
        return None

    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def require_admin_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security_optional),
    session: AsyncSession = Depends(get_session),
) -> User | None:
    """Require admin access via authenticated admin user or ADMIN_API_KEY header.

    Returns the admin User if authenticated, or None for API-key-only access.
    Raises 401/403 on failure.
    """
    # Strategy 1: ADMIN_API_KEY header
    if settings.ADMIN_API_KEY:
        api_key = request.headers.get("X-Admin-Key")
        if api_key and api_key == settings.ADMIN_API_KEY:
            return None  # API-key-authenticated, no user object needed

    # Strategy 2: Authenticated user with is_admin flag
    if credentials:
        try:
            payload = jwt.decode(credentials.credentials, settings.SECRET_KEY, algorithms=["HS256"])
            user_id = payload.get("sub")
            token_type = payload.get("type")
            if user_id and token_type == "access":
                result = await session.execute(select(User).where(User.id == user_id))
                user = result.scalar_one_or_none()
                if user and getattr(user, "is_admin", False):
                    return user
                if user:
                    raise HTTPException(403, "Admin privileges required")
        except JWTError:
            pass

    raise HTTPException(401, "Admin authentication required")
