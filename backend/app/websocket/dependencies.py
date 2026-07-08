from fastapi import Request

from app.websocket.manager import RedisOrderBroadcaster


def get_order_broadcaster(request: Request) -> RedisOrderBroadcaster:
    return request.app.state.order_broadcaster
