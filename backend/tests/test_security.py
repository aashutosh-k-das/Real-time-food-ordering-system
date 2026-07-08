import uuid

from app.core.security import create_access_token, decode_token, hash_password, verify_password
from app.models import User, UserRole


def test_password_hash_round_trip() -> None:
    password_hash = hash_password("portfolio123")
    assert verify_password("portfolio123", password_hash) is True
    assert verify_password("wrong-password", password_hash) is False


def test_access_token_round_trip() -> None:
    user = User(
        id=uuid.uuid4(),
        email="customer@example.com",
        password_hash="unused",
        full_name="Priya Sharma",
        role=UserRole.CUSTOMER,
    )
    token = create_access_token(user)
    payload = decode_token(token)
    assert payload.sub == user.id
    assert payload.email == user.email
    assert payload.role == user.role
