from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.core.security import build_auth_response, verify_password
from app.db import get_db_session
from app.models import User
from app.schemas.auth import AuthTokenResponse, LoginRequest, TokenPayload, UserProfile


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=AuthTokenResponse)
async def login(payload: LoginRequest, session: AsyncSession = Depends(get_db_session)) -> AuthTokenResponse:
    user = (await session.execute(select(User).where(User.email == payload.email))).scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return build_auth_response(user)


@router.get("/me", response_model=UserProfile)
async def me(current_user: TokenPayload = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> UserProfile:
    user = await session.get(User, current_user.sub)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserProfile(id=user.id, email=user.email, full_name=user.full_name, role=user.role)
