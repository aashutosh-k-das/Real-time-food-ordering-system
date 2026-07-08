import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models import OrderStatus


class OrderCreateItem(BaseModel):
    menu_item_id: uuid.UUID
    quantity: int = Field(gt=0, le=20)


class OrderCreateRequest(BaseModel):
    restaurant_id: uuid.UUID
    delivery_address: str = Field(min_length=10, max_length=255)
    delivery_latitude: float
    delivery_longitude: float
    items: list[OrderCreateItem] = Field(min_length=1)


class OrderItemResponse(BaseModel):
    menu_item_id: uuid.UUID
    menu_item_name: str
    quantity: int
    unit_price_minor: int
    line_total_minor: int


class OrderResponse(BaseModel):
    id: uuid.UUID
    restaurant_id: uuid.UUID
    customer_id: uuid.UUID
    status: OrderStatus
    subtotal_minor: int
    delivery_fee_minor: int
    total_minor: int
    delivery_partner_id: uuid.UUID | None
    eta_minutes: int | None = None
    created_at: datetime
    items: list[OrderItemResponse]


class OrderSummaryResponse(BaseModel):
    id: uuid.UUID
    restaurant_id: uuid.UUID
    customer_id: uuid.UUID
    delivery_partner_id: uuid.UUID | None
    status: OrderStatus
    total_minor: int
    eta_minutes: int | None = None
    delivery_address: str
    created_at: datetime


class OrderStatusEventResponse(BaseModel):
    status: OrderStatus
    actor_user_id: uuid.UUID | None
    metadata: dict
    created_at: datetime


class OrderStatusUpdateRequest(BaseModel):
    status: OrderStatus


class OrderStatusMessage(BaseModel):
    order_id: uuid.UUID
    status: OrderStatus
    message: str
    delivery_partner_id: uuid.UUID | None = None
    eta_minutes: int | None = None
    actor_role: str | None = None
    emitted_at: datetime
