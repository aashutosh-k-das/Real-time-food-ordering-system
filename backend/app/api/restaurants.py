import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db_session
from app.models import Restaurant
from app.schemas.restaurant import MenuItemSummary, RestaurantSummary
from app.services.menu_cache import fetch_and_cache_menu, get_cached_menu


router = APIRouter(prefix="/restaurants", tags=["restaurants"])


@router.get("", response_model=list[RestaurantSummary])
async def list_restaurants(session: AsyncSession = Depends(get_db_session)) -> list[RestaurantSummary]:
    restaurants = (await session.execute(select(Restaurant).where(Restaurant.is_active.is_(True)))).scalars().all()
    return [RestaurantSummary(id=item.id, name=item.name, description=item.description) for item in restaurants]


@router.get("/{restaurant_id}/menu", response_model=list[MenuItemSummary])
async def list_menu_items(
    restaurant_id: uuid.UUID,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> list[MenuItemSummary]:
    restaurant = await session.get(Restaurant, restaurant_id)
    if restaurant is None:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    cached = await get_cached_menu(request.app.state.redis, restaurant_id)
    if cached is not None:
        return cached
    return await fetch_and_cache_menu(session, request.app.state.redis, restaurant_id)
