from fastapi import APIRouter, Depends, Request
import uuid
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db import get_db_session
from app.schemas.auth import TokenPayload
from app.schemas.order import (
    OrderCreateRequest,
    OrderResponse,
    OrderStatusEventResponse,
    OrderStatusUpdateRequest,
    OrderSummaryResponse,
)
from app.services.orders import (
    create_order,
    get_order_for_user,
    list_order_events_for_user,
    list_orders_for_user,
    update_order_status,
)
from app.websocket.dependencies import get_order_broadcaster
from app.websocket.manager import RedisOrderBroadcaster


router = APIRouter(prefix="/orders", tags=["orders"])


@router.get("", response_model=list[OrderSummaryResponse])
async def list_orders(
    current_user: TokenPayload = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[OrderSummaryResponse]:
    return await list_orders_for_user(session=session, current_user=current_user)


@router.post("", response_model=OrderResponse, status_code=201)
async def place_order(
    payload: OrderCreateRequest,
    request: Request,
    current_user: TokenPayload = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    broadcaster: RedisOrderBroadcaster = Depends(get_order_broadcaster),
) -> OrderResponse:
    return await create_order(
        session=session,
        current_user=current_user,
        payload=payload,
        broadcaster=broadcaster,
        redis=request.app.state.redis,
    )


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: uuid.UUID,
    current_user: TokenPayload = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> OrderResponse:
    return await get_order_for_user(session=session, current_user=current_user, order_id=order_id)


@router.get("/{order_id}/events", response_model=list[OrderStatusEventResponse])
async def get_order_events(
    order_id: uuid.UUID,
    current_user: TokenPayload = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[OrderStatusEventResponse]:
    return await list_order_events_for_user(session=session, current_user=current_user, order_id=order_id)


@router.patch("/{order_id}/status", response_model=OrderResponse)
async def patch_order_status(
    order_id: uuid.UUID,
    payload: OrderStatusUpdateRequest,
    current_user: TokenPayload = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    broadcaster: RedisOrderBroadcaster = Depends(get_order_broadcaster),
) -> OrderResponse:
    return await update_order_status(
        session=session,
        current_user=current_user,
        order_id=order_id,
        payload=payload,
        broadcaster=broadcaster,
    )
