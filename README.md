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
##image
<img width="1679" height="962" alt="Screenshot 2026-07-08 at 3 12 52 PM" src="https://github.com/user-attachments/assets/8b95f476-e9ec-4faa-8807-e858f04820de" />
<img width="1677" height="961" alt="Screenshot 2026-07-08 at 3 13 04 PM" src="https://github.com/user-attachments/assets/c415c749-793a-4836-981d-50242147028a" />
<img width="1671" height="954" alt="Screenshot 2026-07-08 at 3 13 17 PM" src="https://github.com/user-attachments/assets/d9d111c5-b4ab-4b20-83ea-0bac2f7f0f21" />
<img width="1669" height="935" alt="Screenshot 2026-07-08 at 3 13 41 PM" src="https://github.com/user-attachments/assets/777148e0-2f3d-422b-8fbc-fb4d22a01e02" />
<img width="1678" height="932" alt="Screenshot 2026-07-08 at 3 14 04 PM" src="https://github.com/user-attachments/assets/b684ea9b-5a74-45b0-b8a0-1e5328a6dfc7" />
