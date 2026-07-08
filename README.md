# Real-Time Food Ordering & Delivery Tracking System

Full-stack food delivery platform with real-time order tracking, WebSocket live updates, and concurrency-safe inventory management.

Production-oriented portfolio project for a Foodhub-style ordering platform:

- FastAPI backend with PostgreSQL, Redis, JWT auth, and WebSockets
- React + Vite frontend with live order tracking
- Pessimistic inventory locking to prevent overselling
- Multi-role flows for customer, restaurant, and delivery partner
- Dockerized local dev stack for one-command startup
- Automatic database bootstrap and seed on container startup
- Production compose file with nginx-served frontend and API proxying

Initial deliverables in this scaffold:

- relational schema in [`backend/schema.sql`](backend/schema.sql)
- architecture notes in [`docs/schema.md`](docs/schema.md)
- backend and frontend app structure for the complete demo flow
- local setup in [`docs/runbook.md`](docs/runbook.md)
- container setup in [`docker-compose.yml`](docker-compose.yml)
