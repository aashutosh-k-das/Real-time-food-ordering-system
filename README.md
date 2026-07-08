# Real-time-food-ordering-system

Full-stack food delivery platform using **FastAPI + Python**, **React**, **WebSockets**, **PostgreSQL**, and **Redis**.

## Project structure

- `/backend` - FastAPI API with live WebSocket order updates and Redis pub/sub fanout.
- `/frontend` - React (Vite) UI to place orders and watch live updates.

## Quick start

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Set API URL in frontend with `VITE_API_BASE_URL` if needed (default: `http://localhost:8000`).

Backend environment variables:

- `DATABASE_URL` (default: `postgresql://localhost/food_orders`)
- `REDIS_URL` (default: `redis://localhost:6379/0`)
