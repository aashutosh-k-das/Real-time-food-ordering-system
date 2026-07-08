import contextlib
import uuid
from collections.abc import AsyncIterator

import jwt
from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from redis.asyncio import Redis

from app.api import auth, delivery, orders, restaurants
from app.core.config import get_settings
from app.core.security import decode_token
from app.db import SessionLocal, init_sqlite_demo_data
from app.models import Order
from app.schemas.auth import TokenPayload
from app.services.order_events import build_broadcaster
from app.services.orders import ensure_order_access
from app.websocket.manager import OrderConnectionManager


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    redis: Redis | None = None
    try:
        candidate = Redis.from_url(settings.redis_url, decode_responses=True)
        await candidate.ping()
        redis = candidate
    except Exception:
        redis = None

    connection_manager = OrderConnectionManager()
    app.state.redis = redis
    app.state.connection_manager = connection_manager
    app.state.order_broadcaster = build_broadcaster(connection_manager, redis)
    await init_sqlite_demo_data()
    yield
    await app.state.order_broadcaster.shutdown()
    if redis is not None:
        await redis.close()


def decode_ws_token(token: str) -> TokenPayload:
    try:
        return decode_token(token)
    except (jwt.InvalidTokenError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Invalid authentication token") from exc


app = FastAPI(title=get_settings().app_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router, prefix=get_settings().api_prefix)
app.include_router(delivery.router, prefix=get_settings().api_prefix)
app.include_router(restaurants.router, prefix=get_settings().api_prefix)
app.include_router(orders.router, prefix=get_settings().api_prefix)


@app.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.websocket("/ws/orders/{order_id}")
async def order_updates(
    websocket: WebSocket,
    order_id: uuid.UUID,
    token: str = Query(...),
) -> None:
    user = decode_ws_token(token)
    async with SessionLocal() as session:
        order = await session.get(Order, order_id)
        if order is None:
            await websocket.close(code=4404)
            return
        try:
            await ensure_order_access(session, user, order)
        except HTTPException:
            await websocket.close(code=4403)
            return

    manager = websocket.app.state.connection_manager
    await manager.connect(order_id, websocket)
    await websocket.send_json(
        {
            "type": "connection_ready",
            "order_id": str(order_id),
            "viewer_role": user.role.value,
        }
    )
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(order_id, websocket)
