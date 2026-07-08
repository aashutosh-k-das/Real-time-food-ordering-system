import socket
import uuid
from collections.abc import AsyncIterator
from urllib.parse import urlparse

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings


settings = get_settings()


def _is_port_open(host: str, port: int, timeout: float = 0.25) -> bool:
    with socket.socket() as sock:
        sock.settimeout(timeout)
        try:
            sock.connect((host, port))
            return True
        except OSError:
            return False


def _resolve_database_url() -> tuple[str, bool]:
    database_url = settings.database_url
    if database_url.startswith("postgresql"):
        parsed = urlparse(database_url.replace("postgresql+asyncpg://", "postgres://", 1))
        host = parsed.hostname or "localhost"
        port = parsed.port or 5432
        if not _is_port_open(host, port):
            return ("sqlite+aiosqlite:///./food_ordering_demo.db", True)
    return (database_url, False)


database_url, USING_SQLITE_FALLBACK = _resolve_database_url()
engine = create_async_engine(database_url, future=True, echo=False)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_db_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


async def init_sqlite_demo_data() -> None:
    if not USING_SQLITE_FALLBACK:
        return

    from sqlalchemy import select

    from app.core.security import hash_password
    from app.models import DeliveryPartner, MenuItem, Order, OrderItem, OrderStatusEvent, Restaurant, User, UserRole

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as session:
        existing_users = (await session.execute(select(User.id).limit(1))).first()
        if existing_users is not None:
            return

        customer = User(
            id=uuid.UUID("8ca0465f-e154-4acd-9080-3b096b518f40"),
            email="customer@example.com",
            password_hash=hash_password("portfolio123"),
            full_name="Priya Sharma",
            role=UserRole.CUSTOMER,
        )
        restaurant_owner = User(
            id=uuid.UUID("5bb65318-736e-4316-95a6-43fcbc90d2c1"),
            email="restaurant@example.com",
            password_hash=hash_password("portfolio123"),
            full_name="Ankit Rao",
            role=UserRole.RESTAURANT,
        )
        courier_user = User(
            id=uuid.UUID("ef718518-cf6b-4c8d-96ea-e8f5bf14a08d"),
            email="delivery@example.com",
            password_hash=hash_password("portfolio123"),
            full_name="Ravi Kumar",
            role=UserRole.DELIVERY_PARTNER,
        )
        restaurant = Restaurant(
            id=uuid.UUID("f5f3a6c4-4daa-4cb0-a60c-8f56befd2ab6"),
            owner_user_id=restaurant_owner.id,
            name="Copper Kadhai",
            description="North Indian comfort food built for dispatch speed.",
            latitude=12.9719,
            longitude=77.6412,
        )
        menu_items = [
            MenuItem(
                id=uuid.UUID("d0857943-a875-4882-8d90-5cb9d92cb1e5"),
                restaurant_id=restaurant.id,
                name="Paneer Tikka Bowl",
                description="High-demand item for lock-contention demos.",
                price_minor=34900,
                currency="INR",
                available_inventory=5,
            ),
            MenuItem(
                id=uuid.UUID("0cf1e5ab-b64e-4eb8-8d34-dd8b4d4f6478"),
                restaurant_id=restaurant.id,
                name="Garlic Naan Set",
                description="Fast-prep side with smaller inventory.",
                price_minor=12900,
                currency="INR",
                available_inventory=8,
            ),
            MenuItem(
                id=uuid.UUID("6eb26eaf-7e24-42d9-9a60-6799435bda25"),
                restaurant_id=restaurant.id,
                name="Dal Makhani",
                description="Slow-cooked signature item.",
                price_minor=25900,
                currency="INR",
                available_inventory=6,
            ),
        ]
        delivery_partner = DeliveryPartner(
            id=uuid.UUID("a7352b33-cc82-497f-923c-e9b4c767d86d"),
            user_id=courier_user.id,
            vehicle_type="scooter",
            is_available=True,
            current_latitude=12.9756,
            current_longitude=77.6387,
        )
        session.add_all([customer, restaurant_owner, courier_user, restaurant, *menu_items, delivery_partner])
        await session.commit()
