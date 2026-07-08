from pydantic import BaseModel


class DeliveryPartnerLocationUpdateRequest(BaseModel):
    latitude: float
    longitude: float
    is_available: bool | None = None
