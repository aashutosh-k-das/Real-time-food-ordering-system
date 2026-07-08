import uuid

from pydantic import BaseModel


class RestaurantSummary(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None


class MenuItemSummary(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    price_minor: int
    currency: str
    available_inventory: int
    is_available: bool
