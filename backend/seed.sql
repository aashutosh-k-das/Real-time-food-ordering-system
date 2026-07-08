INSERT INTO users (id, email, password_hash, full_name, role)
VALUES
    ('8ca0465f-e154-4acd-9080-3b096b518f40', 'customer@example.com', 'pbkdf2_sha256$390000$custsalt123$3pcGvZQgiFxaws4M66hLTx22v53wQ_ciCcGHhnENX1o=', 'Priya Sharma', 'customer'),
    ('5bb65318-736e-4316-95a6-43fcbc90d2c1', 'restaurant@example.com', 'pbkdf2_sha256$390000$restsalt123$zWqQHemg9nQcrUg9b2xF8xpO73hXcjNxy_rnBQ7bDQo=', 'Ankit Rao', 'restaurant'),
    ('ef718518-cf6b-4c8d-96ea-e8f5bf14a08d', 'delivery@example.com', 'pbkdf2_sha256$390000$delisalt123$JFWuBU53pvCWMH8lPsil-k2qvE60ihD0TPVOCeTWNp4=', 'Ravi Kumar', 'delivery_partner')
ON CONFLICT (email) DO NOTHING;

INSERT INTO restaurants (id, owner_user_id, name, description, latitude, longitude)
VALUES (
    'f5f3a6c4-4daa-4cb0-a60c-8f56befd2ab6',
    '5bb65318-736e-4316-95a6-43fcbc90d2c1',
    'Copper Kadhai',
    'North Indian comfort food built for dispatch speed.',
    12.9719,
    77.6412
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO menu_items (id, restaurant_id, name, description, price_minor, currency, available_inventory, is_available)
VALUES
    ('d0857943-a875-4882-8d90-5cb9d92cb1e5', 'f5f3a6c4-4daa-4cb0-a60c-8f56befd2ab6', 'Paneer Tikka Bowl', 'High-demand item for lock-contention demos.', 34900, 'INR', 5, TRUE),
    ('0cf1e5ab-b64e-4eb8-8d34-dd8b4d4f6478', 'f5f3a6c4-4daa-4cb0-a60c-8f56befd2ab6', 'Garlic Naan Set', 'Fast-prep side with smaller inventory.', 12900, 'INR', 8, TRUE),
    ('6eb26eaf-7e24-42d9-9a60-6799435bda25', 'f5f3a6c4-4daa-4cb0-a60c-8f56befd2ab6', 'Dal Makhani', 'Slow-cooked signature item.', 25900, 'INR', 6, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO delivery_partners (id, user_id, vehicle_type, is_available, current_latitude, current_longitude)
VALUES (
    'a7352b33-cc82-497f-923c-e9b4c767d86d',
    'ef718518-cf6b-4c8d-96ea-e8f5bf14a08d',
    'scooter',
    TRUE,
    12.9756,
    77.6387
)
ON CONFLICT (id) DO NOTHING;
