import json
import uuid

from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import MenuItem, Restaurant
from app.schemas.restaurant import MenuItemSummary


def menu_cache_key(restaurant_id: uuid.UUID) -> str:
    return f"restaurant:{restaurant_id}:menu"


async def get_cached_menu(redis: Redis | None, restaurant_id: uuid.UUID) -> list[MenuItemSummary] | None:
    if redis is None:
        return None
    payload = await redis.get(menu_cache_key(restaurant_id))
    if payload is None:
        return None
    return [MenuItemSummary.model_validate(item) for item in json.loads(payload)]


async def fetch_and_cache_menu(
    session: AsyncSession,
    redis: Redis | None,
    restaurant_id: uuid.UUID,
) -> list[MenuItemSummary]:
    restaurant = await session.get(Restaurant, restaurant_id)
    if restaurant is None:
        return []
    items = (
        await session.execute(select(MenuItem).where(MenuItem.restaurant_id == restaurant_id).order_by(MenuItem.name))
    ).scalars().all()
    summaries = [
        MenuItemSummary(
            id=item.id,
            name=item.name,
            description=item.description,
            price_minor=item.price_minor,
            currency=item.currency,
            available_inventory=item.available_inventory,
            is_available=item.is_available,
        )
        for item in items
    ]
    if redis is not None:
        await redis.set(menu_cache_key(restaurant_id), json.dumps([item.model_dump(mode="json") for item in summaries]), ex=120)
    return summaries


async def invalidate_menu_cache(redis: Redis | None, restaurant_id: uuid.UUID) -> None:
    if redis is not None:
        await redis.delete(menu_cache_key(restaurant_id))
