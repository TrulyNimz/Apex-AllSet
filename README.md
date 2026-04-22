# APEX Trading Platform

A full-stack paper trading platform built for practicing forex, metals, and crypto trading in a realistic simulated environment. Real-time price feeds, order management, portfolio tracking, risk controls, and a competitive leaderboard — all without risking real capital.

---

## Stack

| Layer | Technology |
|---|---|
| Backend API | Go 1.23 · Fiber v2 · sqlx · golang-migrate |
| Database | PostgreSQL 16 · Redis 7 |
| Auth | JWT (access + refresh) · TOTP 2FA |
| Frontend | React 19 · Vite 5 · TypeScript · Tailwind CSS |
| State | Zustand · TanStack Query v5 |
| Charts | TradingView Lightweight Charts |
| Forms | React Hook Form · Zod |
| Realtime | WebSocket (native Fiber + custom React client) |
| Infra | Docker Compose · multi-stage Dockerfiles · Nginx |
| CI/CD | GitHub Actions → GHCR → SSH deploy |
| Testing | Go test · Playwright E2E |

---

## Repository Layout

```
Apex-AllSet/
├── backend/                  ← Go / Fiber REST API
│   ├── cmd/server/           ← entrypoint
│   ├── internal/
│   │   ├── auth/             ← register, login, JWT, 2FA
│   │   ├── market/           ← price simulator, OHLCV, WebSocket hub
│   │   ├── order/            ← market/limit/stop orders, position engine
│   │   ├── portfolio/        ← equity snapshots, PnL curve
│   │   ├── risk/             ← drawdown limits, halt, daily loss cap
│   │   ├── alert/            ← price alerts with push notifications
│   │   ├── leaderboard/      ← Redis sorted-set leaderboard
│   │   ├── notification/     ← in-app notification feed
│   │   ├── watchlist/        ← per-user symbol watchlists
│   │   ├── user/             ← profile, KYC
│   │   ├── config/           ← typed env config
│   │   ├── database/         ← postgres + redis + migrations runner
│   │   ├── middleware/       ← JWT auth, rate limiting, CORS, request ID
│   │   └── server/           ← Fiber app + all route wiring
│   ├── migrations/           ← SQL migrations 001–007
│   ├── pkg/                  ← logger, validator, response, crypto
│   ├── scripts/              ← VPS bootstrap script
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── Makefile
│
├── frontend/                 ← React 19 / Vite SPA
│   ├── src/
│   │   ├── app/              ← router, route guards
│   │   ├── features/         ← dashboard, trading, portfolio, journal, settings, auth
│   │   ├── components/       ← ui/, layout/, charts/, trading/, portfolio/
│   │   ├── hooks/            ← useAuth, useTick, useOrders, usePortfolio, useMarket
│   │   ├── services/         ← typed API wrappers
│   │   ├── store/            ← auth.store, market.store, theme.store (Zustand)
│   │   ├── lib/              ← api-client (Axios + interceptors), ws-client
│   │   ├── types/            ← shared TypeScript interfaces
│   │   └── styles/           ← Tailwind base + design tokens
│   ├── e2e/                  ← Playwright test suite
│   ├── Dockerfile
│   └── nginx.conf
│
├── .github/workflows/        ← CI/CD pipelines (backend + frontend)
├── PLAN.md                   ← Full v2 implementation plan & roadmap
└── README.md
```

---

## Features

### Trading
- **Market, Limit, Stop orders** with instant or tick-triggered execution
- **Long & short positions** with weighted average price tracking
- **Real-time P&L** — unrealized PnL overlaid on live tick prices via WebSocket
- **Order history** with fill prices, timestamps, and status tracking

### Risk Management
- Configurable **max drawdown %**, **daily loss limit %**, **max open positions**
- Automatic **trading halt** when limits are breached + manual reset
- Risk event log for audit trail

### Market Data
- **7 instruments** — EURUSD, GBPUSD, USDJPY, USDCHF, AUDUSD, XAUUSD, BTCUSD
- Live **bid/ask/mid/spread** ticks every 500ms via WebSocket
- **OHLCV candlestick data** stored per minute, served for chart rendering
- Pluggable feed architecture — swap simulator for a real broker feed via config

### Portfolio
- **Equity curve** snapshots every 5 minutes, queryable by date range
- **Portfolio summary** — balance, unrealized PnL, realized PnL, open positions
- Starting paper balance: **$100,000 USD**

### Alerts & Notifications
- **Price alerts** — above/below threshold, fires in-app notification on trigger
- **Order fill notifications** — instant in-app notification on every fill
- In-app notification feed with read/unread state

### Leaderboard
- **Opt-in** Redis sorted-set leaderboard ranked by account equity
- Shows rank, display name, equity, and % return from starting balance
- Updated every 5 minutes via portfolio snapshot job

### Auth
- Email + password registration and login
- **JWT access tokens** (15m) + **refresh tokens** (7d) with Redis revocation
- **TOTP 2FA** — setup via QR code, verify, disable flows

---

## Getting Started

### Prerequisites
- Docker & Docker Compose
- Go 1.23+ (for local backend development)
- Node.js 22+ (for local frontend development)

### 1. Clone

```bash
git clone https://github.com/TrulyNimz/Apex-AllSet.git
cd Apex-AllSet
git checkout Dev_1
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env — set JWT secrets, DB/Redis credentials as needed
cp frontend/.env.example frontend/.env.local
```

### 3. Start infrastructure + API

```bash
cd backend
make docker-up        # starts Postgres + Redis
make dev              # runs API with hot reload (requires air: go install github.com/air-verse/air@latest)
```

Or run the full stack via Docker Compose:

```bash
cd backend
docker compose up -d
```

### 4. Run migrations

```bash
cd backend
make migrate-up
```

### 5. Start frontend

```bash
cd frontend
npm install
npm run dev           # Vite dev server on :5173, proxies /api → :8080
```

### 6. Open

```
http://localhost:5173
```

Register an account — a $100,000 paper wallet is created on your first trade.

---

## API Overview

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/auth/register` | — | Register new account |
| POST | `/api/v1/auth/login` | — | Login, returns token pair |
| POST | `/api/v1/auth/refresh` | — | Refresh access token |
| POST | `/api/v1/auth/logout` | JWT | Revoke refresh token |
| POST | `/api/v1/auth/2fa/setup` | JWT | Generate TOTP QR code |
| POST | `/api/v1/auth/2fa/verify` | JWT | Enable 2FA |
| GET | `/api/v1/instruments` | — | List tradeable instruments |
| GET | `/api/v1/market/:symbol/candles` | — | OHLCV data |
| WS | `/api/v1/ws/prices?token=` | JWT | Live price tick stream |
| POST | `/api/v1/orders` | JWT | Place order |
| GET | `/api/v1/orders` | JWT | Order history |
| DELETE | `/api/v1/orders/:id` | JWT | Cancel open order |
| GET | `/api/v1/positions` | JWT | Open positions with live PnL |
| GET | `/api/v1/portfolio` | JWT | Account summary |
| GET | `/api/v1/portfolio/equity-curve` | JWT | Equity history |
| GET | `/api/v1/leaderboard` | — | Top traders |
| GET/PATCH | `/api/v1/risk/profile` | JWT | Risk settings |
| POST/GET/DELETE | `/api/v1/alerts` | JWT | Price alerts |
| GET | `/api/v1/notifications` | JWT | Notification feed |
| GET/POST/DELETE | `/api/v1/watchlist` | JWT | Symbol watchlist |

WebSocket message format:
```json
// Subscribe
{ "type": "subscribe", "symbol": "EURUSD" }

// Tick (received)
{ "type": "tick", "symbol": "EURUSD", "data": { "bid": 1.08425, "ask": 1.08445, "mid": 1.08435, "spread": 0.00020, "timestamp": 1745000000000 } }
```

---

## Makefile Targets (backend)

```bash
make dev              # hot reload with air
make build            # compile binary
make test             # go test ./...
make test-race        # go test -race ./...
make coverage         # coverage report
make lint             # golangci-lint
make migrate-up       # run all pending migrations
make migrate-down     # roll back one migration
make migrate-create NAME=xxx  # create new migration files
make docker-up        # start Postgres + Redis
make generate-secrets # generate JWT secret keys
```

---

## Design System

The frontend uses a purpose-built dark theme with a strict design token system.

| Token | Value | Meaning |
|---|---|---|
| `void` | `#050608` | Page background |
| `deep` | `#0a0c10` | Sidebar, topbar |
| `surface` | `#0f1117` | Hover states, inputs |
| `panel` | `#141820` | Cards, tables |
| `gold` | `#c9a84c` | Primary actions, logo, profit |
| `teal` | `#00d4aa` | Buy / long / positive PnL |
| `danger` | `#ff4757` | Sell / short / negative PnL |
| `warning` | `#ffa502` | Pending, degraded states |

Fonts: **Bebas Neue** (display) · **DM Sans** (UI) · **DM Mono** (prices/data) · **Instrument Serif** (journal)

---

## Roadmap

See [`PLAN.md`](./PLAN.md) for the full v2 implementation plan.

Current priority queue:
- **Phase 0** — Bug fixes (risk check enforcement, wallet debit/credit, wire dead domains)
- **Phase 1** — Multi-timeframe candles (5m, 15m, 1h, 4h, 1d)
- **Phase 2** — TP/SL orders, order book UI, position sizing calculator
- **Phase 3** — Leaderboard page, price alerts UI, risk settings UI
- **Phase 5** — Real price feed integration (Polygon.io)
- **Phase 6** — Full trade journal with analytics and CSV export

---

## License

MIT
