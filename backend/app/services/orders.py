import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from redis.asyncio import Redis
from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import DeliveryPartner, MenuItem, Order, OrderItem, OrderStatus, OrderStatusEvent, Restaurant
from app.schemas.auth import TokenPayload
from app.schemas.order import (
    OrderCreateRequest,
    OrderResponse,
    OrderStatusEventResponse,
    OrderStatusMessage,
    OrderStatusUpdateRequest,
    OrderSummaryResponse,
)
from app.services.delivery import assign_nearest_partner
from app.services.menu_cache import invalidate_menu_cache
from app.services.order_state import apply_transition_timestamps, assert_transition_allowed, status_message
from app.websocket.manager import RedisOrderBroadcaster


DELIVERY_FEE_MINOR = 499


def serialize_order(order: Order, eta_minutes: int | None = None) -> OrderResponse:
    return OrderResponse(
        id=order.id,
        restaurant_id=order.restaurant_id,
        customer_id=order.customer_id,
        status=order.status,
        subtotal_minor=order.subtotal_minor,
        delivery_fee_minor=order.delivery_fee_minor,
        total_minor=order.total_minor,
        delivery_partner_id=order.delivery_partner_id,
        eta_minutes=eta_minutes,
        created_at=order.created_at,
        items=[
            {
                "menu_item_id": item.menu_item_id,
                "menu_item_name": item.menu_item_name,
                "quantity": item.quantity,
                "unit_price_minor": item.unit_price_minor,
                "line_total_minor": item.line_total_minor,
            }
            for item in order.items
        ],
    )


def serialize_order_summary(order: Order) -> OrderSummaryResponse:
    return OrderSummaryResponse(
        id=order.id,
        restaurant_id=order.restaurant_id,
        customer_id=order.customer_id,
        delivery_partner_id=order.delivery_partner_id,
        status=order.status,
        total_minor=order.total_minor,
        delivery_address=order.delivery_address,
        created_at=order.created_at,
    )


async def ensure_order_access(session: AsyncSession, current_user: TokenPayload, order: Order) -> None:
    if current_user.role.value == "customer" and order.customer_id == current_user.sub:
        return
    if current_user.role.value == "delivery_partner":
        partner = (
            await session.execute(select(DeliveryPartner).where(DeliveryPartner.user_id == current_user.sub))
        ).scalar_one_or_none()
        if partner and order.delivery_partner_id == partner.id:
            return
    if current_user.role.value == "restaurant":
        restaurant = await session.get(Restaurant, order.restaurant_id)
        if restaurant and restaurant.owner_user_id == current_user.sub:
            return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this order")


async def build_role_order_query(session: AsyncSession, current_user: TokenPayload) -> Select[tuple[Order]]:
    if current_user.role.value == "customer":
        return (
            select(Order)
            .where(Order.customer_id == current_user.sub)
            .options(selectinload(Order.items))
            .order_by(Order.created_at.desc())
        )
    if current_user.role.value == "restaurant":
        restaurant = (
            await session.execute(select(Restaurant).where(Restaurant.owner_user_id == current_user.sub))
        ).scalar_one_or_none()
        if restaurant is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant account not found")
        return (
            select(Order)
            .where(Order.restaurant_id == restaurant.id)
            .options(selectinload(Order.items))
            .order_by(Order.created_at.desc())
        )

    partner = (await session.execute(select(DeliveryPartner).where(DeliveryPartner.user_id == current_user.sub))).scalar_one_or_none()
    if partner is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery partner account not found")
    return (
        select(Order)
        .where(Order.delivery_partner_id == partner.id)
        .options(selectinload(Order.items))
        .order_by(Order.created_at.desc())
    )


async def create_order(
    session: AsyncSession,
    current_user: TokenPayload,
    payload: OrderCreateRequest,
    broadcaster: RedisOrderBroadcaster,
    redis: Redis | None = None,
) -> OrderResponse:
    if current_user.role.value != "customer":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only customers can place orders")

    restaurant = await session.get(Restaurant, payload.restaurant_id)
    if restaurant is None or not restaurant.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found")

    requested_item_ids = sorted({item.menu_item_id for item in payload.items}, key=str)
    menu_items = (
        (
            await session.execute(
                select(MenuItem)
                .where(MenuItem.id.in_(requested_item_ids))
                .with_for_update()
                .order_by(MenuItem.id)
            )
        )
        .scalars()
        .all()
    )
    items_by_id = {item.id: item for item in menu_items}

    if len(items_by_id) != len(requested_item_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="One or more menu items do not exist")

    subtotal_minor = 0
    order_items: list[OrderItem] = []
    for request_item in payload.items:
        menu_item = items_by_id[request_item.menu_item_id]
        if menu_item.restaurant_id != payload.restaurant_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Menu items must belong to one restaurant")
        if not menu_item.is_available:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"{menu_item.name} is not available for ordering",
            )
        if menu_item.available_inventory < request_item.quantity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Insufficient inventory for {menu_item.name}",
            )

        menu_item.available_inventory -= request_item.quantity
        line_total_minor = menu_item.price_minor * request_item.quantity
        subtotal_minor += line_total_minor
        order_items.append(
            OrderItem(
                menu_item_id=menu_item.id,
                quantity=request_item.quantity,
                unit_price_minor=menu_item.price_minor,
                line_total_minor=line_total_minor,
                menu_item_name=menu_item.name,
            )
        )

    assignment = await assign_nearest_partner(session, float(restaurant.latitude), float(restaurant.longitude))
    order = Order(
        customer_id=current_user.sub,
        restaurant_id=payload.restaurant_id,
        delivery_partner_id=assignment.partner_id if assignment else None,
        status=OrderStatus.PLACED,
        delivery_address=payload.delivery_address,
        delivery_latitude=payload.delivery_latitude,
        delivery_longitude=payload.delivery_longitude,
        subtotal_minor=subtotal_minor,
        delivery_fee_minor=DELIVERY_FEE_MINOR,
        total_minor=subtotal_minor + DELIVERY_FEE_MINOR,
        items=order_items,
    )
    session.add(order)
    await session.flush()

    session.add(
        OrderStatusEvent(
            order_id=order.id,
            status=OrderStatus.PLACED,
            actor_user_id=current_user.sub,
            metadata={"source": "order_create"},
        )
    )
    await session.commit()
    await invalidate_menu_cache(redis, payload.restaurant_id)
    await session.refresh(order)

    live_message = OrderStatusMessage(
        order_id=order.id,
        status=OrderStatus.PLACED,
        message=status_message(OrderStatus.PLACED),
        delivery_partner_id=order.delivery_partner_id,
        eta_minutes=assignment.eta_minutes if assignment else None,
        actor_role=current_user.role.value,
        emitted_at=datetime.now(timezone.utc),
    )
    await broadcaster.publish(live_message)
    return serialize_order(order, eta_minutes=assignment.eta_minutes if assignment else None)


async def get_order_for_user(session: AsyncSession, current_user: TokenPayload, order_id: uuid.UUID) -> OrderResponse:
    order = (
        await session.execute(select(Order).where(Order.id == order_id).options(selectinload(Order.items)))
    ).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    await ensure_order_access(session, current_user, order)
    return serialize_order(order)


async def list_orders_for_user(session: AsyncSession, current_user: TokenPayload) -> list[OrderSummaryResponse]:
    query = await build_role_order_query(session, current_user)
    orders = (await session.execute(query)).scalars().all()
    return [serialize_order_summary(order) for order in orders]


async def list_order_events_for_user(
    session: AsyncSession,
    current_user: TokenPayload,
    order_id: uuid.UUID,
) -> list[OrderStatusEventResponse]:
    order = await session.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    await ensure_order_access(session, current_user, order)
    events = (
        await session.execute(
            select(OrderStatusEvent).where(OrderStatusEvent.order_id == order_id).order_by(OrderStatusEvent.created_at.asc())
        )
    ).scalars().all()
    return [
        OrderStatusEventResponse(
            status=event.status,
            actor_user_id=event.actor_user_id,
            metadata=event.event_metadata,
            created_at=event.created_at,
        )
        for event in events
    ]


async def update_order_status(
    session: AsyncSession,
    current_user: TokenPayload,
    order_id: uuid.UUID,
    payload: OrderStatusUpdateRequest,
    broadcaster: RedisOrderBroadcaster,
) -> OrderResponse:
    assignment_eta: int | None = None
    order = (
        await session.execute(
            select(Order).where(Order.id == order_id).options(selectinload(Order.items)).with_for_update()
        )
    ).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    await ensure_order_access(session, current_user, order)
    assert_transition_allowed(order.status, payload.status, current_user.role)

    if payload.status == OrderStatus.OUT_FOR_DELIVERY and order.delivery_partner_id is None:
        restaurant = await session.get(Restaurant, order.restaurant_id)
        assignment = await assign_nearest_partner(session, float(restaurant.latitude), float(restaurant.longitude))
        if assignment is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No delivery partner is available for dispatch",
            )
        order.delivery_partner_id = assignment.partner_id
        assignment_eta = assignment.eta_minutes
    elif payload.status in {OrderStatus.DELIVERED, OrderStatus.CANCELLED} and order.delivery_partner_id is not None:
        partner = await session.get(DeliveryPartner, order.delivery_partner_id)
        if partner is not None:
            partner.is_available = True

    order.status = payload.status
    apply_transition_timestamps(order, payload.status)
    session.add(
        OrderStatusEvent(
            order_id=order.id,
            status=payload.status,
            actor_user_id=current_user.sub,
            metadata={"source": "status_update", "actor_role": current_user.role.value},
        )
    )
    await session.commit()
    await session.refresh(order)
    await session.refresh(order, attribute_names=["items"])
    await broadcaster.publish(
        OrderStatusMessage(
            order_id=order.id,
            status=order.status,
            message=status_message(order.status),
            delivery_partner_id=order.delivery_partner_id,
            eta_minutes=assignment_eta,
            actor_role=current_user.role.value,
            emitted_at=datetime.now(timezone.utc),
        )
    )
    return serialize_order(order, eta_minutes=assignment_eta)
