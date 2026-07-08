import asyncio
import contextlib
import json

from redis.asyncio import Redis

from app.schemas.order import OrderStatusMessage
from app.websocket.manager import OrderConnectionManager, RedisOrderBroadcaster


CHANNEL_NAME = "order-status-events"
ORDER_QUEUE_LIMIT = 100


def build_broadcaster(manager: OrderConnectionManager, redis: Redis | None) -> RedisOrderBroadcaster:
    broadcaster = RedisOrderBroadcaster(manager)
    if redis is None:
        return broadcaster

    async def publish_impl(message: OrderStatusMessage) -> None:
        payload = message.model_dump_json()
        await redis.publish(CHANNEL_NAME, payload)
        await redis.lpush(f"order:{message.order_id}:events", payload)
        await redis.ltrim(f"order:{message.order_id}:events", 0, ORDER_QUEUE_LIMIT - 1)

    async def listener() -> None:
        pubsub = redis.pubsub()
        await pubsub.subscribe(CHANNEL_NAME)
        try:
            async for event in pubsub.listen():
                if event.get("type") != "message":
                    continue
                payload = json.loads(event["data"])
                await manager.broadcast(OrderStatusMessage.model_validate(payload))
        finally:
            await pubsub.unsubscribe(CHANNEL_NAME)
            await pubsub.close()

    broadcaster.register_publish_impl(publish_impl)
    broadcaster.register_listener_task(asyncio.create_task(listener()))
    return broadcaster
