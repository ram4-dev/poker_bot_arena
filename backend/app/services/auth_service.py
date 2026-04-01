import hashlib
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from jose import jwt
from passlib.context import CryptContext
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.config import get_settings
from app.models.user import User, RefreshToken

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": user_id, "exp": expire, "type": "access"}, settings.SECRET_KEY, algorithm="HS256")


def create_refresh_token_value() -> str:
    return str(uuid4())


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def register(
    session: AsyncSession, email: str, username: str, password: str, ip: str | None = None
) -> tuple[User, str, str]:
    # Check email uniqueness
    existing = await session.execute(select(User).where(User.email == email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Email already registered")

    # Check username uniqueness
    existing = await session.execute(select(User).where(User.username == username))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Username already taken")

    # Check multi-account (IP flag)
    is_flagged = False
    if ip:
        day_ago = datetime.now(timezone.utc) - timedelta(hours=24)
        result = await session.execute(
            select(func.count()).select_from(User).where(User.registration_ip == ip, User.created_at > day_ago)
        )
        if result.scalar() >= 2:
            is_flagged = True

    user = User(
        email=email.lower(),
        username=username,
        password_hash=hash_password(password),
        balance=settings.INITIAL_BALANCE,
        registration_ip=ip,
        is_flagged=is_flagged,
    )
    session.add(user)
    await session.flush()

    # Create initial grant ledger entry
    from app.models.ledger import LedgerEntry
    entry = LedgerEntry(
        user_id=user.id,
        type="initial_grant",
        amount=settings.INITIAL_BALANCE,
        balance_after=settings.INITIAL_BALANCE,
        description="Welcome bonus",
    )
    session.add(entry)

    # Generate tokens
    access_token = create_access_token(user.id)
    refresh_value = create_refresh_token_value()

    rt = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(refresh_value),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    session.add(rt)
    await session.commit()
    await session.refresh(user)

    return user, access_token, refresh_value


async def login(session: AsyncSession, email: str, password: str) -> tuple[User, str, str]:
    result = await session.execute(select(User).where(User.email == email.lower()))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")

    access_token = create_access_token(user.id)
    refresh_value = create_refresh_token_value()

    rt = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(refresh_value),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    session.add(rt)
    await session.commit()

    return user, access_token, refresh_value


async def refresh_tokens(session: AsyncSession, refresh_token: str) -> tuple[str, str]:
    token_hash = hash_token(refresh_token)
    result = await session.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
    )
    rt = result.scalar_one_or_none()
    if not rt:
        raise HTTPException(401, "Invalid or expired refresh token")

    # Rotate: delete old, create new
    await session.delete(rt)

    new_access = create_access_token(rt.user_id)
    new_refresh_value = create_refresh_token_value()
    new_rt = RefreshToken(
        user_id=rt.user_id,
        token_hash=hash_token(new_refresh_value),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    session.add(new_rt)
    await session.commit()

    return new_access, new_refresh_value
