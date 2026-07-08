import base64
import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

import jwt

from app.core.config import get_settings
from app.models import User
from app.schemas.auth import AuthTokenResponse, TokenPayload, UserProfile


PBKDF2_PREFIX = "pbkdf2_sha256"
PBKDF2_ITERATIONS = 390000


def hash_password(password: str) -> str:
    salt = secrets.token_urlsafe(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), PBKDF2_ITERATIONS)
    encoded = base64.urlsafe_b64encode(digest).decode("utf-8")
    return f"{PBKDF2_PREFIX}${PBKDF2_ITERATIONS}${salt}${encoded}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations_raw, salt, encoded = password_hash.split("$", 3)
    except ValueError:
        return False
    if algorithm != PBKDF2_PREFIX:
        return False
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), int(iterations_raw))
    candidate = base64.urlsafe_b64encode(digest).decode("utf-8")
    return hmac.compare_digest(candidate, encoded)


def create_access_token(user: User) -> str:
    settings = get_settings()
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role.value,
        "exp": datetime.now(UTC) + timedelta(hours=8),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> TokenPayload:
    settings = get_settings()
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    return TokenPayload.model_validate(payload)


def build_auth_response(user: User) -> AuthTokenResponse:
    return AuthTokenResponse(
        access_token=create_access_token(user),
        token_type="bearer",
        user=UserProfile(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
        ),
    )
