from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db import get_db_session
from app.models import DeliveryPartner, UserRole
from app.schemas.auth import TokenPayload
from app.schemas.common import MessageResponse
from app.schemas.delivery import DeliveryPartnerLocationUpdateRequest


router = APIRouter(prefix="/delivery", tags=["delivery"])


@router.patch("/me/location", response_model=MessageResponse)
async def update_delivery_location(
    payload: DeliveryPartnerLocationUpdateRequest,
    current_user: TokenPayload = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    if current_user.role != UserRole.DELIVERY_PARTNER:
        raise HTTPException(status_code=403, detail="Only delivery partners can update courier location")
    partner = (await session.execute(select(DeliveryPartner).where(DeliveryPartner.user_id == current_user.sub))).scalar_one_or_none()
    if partner is None:
        raise HTTPException(status_code=404, detail="Delivery partner profile not found")
    partner.current_latitude = payload.latitude
    partner.current_longitude = payload.longitude
    if payload.is_available is not None:
        partner.is_available = payload.is_available
    partner.last_seen_at = datetime.now(UTC)
    await session.commit()
    return MessageResponse(message="Courier location updated")
