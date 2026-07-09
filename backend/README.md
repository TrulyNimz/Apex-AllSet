# Apex Trading — Backend API

> Go + Fiber REST & WebSocket API for the Apex multi-asset trading platform.

## Stack

| Layer        | Technology                          |
|-------------|-------------------------------------|
| Language    | Go 1.23                             |
| Framework   | Fiber v2                            |
| Database    | PostgreSQL 16 + TimescaleDB (Phase 2) |
| Cache       | Redis 7                             |
| Auth        | JWT (access + refresh) + TOTP 2FA  |
| Migrations  | golang-migrate                      |
| Logging     | Uber Zap (structured)               |
| Deployment  | Docker + Docker Compose             |
| CI/CD       | GitHub Actions → VPS SSH deploy     |

---

## Project Structure

```
apex-backend/
├── cmd/server/           # Entrypoint (main.go)
├── internal/
│   ├── auth/             # Auth domain: register, login, JWT, 2FA
│   ├── user/             # User domain: profile management
│   ├── market/           # Market data service (Phase 2)
│   ├── order/            # Order engine (Phase 2)
│   ├── portfolio/        # Portfolio aggregation (Phase 2)
│   ├── notification/     # Alerts & notifications (Phase 3)
│   ├── middleware/        # JWT, rate limit, request ID
│   ├── config/           # Typed env var loading
│   ├── database/         # Postgres + Redis init + migrations
│   └── server/           # Fiber app + route wiring
├── pkg/
│   ├── logger/           # Zap wrapper
│   ├── validator/        # Request validation helpers
│   ├── response/         # Standardised JSON response helpers
│   └── crypto/           # Hashing, token utilities
├── migrations/           # SQL migration files (up + down)
├── scripts/              # VPS bootstrap, DB backup
├── Dockerfile            # Multi-stage production build
├── Makefile              # Developer commands
└── .air.toml             # Hot reload config
```

---

## Quick Start (Local)

### Prerequisites
- Go 1.23+
- Docker + Docker Compose
- `make` (standard on Linux/Mac)

### 1. Clone & configure

```bash
git clone https://github.com/apex-trading/apex-backend.git
cd apex-backend
cp .env.example .env
# Edit .env — at minimum set JWT secrets
```

### 2. Generate JWT secrets

```bash
make generate-secrets
# Copy output into .env
```

### 3. Start infrastructure

```bash
make docker-up
# Starts Postgres + Redis in Docker
```

### 4. Run with hot reload

```bash
make tools   # Install air, migrate, golangci-lint (first time)
make dev     # Starts server with hot reload on :8080
```

### 5. Apply migrations

```bash
make migrate-up
```

---

## API Reference

| Method | Endpoint                | Auth | Description              |
|--------|------------------------|------|--------------------------|
| POST   | /api/v1/auth/register  | ✗    | Create account           |
| POST   | /api/v1/auth/login     | ✗    | Login + get tokens       |
| POST   | /api/v1/auth/refresh   | ✗    | Rotate refresh token     |
| POST   | /api/v1/auth/logout    | ✓    | Revoke refresh token     |
| POST   | /api/v1/auth/2fa/setup | ✓    | Get TOTP QR code         |
| POST   | /api/v1/auth/2fa/verify| ✓    | Enable 2FA               |
| POST   | /api/v1/auth/2fa/disable| ✓   | Disable 2FA              |
| GET    | /api/v1/users/me       | ✓    | Get current user profile |
| PATCH  | /api/v1/users/me       | ✓    | Update profile           |
| GET    | /api/v1/instruments    | ✗    | List tradable instruments |
| GET    | /api/v1/market/:symbol/candles | ✗ | OHLCV candles (timeframe, limit) |
| GET    | /api/v1/ws/prices?token= | ✓  | WebSocket live price ticks |
| POST   | /api/v1/orders         | ✓    | Place market/limit/stop order |
| GET    | /api/v1/orders         | ✓    | List orders              |
| DELETE | /api/v1/orders/:id     | ✓    | Cancel an open order     |
| GET    | /api/v1/positions      | ✓    | Open positions + live P&L |
| GET    | /api/v1/portfolio      | ✓    | Account summary (balance, equity) |
| GET    | /api/v1/portfolio/equity-curve | ✓ | Equity snapshots over time |
| GET    | /health                | ✗    | Health check             |
| GET    | /ready                 | ✗    | Readiness check          |

### Response envelope

All responses follow the same shape:

```json
{ "success": true,  "data": { ... } }
{ "success": false, "error": "message" }
```

---

## Make Commands

```bash
make dev            # Hot reload dev server
make build          # Compile binary
make test           # Run all tests
make test-race      # Tests + race detector
make coverage       # HTML coverage report
make lint           # Run golangci-lint
make migrate-up     # Apply migrations
make migrate-down   # Roll back one migration
make migrate-create NAME=add_wallets   # New migration pair
make docker-up      # Start Postgres + Redis
make docker-up-tools # + pgAdmin + Redis UI (port 5050, 8081)
make generate-secrets # Print random JWT secrets
```

---

## Environment Variables

See `.env.example` for the full list with documentation.

**Required for startup:**
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`

**Notable optional:**
- `MARKET_SEED_SOURCE` — `live` (default) anchors prices to real-world figures
  from free sources; `static` uses built-in seeds only. See *Market Data* below.
- Rate limits are relaxed automatically when `APP_ENV` is not `production`.

---

## Market Data — Real-World Prices

At startup the market service anchors each instrument's initial price to a
**real-world figure fetched from free, keyless public sources**, then random-walks
forward from that anchor (500ms ticks) and aggregates 1-minute OHLCV candles into
Postgres.

| Instrument(s)              | Source                          |
|----------------------------|---------------------------------|
| BTCUSD                      | Coinbase public spot            |
| EURUSD, GBPUSD, USDJPY, USDCHF, AUDUSD | Frankfurter (ECB reference rates) |
| XAUUSD (gold)              | gold-api (best-effort)          |

The fetch is **best-effort and non-blocking**: any symbol whose source is
unavailable keeps a realistic static fallback, so the platform is always usable —
including fully offline.

Controlled by `MARKET_SEED_SOURCE`:
- `live` (default) — fetch real prices at startup, fall back to static seeds on failure.
- `static` — skip the network entirely and use built-in realistic seeds.

---

## Database Migrations

Migrations live in `./migrations/` as numbered SQL pairs:

```
000001_create_users.up.sql
000001_create_users.down.sql
000002_create_trading_core.up.sql
...
```

Run, rollback, or create migrations:

```bash
make migrate-up
make migrate-down
make migrate-create NAME=add_feature_name
```

---

## Deployment

Push to `main` → GitHub Actions → Docker build → SSH deploy to VPS.

**Required GitHub Secrets:**

| Secret         | Description                          |
|----------------|--------------------------------------|
| `VPS_HOST`     | Server IP or hostname                |
| `VPS_USER`     | SSH user (e.g. `apex`)               |
| `VPS_SSH_KEY`  | Private SSH key (ed25519)            |
| `VPS_PORT`     | SSH port (default: 22)               |

**First-time VPS setup:**

```bash
# On your VPS as root:
curl -fsSL https://raw.githubusercontent.com/apex-trading/apex-backend/main/scripts/bootstrap-vps.sh | bash
```

---

## Architecture Decisions

- **Fiber over Gin** — lower memory footprint, fasthttp underneath, good WS support
- **sqlx + SQLC** over ORM — explicit SQL, full control, no magic
- **golang-migrate** — database-first approach, migrations are source of truth
- **Redis for refresh tokens** — enables instant revocation without DB query on every request
- **Structured logging** — JSON in production, coloured in development; never fmt.Println in production code
