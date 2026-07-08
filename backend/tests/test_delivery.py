from app.services.delivery import haversine_km


def test_haversine_distance_is_reasonable() -> None:
    bengaluru_mg_road = (12.9756, 77.6050)
    indiranagar = (12.9784, 77.6408)
    distance = haversine_km(*bengaluru_mg_road, *indiranagar)
    assert 3.0 < distance < 5.0
