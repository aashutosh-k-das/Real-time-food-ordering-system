import uuid

from pydantic import BaseModel, EmailStr, Field

from app.models import UserRole


class TokenPayload(BaseModel):
    sub: uuid.UUID
    email: EmailStr
    role: UserRole


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserProfile(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str
    role: UserRole


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserProfile
