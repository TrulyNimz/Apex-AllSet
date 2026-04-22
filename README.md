# Apex AllSet — Trading Platform

> Full-stack multi-asset trading platform. React 19 frontend + Go/Fiber backend in a monorepo.

## Structure

```
Apex-AllSet/
├── frontend/   # React 19 + TypeScript SPA (Vite, Tailwind, Zustand, React Query)
└── backend/    # Go + Fiber REST & WebSocket API (PostgreSQL, Redis, JWT)
```

See each folder's README for setup and docs:
- [frontend/README.md](frontend/README.md)
- [backend/README.md](backend/README.md)

## Quick Start

### Backend

```bash
cd backend
cp .env.example .env          # configure env vars
make docker-up                # start Postgres + Redis
make tools                    # install air, migrate, golangci-lint (first time)
make dev                      # hot reload on :8080
make migrate-up               # apply DB migrations
```

### Frontend

```bash
cd frontend
npm ci
cp .env.example .env.local    # VITE_API_URL defaults to http://localhost:8080
npm run dev                   # dev server on :5173
```

## Stack

| Layer      | Technology                                      |
|-----------|--------------------------------------------------|
| Frontend  | React 19, TypeScript, Vite, Tailwind CSS         |
| Backend   | Go 1.23, Fiber v2, PostgreSQL 16, Redis 7        |
| Auth      | JWT (access + refresh tokens) + TOTP 2FA        |
| Realtime  | WebSocket (price ticks, order updates)          |
| Deploy    | Docker + Docker Compose, GitHub Actions → VPS   |
