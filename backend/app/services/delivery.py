import math
from dataclasses import dataclass
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import DeliveryPartner


@dataclass
class DeliveryAssignment:
    partner_id: uuid.UUID
    eta_minutes: int
    distance_km: float


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_km = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
    )
    return 2 * radius_km * math.asin(math.sqrt(a))


async def assign_nearest_partner(
    session: AsyncSession,
    restaurant_latitude: float,
    restaurant_longitude: float,
) -> DeliveryAssignment | None:
    partners = (
        await session.execute(
            select(DeliveryPartner).where(DeliveryPartner.is_available.is_(True)).with_for_update(skip_locked=True)
        )
    ).scalars().all()
    if not partners:
        return None

    closest_partner = min(
        partners,
        key=lambda partner: haversine_km(
            float(partner.current_latitude),
            float(partner.current_longitude),
            restaurant_latitude,
            restaurant_longitude,
        ),
    )
    distance_km = haversine_km(
        float(closest_partner.current_latitude),
        float(closest_partner.current_longitude),
        restaurant_latitude,
        restaurant_longitude,
    )
    settings = get_settings()
    eta_minutes = math.ceil((distance_km / settings.delivery_speed_kmh) * 60) + settings.prep_buffer_minutes
    closest_partner.is_available = False
    return DeliveryAssignment(
        partner_id=closest_partner.id,
        eta_minutes=eta_minutes,
        distance_km=distance_km,
    )
