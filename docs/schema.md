# Real-Time Food Ordering & Delivery Tracking System

## Architecture Slice

- `PostgreSQL`: system of record for users, restaurants, menus, orders, inventory, and delivery assignments.
- `Redis`: menu cache, order event fan-out, and a lightweight live order queue for restaurant/dashboard views.
- `FastAPI`: REST APIs for transactional operations and a WebSocket endpoint for real-time order tracking.
- `React + Vite`: customer-facing order flow with live status updates.

## Core Relational Model

### `users`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | server-generated |
| `email` | `varchar(255)` unique | login identifier |
| `password_hash` | `varchar(255)` | Argon2/bcrypt hash |
| `full_name` | `varchar(120)` | display name |
| `role` | `user_role` | `customer`, `restaurant`, `delivery_partner` |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | default `now()` |

### `restaurants`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | server-generated |
| `owner_user_id` | `uuid` FK -> `users.id` | restaurant account |
| `name` | `varchar(160)` | indexed |
| `description` | `text` | optional |
| `is_active` | `boolean` | default `true` |
| `latitude` | `numeric(9,6)` | location for delivery lookup |
| `longitude` | `numeric(9,6)` | location for delivery lookup |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | default `now()` |

### `menu_items`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | server-generated |
| `restaurant_id` | `uuid` FK -> `restaurants.id` | indexed |
| `name` | `varchar(160)` | |
| `description` | `text` | optional |
| `price_minor` | `integer` | currency in minor units |
| `currency` | `char(3)` | ISO code |
| `available_inventory` | `integer` | non-negative stock count |
| `is_available` | `boolean` | operational toggle |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | default `now()` |

### `delivery_partners`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | server-generated |
| `user_id` | `uuid` FK -> `users.id` | unique |
| `vehicle_type` | `varchar(40)` | bike, scooter, car |
| `is_available` | `boolean` | indexed |
| `current_latitude` | `numeric(9,6)` | |
| `current_longitude` | `numeric(9,6)` | |
| `last_seen_at` | `timestamptz` | freshness gate |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | default `now()` |

### `orders`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | server-generated |
| `customer_id` | `uuid` FK -> `users.id` | indexed |
| `restaurant_id` | `uuid` FK -> `restaurants.id` | indexed |
| `delivery_partner_id` | `uuid` FK -> `delivery_partners.id` nullable | assigned later |
| `status` | `order_status` | state machine |
| `delivery_address` | `text` | |
| `delivery_latitude` | `numeric(9,6)` | |
| `delivery_longitude` | `numeric(9,6)` | |
| `subtotal_minor` | `integer` | snapshot |
| `delivery_fee_minor` | `integer` | snapshot |
| `total_minor` | `integer` | snapshot |
| `placed_at` | `timestamptz` | set on create |
| `confirmed_at` | `timestamptz` | nullable |
| `prepared_at` | `timestamptz` | nullable |
| `out_for_delivery_at` | `timestamptz` | nullable |
| `delivered_at` | `timestamptz` | nullable |
| `cancelled_at` | `timestamptz` | nullable |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | default `now()` |

### `order_items`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | server-generated |
| `order_id` | `uuid` FK -> `orders.id` | indexed |
| `menu_item_id` | `uuid` FK -> `menu_items.id` | snapshot source |
| `quantity` | `integer` | positive |
| `unit_price_minor` | `integer` | snapshot |
| `line_total_minor` | `integer` | snapshot |
| `menu_item_name` | `varchar(160)` | snapshot |
| `created_at` | `timestamptz` | default `now()` |

### `order_status_events`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `bigserial` PK | ordered audit trail |
| `order_id` | `uuid` FK -> `orders.id` | indexed |
| `status` | `order_status` | status after transition |
| `actor_user_id` | `uuid` FK -> `users.id` nullable | who triggered it |
| `metadata` | `jsonb` | optional transition context |
| `created_at` | `timestamptz` | default `now()` |

## Order State Machine

- `placed -> confirmed -> preparing -> out_for_delivery -> delivered`
- `placed -> cancelled`
- `confirmed -> cancelled`
- `preparing -> cancelled`

`out_for_delivery` and `delivered` cannot transition backwards. State transition validation lives in the service layer so the API and WebSocket stream share the same rules.

## Inventory Concurrency Strategy

Chosen approach: `SELECT ... FOR UPDATE` pessimistic row-level locking on each affected `menu_items` row inside a single database transaction.

Why:

- Checkout is a correctness-critical path.
- Inventory rows are a classic hot-spot with low write cardinality.
- Row locks give simple, strong guarantees that are easy to explain in interviews and easy to verify in tests.
- They avoid optimistic-retry storms when many customers hit the last few units at once.

Tradeoff:

- Contending orders serialize on the same item row, so throughput for one SKU is bounded by transaction time.
- Optimistic locking can outperform this when conflicts are rare, but for food ordering "last item" races are exactly the conflicts we care about.

Transaction pattern:

1. Begin transaction.
2. Lock all requested `menu_items` rows with `FOR UPDATE`, ordered by `id` to reduce deadlock risk.
3. Validate restaurant ownership, item availability, and `available_inventory >= requested_quantity`.
4. Decrement `available_inventory`.
5. Insert `orders`, `order_items`, and initial `order_status_events`.
6. Commit.

## WebSocket Design

Endpoint shape: `/ws/orders/{order_id}?token=...`

- Client authenticates with JWT and may only subscribe to orders they are allowed to see.
- Backend stores connections per `order_id`.
- Status changes are published to Redis and fanned out to connected WebSocket clients.

Why WebSockets over polling:

- Lower latency for status changes.
- Less wasteful under active tracking.
- Better fit for an interview discussion around event-driven UX.

Tradeoff:

- More connection-management complexity than polling.
- Requires heartbeat/disconnect handling and cross-instance fan-out for horizontal scale.

## Delivery Assignment

Chosen approach: nearest available delivery partner using haversine distance from restaurant coordinates to courier coordinates, plus a simple ETA estimate.

ETA model:

- `eta_minutes = ceil((distance_km / 20kmh) * 60) + prep_buffer_minutes`

Why:

- Easy to explain and implement.
- Good enough for a portfolio project without pretending to solve routing.

Tradeoff:

- Ignores live traffic, batching, and courier destination drift.
- Real systems usually layer heuristics, zones, and dispatch optimization on top.
