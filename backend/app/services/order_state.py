from collections.abc import Iterable
from datetime import UTC, datetime

from fastapi import HTTPException, status

from app.models import Order, OrderStatus, UserRole


ALLOWED_TRANSITIONS: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.PLACED: {OrderStatus.CONFIRMED, OrderStatus.CANCELLED},
    OrderStatus.CONFIRMED: {OrderStatus.PREPARING, OrderStatus.CANCELLED},
    OrderStatus.PREPARING: {OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED},
    OrderStatus.OUT_FOR_DELIVERY: {OrderStatus.DELIVERED},
    OrderStatus.DELIVERED: set(),
    OrderStatus.CANCELLED: set(),
}

ROLE_TRANSITIONS: dict[UserRole, set[OrderStatus]] = {
    UserRole.RESTAURANT: {
        OrderStatus.CONFIRMED,
        OrderStatus.PREPARING,
        OrderStatus.OUT_FOR_DELIVERY,
        OrderStatus.CANCELLED,
    },
    UserRole.DELIVERY_PARTNER: {OrderStatus.DELIVERED},
    UserRole.CUSTOMER: set(),
}

STATUS_MESSAGES: dict[OrderStatus, str] = {
    OrderStatus.PLACED: "Order placed successfully",
    OrderStatus.CONFIRMED: "Restaurant confirmed the order",
    OrderStatus.PREPARING: "Kitchen is preparing the order",
    OrderStatus.OUT_FOR_DELIVERY: "Courier picked up the order",
    OrderStatus.DELIVERED: "Order delivered",
    OrderStatus.CANCELLED: "Order cancelled",
}


def assert_transition_allowed(current_status: OrderStatus, next_status: OrderStatus, role: UserRole) -> None:
    if next_status not in ALLOWED_TRANSITIONS[current_status]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Invalid transition from {current_status.value} to {next_status.value}",
        )
    if next_status not in ROLE_TRANSITIONS[role]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{role.value} cannot move an order to {next_status.value}",
        )


def apply_transition_timestamps(order: Order, next_status: OrderStatus) -> None:
    now = datetime.now(UTC)
    if next_status == OrderStatus.CONFIRMED:
        order.confirmed_at = now
    elif next_status == OrderStatus.PREPARING:
        order.prepared_at = now
    elif next_status == OrderStatus.OUT_FOR_DELIVERY:
        order.out_for_delivery_at = now
    elif next_status == OrderStatus.DELIVERED:
        order.delivered_at = now
    elif next_status == OrderStatus.CANCELLED:
        order.cancelled_at = now


def status_message(next_status: OrderStatus) -> str:
    return STATUS_MESSAGES[next_status]
