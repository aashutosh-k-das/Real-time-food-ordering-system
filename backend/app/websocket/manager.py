import asyncio
from collections import defaultdict
from collections.abc import Awaitable, Callable
import contextlib
import uuid

from fastapi import WebSocket

from app.schemas.order import OrderStatusMessage


class OrderConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[uuid.UUID, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, order_id: uuid.UUID, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections[order_id].add(websocket)

    async def disconnect(self, order_id: uuid.UUID, websocket: WebSocket) -> None:
        async with self._lock:
            sockets = self._connections.get(order_id)
            if not sockets:
                return
            sockets.discard(websocket)
            if not sockets:
                self._connections.pop(order_id, None)

    async def broadcast(self, message: OrderStatusMessage) -> None:
        async with self._lock:
            sockets = list(self._connections.get(message.order_id, set()))
        stale: list[WebSocket] = []
        for websocket in sockets:
            try:
                await websocket.send_json(message.model_dump(mode="json"))
            except RuntimeError:
                stale.append(websocket)
        for websocket in stale:
            await self.disconnect(message.order_id, websocket)


class RedisOrderBroadcaster:
    def __init__(self, manager: OrderConnectionManager) -> None:
        self._manager = manager
        self._listener_task: asyncio.Task | None = None
        self._publish_impl: Callable[[OrderStatusMessage], Awaitable[None]] | None = None

    def register_publish_impl(self, publish_impl: Callable[[OrderStatusMessage], Awaitable[None]]) -> None:
        self._publish_impl = publish_impl

    def register_listener_task(self, task: asyncio.Task) -> None:
        self._listener_task = task

    async def publish(self, message: OrderStatusMessage) -> None:
        if self._publish_impl is not None:
            await self._publish_impl(message)
        else:
            await self._manager.broadcast(message)

    async def shutdown(self) -> None:
        if self._listener_task is not None:
            self._listener_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._listener_task
