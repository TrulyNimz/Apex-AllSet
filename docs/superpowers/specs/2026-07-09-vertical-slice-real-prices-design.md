# Apex AllSet — Vertical Slice + Real-World Prices — Design

**Date:** 2026-07-09
**Status:** Approved (user requested autonomous execution)

## Goal

Make the platform viewable and live in a browser by (1) building the missing
React frontend as a working **vertical slice** — Login → Dashboard (live
watchlist) → Trading (real-time candlestick chart + order panel + open
positions) — and (2) re-anchoring the backend price simulator to **real-world
market figures from free, keyless sources**.

## Context

- **Backend (Go/Fiber): complete.** Auth (JWT access+refresh, TOTP 2FA), users,
  market (WebSocket price simulator + OHLCV aggregation), orders, positions,
  portfolio, notifications, watchlist, alerts, leaderboard, risk. 7 SQL
  migrations. API envelope: `{success, data}` / `{success, error}`.
- **Frontend: empty.** README documents a `src/` tree but no `src/` exists;
  `index.html` references `/src/main.tsx`. `npm run dev` renders blank. The
  entire SPA must be built.
- Prices today: hardcoded stale seeds (BTCUSD 65000, XAUUSD 2330, EURUSD 1.085)
  with a 500ms random walk.

## API surface targeted (from `internal/server/server.go`)

- Public: `POST /api/v1/auth/register|login|refresh`, `GET /api/v1/instruments`,
  `GET /api/v1/market/:symbol/candles?timeframe&limit`.
- WebSocket: `GET /api/v1/ws/prices?token=<access>` — messages
  `{type: subscribe|unsubscribe|ping, symbol}`; server pushes
  `{type: tick, symbol, data: {bid,ask,mid,spread,timestamp}}`.
- Protected (Bearer access token): `GET/PATCH /users/me`, `POST /orders`,
  `GET /orders`, `DELETE /orders/:id`, `GET /positions`, `GET /portfolio`,
  `GET /portfolio/equity-curve`, notifications.

## Frontend architecture

Build from scratch, following the README structure trimmed to the slice:

```
src/
  main.tsx, app/App.tsx            # bootstrap + router with auth guard
  lib/ api-client.ts               # axios + JWT interceptor + auto-refresh on 401
       ws-client.ts                # singleton WS, backoff reconnect, re-subscribe, ping
  store/ auth.store.ts             # user + tokens (persisted)
         market.store.ts           # live ticks (in-memory)
  hooks/ useAuth, useTick, useInstruments, useOrders, usePositions, usePortfolio
  services/ *.service.ts           # typed calls per domain
  types/index.ts                   # interfaces matching backend JSON
  components/ ui, charts, trading, layout
  features/ auth, dashboard, trading
  styles/globals.css               # Tailwind base + design tokens
```

Design system per README: dark (void/deep/surface/panel), accents gold/teal/
danger, DM Sans/Mono + display fonts, `lightweight-charts`, Framer Motion,
React Query (server state), Zustand (auth + live ticks).

## Data flow

- **Auth:** login/register → persist tokens → axios attaches access token; on
  401, refresh once then retry, else logout. WS authorised via `?token=`.
- **Market:** `useInstruments` → symbols; `useTick(symbol)` subscribes through
  the WS singleton; ticks land in `market.store`. Chart seeds from
  `/market/:symbol/candles`, then updates the forming candle from live ticks.
- **Trading:** order panel POSTs `/orders`; positions/portfolio via React Query;
  live P&L recomputed from current ticks; toast on fill.

## Real-world price sourcing (backend)

Resilient, free, keyless, graceful fallback:

- New `seed` unit in `internal/market`: on startup, best-effort fetch current
  spot per instrument from free keyless sources — crypto (BTCUSD) from a public
  exchange spot endpoint; FX (EUR/GBP/JPY/CHF/AUD USD) from an ECB-backed free
  FX API. Metals (XAUUSD) fall back to a refreshed realistic value where no free
  keyless source exists.
- **Fallback:** any fetch failure/timeout → refreshed static seeds (updated to
  current 2026 levels). Log which source anchored each symbol.
- The 500ms random-walk simulator is unchanged; it starts from real anchors.
- Config: `MARKET_SEED_SOURCE=live|static` (default `live`, static fallback).
  Non-blocking; never delays startup. No secrets. Works offline.
- Instruments table seeded (idempotent) so the watchlist is populated.

## Error handling

Axios 401→refresh→retry→logout; WS exponential backoff (max 30s) + re-subscribe
+ 20s ping; React Query retry/stale config; Zod form validation; toasts for API
errors; backend seed fetch best-effort.

## Testing

- Backend: unit test for the seed fetcher (mocked HTTP source + fallback path);
  `go build ./...` and `go vet ./...` clean.
- Frontend: `tsc -b` + `vite build` pass; existing Playwright specs
  (`auth`, `trading`) as acceptance target where the slice covers them.
- Manual browser verification: register/login, ticking watchlist, live chart,
  place order, position + P&L update.

## Delivery / git

Repo attached to `github.com/TrulyNimz/Apex-AllSet` (main). Commit and push to
`main` incrementally as each unit lands. `.gitignore` already excludes `.env`,
`node_modules`, `dist`, binaries — no secrets committed.

## Out of scope (deferred to later cycles)

Journal, leaderboard, alerts, full settings, 2FA UI, KYC. Backends exist;
frontend follows later.
