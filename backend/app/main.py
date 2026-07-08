import asyncio
import json
import os
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from redis.asyncio import Redis


class OrderCreate(BaseModel):
    customer_name: str = Field(min_length=1)
    item: str = Field(min_length=1)
    quantity: int = Field(gt=0)


class OrderUpdate(BaseModel):
    id: str
    customer_name: str
    item: str
    quantity: int
    status: str
    created_at: str


class ConnectionManager:
    def __init__(self) -> None:
        self.connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self.connections.discard(websocket)

    async def broadcast(self, payload: str) -> None:
        stale: list[WebSocket] = []
        for ws in self.connections:
            try:
                await ws.send_text(payload)
            except Exception:
                stale.append(ws)
        for ws in stale:
            self.disconnect(ws)


app = FastAPI(title="Real-time food ordering system")
manager = ConnectionManager()
redis_client: Redis | None = None
redis_listener_task: asyncio.Task | None = None


@app.on_event("startup")
async def startup() -> None:
    global redis_client, redis_listener_task
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    try:
        redis_client = Redis.from_url(redis_url, decode_responses=True)
        await redis_client.ping()
        redis_listener_task = asyncio.create_task(redis_listener())
    except Exception:
        redis_client = None
        redis_listener_task = None


@app.on_event("shutdown")
async def shutdown() -> None:
    if redis_listener_task:
        redis_listener_task.cancel()
    if redis_client:
        await redis_client.close()


@app.get("/health")
async def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "fastapi",
        "database": os.getenv("DATABASE_URL", "postgresql://localhost/food_orders"),
    }


@app.post("/orders", response_model=OrderUpdate)
async def create_order(order: OrderCreate) -> OrderUpdate:
    order_update = OrderUpdate(
        id=str(uuid4()),
        customer_name=order.customer_name,
        item=order.item,
        quantity=order.quantity,
        status="pending",
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    payload = order_update.model_dump_json()
    if redis_client:
        await redis_client.publish("orders", payload)
    await manager.broadcast(payload)
    return order_update


@app.websocket("/ws/orders")
async def order_updates(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


async def redis_listener() -> None:
    if not redis_client:
        return
    pubsub = redis_client.pubsub()
    await pubsub.subscribe("orders")
    async for message in pubsub.listen():
        if message.get("type") == "message":
            data = message.get("data")
            if isinstance(data, str):
                try:
                    json.loads(data)
                    await manager.broadcast(data)
                except json.JSONDecodeError:
                    continue
