# Runbook

## Demo Accounts

- Customer: `customer@example.com` / `portfolio123`
- Restaurant: `restaurant@example.com` / `portfolio123`
- Delivery partner: `delivery@example.com` / `portfolio123`

## Infrastructure

Start dependencies:

```bash
docker compose up -d
```

Start the full app stack:

```bash
docker compose up --build
```

This brings up Postgres, Redis, FastAPI, and the React dev server together.
The backend container now runs Alembic migrations and seeds demo data on startup. To refresh demo rows manually, you can rerun:

```bash
docker compose exec backend python scripts/bootstrap_db.py
```

For the production-style stack, use:

```bash
docker compose -f docker-compose.prod.yml up --build
```

## Backend

1. Apply migrations with Alembic.
2. Seed sample data with the bootstrap script.
3. Copy [`backend/.env.example`](../backend/.env.example) to `.env` and adjust values.
4. Install dependencies:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
alembic upgrade head
python scripts/bootstrap_db.py
uvicorn app.main:app --reload
```

## Frontend

1. Copy [`frontend/.env.example`](../frontend/.env.example) to `.env`.
2. Install and run:

```bash
cd frontend
npm install
npm run dev
```

The customer checkout and delivery partner console use Leaflet with OpenStreetMap tiles for the map picker. Browser GPS is used for the `Use live location` buttons, so location capture requires browser permission and works best on `localhost` or HTTPS.

## Manual JWT Helper

Generate a customer token that matches the seeded customer:

```bash
cd backend
python3 scripts/generate_jwt.py \
  --user-id 8ca0465f-e154-4acd-9080-3b096b518f40 \
  --email customer@example.com \
  --role customer \
  --secret dev-secret-change-me-please-keep-long
```
