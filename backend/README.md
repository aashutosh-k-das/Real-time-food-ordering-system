# Backend (FastAPI + WebSockets + Redis)

## Run

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Environment variables

- `DATABASE_URL` (default: `postgresql://localhost/food_orders`)
- `REDIS_URL` (default: `redis://localhost:6379/0`)
