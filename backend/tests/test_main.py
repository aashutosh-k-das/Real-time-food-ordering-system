from fastapi.testclient import TestClient

from app.main import app


def test_health() -> None:
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "postgresql://" in data["database"]


def test_order_websocket_broadcast() -> None:
    with TestClient(app) as client:
        with client.websocket_connect("/ws/orders") as websocket:
            response = client.post(
                "/orders",
                json={"customer_name": "Ava", "item": "Burger", "quantity": 2},
            )
            assert response.status_code == 200
            ws_payload = websocket.receive_json()

    assert ws_payload["customer_name"] == "Ava"
    assert ws_payload["item"] == "Burger"
    assert ws_payload["quantity"] == 2
    assert ws_payload["status"] == "pending"
