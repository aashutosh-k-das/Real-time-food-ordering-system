from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db import get_db_session
from app.schemas.assistant import AssistantChatRequest
from app.schemas.auth import TokenPayload
from app.services.food_assistant import stream_food_assistant


router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post("/chat")
async def chat_with_food_guide(
    payload: AssistantChatRequest,
    session: AsyncSession = Depends(get_db_session),
    current_user: TokenPayload = Depends(get_current_user),
) -> StreamingResponse:
    if payload.messages[0].role != "user" or payload.messages[-1].role != "user":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Conversation must start and end with a user message",
        )
    events = await stream_food_assistant(session, payload.messages)
    return StreamingResponse(
        events,
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
