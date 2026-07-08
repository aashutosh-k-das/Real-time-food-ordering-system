import pytest
from fastapi import HTTPException

from app.models import Order, OrderStatus, UserRole
from app.services.order_state import apply_transition_timestamps, assert_transition_allowed


def test_restaurant_can_advance_order() -> None:
    assert_transition_allowed(OrderStatus.PLACED, OrderStatus.CONFIRMED, UserRole.RESTAURANT)


def test_delivery_cannot_confirm_order() -> None:
    with pytest.raises(HTTPException) as exc_info:
        assert_transition_allowed(OrderStatus.PLACED, OrderStatus.CONFIRMED, UserRole.DELIVERY_PARTNER)
    assert exc_info.value.status_code == 403


def test_delivered_order_gets_timestamp() -> None:
    order = Order(
        customer_id=None,
        restaurant_id=None,
        status=OrderStatus.OUT_FOR_DELIVERY,
        delivery_address="221B Fleet Street, Bengaluru",
        delivery_latitude=12.9716,
        delivery_longitude=77.5946,
        subtotal_minor=1000,
        delivery_fee_minor=200,
        total_minor=1200,
    )
    apply_transition_timestamps(order, OrderStatus.DELIVERED)
    assert order.delivered_at is not None
