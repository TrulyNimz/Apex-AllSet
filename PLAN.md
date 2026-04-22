# Apex Trading — Implementation Plan (v2)

> Last updated: 2026-04-22
> Status: Phase 0 queued — awaiting build confirmation

---

## Current State Summary

Both backend and frontend are substantially built beyond the original Phase 1 plan.

### Backend — complete
- All `pkg/` packages (logger, response, validator, crypto)
- All `internal/` domains: auth, config, database, middleware, server, user, market, order, portfolio, risk, alert, leaderboard, notification, watchlist
- All migrations 001–005
- Dockerfile, Makefile, .air.toml, .env.example, docker-compose.yml

### Frontend — complete (builds clean)
- All scaffolding: package.json, vite.config, tsconfig, tailwind.config, index.html
- All stores, services, hooks, UI components, layout components, feature pages
- `src/lib/api-client.ts`, `src/lib/ws-client.ts`

### Known gaps
- `OrderBook.tsx`, `ExposureRing.tsx`, `PnLChart.tsx` — not yet created
- `Tooltip.tsx`, `ConfirmModal.tsx` — not yet created
- `alert`, `leaderboard`, `risk`, `watchlist` domains built but NOT wired into server.go
- Several bugs documented in Phase 0 below

---

## Design Language Specification

### Color Semantics

| Token | Hex (dark) | Usage rule |
|---|---|---|
| `void` | `#050608` | Page background only. Never use as a component background. |
| `deep` | `#0a0c10` | Sidebar, topbar, modal overlays, full-bleed section backgrounds |
| `surface` | `#0f1117` | Hover states, input backgrounds, code blocks, secondary panels |
| `panel` | `#141820` | Cards, modals, dropdowns, table backgrounds |
| `border` | `#1e2330` | All dividers, input borders, card outlines. 1px only. |
| `muted` | `#6b7280` | Placeholder text, labels, helper text, secondary metadata |
| `gold` | `#c9a84c` | Primary CTA, logo, active nav state, selection highlight, profit indicators |
| `teal` | `#00d4aa` | Buy side, positive PnL, success states, connection indicator |
| `danger` | `#ff4757` | Sell side, negative PnL, error states, halt indicators |
| `warning` | `#ffa502` | Pending orders, degraded connection, KYC pending badge |

**Opacity scale for emphasis layers:**
- Backgrounds: `/10` (subtle fill), `/20` (hover), `/30` (active/selected)
- Borders: `/20` (default), `/40` (hover)
- Text: full for values/prices, `/80` for labels, `/60` for disabled

**Rule:** Never mix `gold` and `teal` in the same interactive element. `gold` = neutral primary. `teal` = buy/long. `danger` = sell/short.

---

### Typography

| Role | Font | Weight | Size | Use case |
|---|---|---|---|---|
| Display / Logo | Bebas Neue | 400 | `text-2xl`–`text-5xl` | APEX wordmark, section heroes, large stat numbers |
| Body UI | DM Sans | 400/500/600 | `text-xs`–`text-base` | All prose, labels, nav items, buttons |
| Prices / Data | DM Mono | 400/700 | `text-xs`–`text-2xl` | All prices, quantities, PnL values, timestamps |
| Editorial | Instrument Serif | 400 | `text-sm`–`text-lg` | Journal entry text only |

**Price formatting rules:**
- Forex majors: 5 decimal places — `1.08435`
- JPY pairs: 3 decimal places — `153.420`
- Metals (XAUUSD): 2 decimal places — `2334.50`
- Crypto (BTCUSD): 2 decimal places — `65,430.00`
- PnL values: always show sign `+$124.50` / `-$87.20`, colored `teal`/`danger`
- Percentages: 2 decimal places with sign `+2.14%` / `-0.87%`

---

### Component Anatomy Rules

**Panels / Cards:**
```
bg-panel border border-border rounded-xl
```
- Header row: `px-5 py-3 border-b border-border` — `text-sm font-semibold text-white`
- Content area: `p-5`
- Footer row: `px-5 py-3 border-t border-border bg-surface/50`

**Data tables:**
- Header: `text-xs font-medium text-muted uppercase tracking-wide`
- Rows: `border-b border-border hover:bg-surface transition-colors`
- Numeric columns: always `text-right font-mono`
- Symbol columns: `text-left font-mono font-semibold text-white`

**Modals:** Always use existing `Modal.tsx`. No custom backdrop implementations.

**Empty states:** Centered, muted SVG icon (40px), `text-sm text-muted` message, optional `Button variant="secondary"`.

**Loading states:** `Spinner` inside the loading panel. Skeleton: `animate-pulse bg-surface rounded` for tables and chart placeholders.

---

### Animation & Motion Rules

| Interaction | Spec |
|---|---|
| Price tick up | `flash-up` class (0.5s ease-out teal bg) |
| Price tick down | `flash-down` class (0.5s ease-out danger bg) |
| Modal enter | Framer: `opacity 0→1` + `scale 0.96→1`, `duration: 0.15s` |
| Modal exit | Framer: `opacity 1→0` + `scale 1→0.96`, `duration: 0.1s` |
| Panel slide-in | Framer: `x: 20→0` + `opacity 0→1`, `duration: 0.2s` |
| Toast | React Hot Toast, `top-right`, theme: `bg-panel border border-border` |
| Hover transitions | Always `transition-colors duration-150` — never `transition-all` |

---

## Phase 0 — Bug Fixes (must land before any new features)

### BUG-01: Risk check never enforced
**File:** `backend/internal/order/order.go` — `PlaceOrder()`

`s.riskSvc` is injected via `SetRiskService()` but `placeMarket` and `placePending` never call it. Max drawdown halt, position limits, daily loss limit — all bypassed.

**Fix:** In `PlaceOrder()` before the type switch:
```go
if s.riskSvc != nil {
    balance, _ := s.repo.GetWalletBalance(ctx, userID)
    result, err := s.riskSvc.Check(ctx, userID, req.Symbol, balance)
    if err == nil && !result.Allowed {
        return nil, fiber.NewError(fiber.StatusForbidden, result.Reason)
    }
}
```

---

### BUG-02: Wallet never debited or credited
**File:** `backend/internal/order/order.go` — `placeMarket()`

Wallet balance stays at $100k forever. Orders have no cash cost.

**New repo method:**
```go
func (r *Repository) AdjustBalance(ctx context.Context, userID string, delta float64) error {
    _, err := r.db.ExecContext(ctx,
        `UPDATE wallets SET balance = balance + $1 WHERE user_id=$2 AND currency='USD'`,
        delta, userID)
    return err
}
```

**Insufficient funds check** (buy side only, before fill):
```go
balance, _ := r.repo.GetWalletBalance(ctx, userID)
if req.Side == "buy" && balance < fillPrice*req.Quantity {
    return nil, fiber.NewError(fiber.StatusBadRequest, "insufficient funds")
}
```

**After fill:** `AdjustBalance(ctx, userID, -(fillPrice * qty))` for buys, `+(fillPrice * qty)` for sells.

---

### BUG-03: alert / leaderboard / risk / watchlist not wired in server.go
**File:** `backend/internal/server/server.go`

All four domains are built and correct but have no routes. Fix: import all four packages, wire services, register routes.

**New routes to add:**
```
GET  /api/v1/risk/profile       → riskHandler.GetProfile
PATCH /api/v1/risk/profile      → riskHandler.Update
POST /api/v1/risk/halt/reset    → riskHandler.ResetHalt
GET  /api/v1/risk/events        → riskHandler.GetEvents

POST   /api/v1/alerts           → alertHandler.Create
GET    /api/v1/alerts           → alertHandler.List
DELETE /api/v1/alerts/:id       → alertHandler.Delete

GET  /api/v1/leaderboard        → lbHandler.Top        (public)
GET  /api/v1/leaderboard/me     → lbHandler.MyRank     (protected)
POST /api/v1/leaderboard/opt-in → lbHandler.SetOptIn   (protected)

GET    /api/v1/watchlist        → wlHandler.List
POST   /api/v1/watchlist        → wlHandler.Add
DELETE /api/v1/watchlist/:symbol→ wlHandler.Remove
```

---

### BUG-04: Daily PnL SQL formula wrong
**File:** `backend/internal/risk/risk.go:147`

Current formula computes gross cash flow, not PnL. Fix requires joining orders to positions for avg_price — or better, storing `fill_pnl` on the order row (done in Phase 2 migration).

Interim fix: compute from the realized_pnl accumulated in positions vs the value at start of day (approximate). Full fix lands when Phase 2 migration adds `fill_pnl` column.

---

### BUG-05: Portfolio equity formula
**File:** `backend/internal/portfolio/portfolio.go:83`

`Equity = balance + unrealized` is correct in principle but only works after BUG-02 is fixed (wallet balance actually changes). No code change needed — resolves automatically once BUG-02 lands.

---

## Phase 1 — Multi-Timeframe Candles

### 1.1 Backend: Aggregation rewrite
**File:** `backend/internal/market/market.go`

Replace single-timeframe `map[string]*candleState` with:
```go
var timeframes = []struct {
    name     string
    duration time.Duration
}{
    {"1m", time.Minute}, {"5m", 5 * time.Minute}, {"15m", 15 * time.Minute},
    {"1h", time.Hour},   {"4h", 4 * time.Hour},   {"1d", 24 * time.Hour},
}
type candleKey struct{ symbol, timeframe string }
candles map[candleKey]*candleState
```

`aggregateTick` loops all timeframes. Existing DB schema already supports this (composite unique key on `symbol, timeframe, open_time`).

### 1.2 Frontend: Timeframe selector
**File:** `frontend/src/components/charts/PriceChart.tsx`

Add `timeframe` state (`'1m' | '5m' | '15m' | '1h' | '4h' | '1d'`). Button strip above chart:
- Inactive: `text-muted text-xs font-mono px-2 py-1 hover:text-white`
- Active: `text-gold bg-gold/10 rounded px-2 py-1 text-xs font-mono`

---

## Phase 2 — Order Type Expansion

### 2.1 Backend: Migration 006
**File:** `backend/migrations/000006_order_tpsl.up.sql`

```sql
ALTER TABLE orders
    ADD COLUMN stop_loss       DECIMAL(18,6),
    ADD COLUMN take_profit     DECIMAL(18,6),
    ADD COLUMN time_in_force   VARCHAR(3) NOT NULL DEFAULT 'GTC'
                               CHECK (time_in_force IN ('GTC','IOC','FOK','GTD')),
    ADD COLUMN expires_at      TIMESTAMPTZ,
    ADD COLUMN fill_pnl        DECIMAL(18,6),
    ADD COLUMN parent_order_id UUID REFERENCES orders(id);
```

`fill_pnl` — computed at fill time from `(fillPrice - avgEntryPrice) * quantity`. Permanently fixes BUG-04.
`parent_order_id` — links TP/SL child orders to their parent entry order for OCO grouping.

### 2.2 Backend: TP/SL auto-orders + OCO
**File:** `backend/internal/order/order.go`

After any order fills, if `StopLoss` or `TakeProfit` is set:
```go
func (s *Service) createTPSLOrders(ctx context.Context, parent *Order)
// Creates pending child limit (TP) and/or stop (SL) orders
// Both share parent_order_id = parent.ID

func (s *Service) cancelSiblingOrder(ctx context.Context, filledOrderID string)
// When a TP or SL fills, cancel the sibling (OCO)
```

### 2.3 Frontend: OrderPanel tabs
**File:** `frontend/src/components/trading/OrderPanel.tsx`

Three-tab UI: `[ Market ] [ Limit ] [ Stop ]`

Tab strip: `flex gap-1 bg-surface rounded-lg p-1`
- Active tab: `flex-1 py-1.5 text-xs font-semibold rounded-md bg-panel text-white shadow-sm`
- Inactive tab: `flex-1 py-1.5 text-xs font-semibold rounded-md text-muted hover:text-white`

**Limit / Stop tabs** add `Price` input below `Quantity`.

**TP/SL collapsible section** (all tabs):
```
[ + Add Take Profit / Stop Loss ]  ← ghost button, expands on click
```
Expanded: two optional price inputs. Pre-suggest: TP = `mid + 20 pips`, SL = `mid - 10 pips`.

**Position sizing preview strip** (between inputs and submit):
```
┌──────────────────────────────────────────────┐
│  Pip Value  $1.00  │  Risk    $10.00 (0.01%) │
│  Notional   $10,000│  Margin  $100.00         │
└──────────────────────────────────────────────┘
```
Layout: `grid grid-cols-2 gap-px bg-border rounded-lg overflow-hidden`
Each cell: `bg-surface px-3 py-2` — label `text-xs text-muted`, value `text-sm font-mono text-white`

### 2.4 Frontend: OrderBook.tsx (new file)
**File:** `frontend/src/components/trading/OrderBook.tsx`

Synthetic depth — built from current spread + simulated levels at ±1, ±2, ±3, ±5, ±8, ±13 pips.

```
┌── ORDER BOOK ──────────────────────┐
│  ASK              │  DEPTH BAR     │
│  1.08445  1,200   ████████         │
│  1.08440    800   █████            │
│  1.08435    500   ████             │
│  ────── SPREAD 0.00020 ──────────  │
│  1.08415    400   ████             │
│  1.08410    900   ██████           │
│  1.08405  1,500   ████████████     │
│  BID              │  DEPTH BAR     │
└────────────────────────────────────┘
```

Depth bars: absolutely positioned `div`, `right-0`, width proportional to volume.
Ask rows: `teal/10` fill. Bid rows: `danger/10` fill.
Spread divider: `border-y border-border bg-surface/50 text-center text-xs text-muted font-mono py-1`
Click a price level → auto-populates Limit order panel price field.

Add `OrderBook` to `TradingPage.tsx` alongside `OrderPanel` in the right rail.

---

## Phase 3 — Frontend Gaps

### 3.1 ExposureRing.tsx
**File:** `frontend/src/components/portfolio/ExposureRing.tsx`

SVG donut chart (no external lib). Sectors from `GET /positions` grouped by symbol, sized by notional (abs(qty) × current_price).

Color palette:
- Forex majors: `#c9a84c`, `#b5922e`, `#9a7a22`, `#7d6218` (gold shades)
- Metals (XAUUSD): `teal`
- Crypto (BTCUSD): `warning`

Center text: open position count in `font-display text-2xl text-white`.
Legend: right of ring — 8px colored square + symbol + percentage.
Empty state: dashed ring outline + "No open positions" center text.

### 3.2 PnLChart.tsx
**File:** `frontend/src/components/portfolio/PnLChart.tsx`

TradingView Lightweight Charts area series. Data from `GET /portfolio/equity-curve?days=N`.

Fill color: `teal/30 → teal/0` when above starting equity; `danger/30 → danger/0` when below.
Zero line: `PriceLine` at $100,000.
Range selector: `[ 7D ] [ 30D ] [ 90D ] [ ALL ]` — same tab strip style as timeframe selector.
Tooltip: date + equity + return % from start.

### 3.3 LeaderboardPage.tsx
**File:** `frontend/src/features/leaderboard/LeaderboardPage.tsx`
**Route:** `/leaderboard` — add to App.tsx and Sidebar.tsx nav

Top section (your rank card):
- Container: `bg-gold/10 border border-gold/20 rounded-xl p-4`
- Rank: `font-display text-4xl text-gold`
- Return: `font-mono text-xl` colored `teal`/`danger` by sign
- Opt-in toggle: pill toggle, track `bg-surface border border-border`, thumb `bg-gold`

Table: standard panel table.
Return bars: `div bg-teal/20 h-1 rounded-full` width proportional to max return in set.
`refetchInterval: 30_000`

### 3.4 AlertsPage.tsx
**File:** `frontend/src/features/alerts/AlertsPage.tsx`
**Route:** `/alerts` — add to App.tsx and Sidebar.tsx nav

Create form (top panel):
- Symbol dropdown from `useInstruments()`
- Direction toggle: `[ ABOVE ↑ ]` / `[ BELOW ↓ ]` — same two-button style as Buy/Sell
- Price input (DM Mono), pre-populated from market store
- Optional message field

Active alerts list:
- Direction: `▲` `teal` for above, `▼` `danger` for below
- `× Delete` ghost button per row
- Triggered alerts: `opacity-50`, strikethrough price, `✓ Triggered at HH:MM:SS` in muted text

### 3.5 Risk Controls tab in SettingsPage
**File:** `frontend/src/features/settings/SettingsPage.tsx`

Add 4th tab "Risk Controls". Content:
- Numeric inputs for: Max Drawdown %, Daily Loss Limit %, Max Open Positions, Max Position Size %
- `Input.tsx` gets new optional `rightElement` prop for `%` / unit suffix
- Trading status chip: `bg-teal/10 text-teal border border-teal/20` (active) / `bg-danger/10 text-danger border border-danger/20` (halted)
- `Button variant="danger"` to call `POST /risk/halt/reset` — only visible when halted
- Risk events table: `text-xs font-mono`, event type as colored `Badge`, description truncated to 50 chars

---

## Phase 4 — Leaderboard Integration in Portfolio Snapshot

**File:** `backend/internal/portfolio/portfolio.go`

Add `LeaderboardService` interface:
```go
type LeaderboardService interface {
    PushScore(ctx context.Context, userID string, equity float64)
}
```

Inject via `NewService(...)`. After each user's equity is computed in `snapshotAllUsers()`:
```go
if s.lbSvc != nil {
    s.lbSvc.PushScore(ctx, uid, summary.Equity)
}
```

---

## Phase 5 — Real Price Feed

**Architecture:** Hub becomes feed-agnostic via a `FeedAdapter` interface.

```go
type FeedAdapter interface {
    Connect(ctx context.Context, symbols []string, out chan<- Tick) error
    Name() string
}
```

Two implementations:
1. `SimulatorFeed` — current random walk, always available as fallback
2. `PolygonFeed` — Polygon.io WebSocket (`wss://socket.polygon.io/forex`), free tier covers all forex + crypto symbols

Config:
```env
MARKET_FEED=simulator   # or "polygon"
POLYGON_API_KEY=
```

`runSimulator()` renamed `runFeed()`, dispatches to configured adapter. No frontend changes needed.

---

## Phase 6 — Trade Journal (full implementation)

### 6.1 Backend: Migration 007
**File:** `backend/migrations/000007_journal.up.sql`

```sql
CREATE TABLE IF NOT EXISTS trade_notes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    note        TEXT NOT NULL,
    tags        TEXT[],
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, order_id)
);
```

### 6.2 Backend: Journal endpoints
```
GET  /api/v1/journal/trades            → filled orders + trade_notes joined
POST /api/v1/journal/trades/:id/note   → upsert note + tags
GET  /api/v1/journal/analytics         → win_rate, avg_rr, profit_factor, best/worst trade
GET  /api/v1/journal/trades/export     → CSV stream (Content-Disposition: attachment)
```

### 6.3 Frontend: JournalPage.tsx completion
**File:** `frontend/src/features/journal/JournalPage.tsx`

Analytics strip: `grid grid-cols-4 gap-px bg-border rounded-xl overflow-hidden`
- Each cell: `bg-panel px-4 py-3` — stat label `text-xs text-muted`, value `font-display text-2xl`

Filters: Symbol dropdown, date range, Win/Loss filter, Export CSV button (`<a href>` download link)

Trade table: Date, Symbol, Side badge, Qty, Entry, Exit, PnL (colored), Tags
- PnL positive: `text-teal font-mono`
- PnL negative: `text-danger font-mono`

Expanded row (Framer `AnimatePresence` slide-down):
- Markdown textarea: `font-serif text-sm bg-surface border border-border rounded-lg p-3`
- Tag input chips: `bg-gold/10 text-gold text-xs rounded-full px-2 py-0.5`
- Save button: `Button variant="secondary" size="sm"`

---

## Phase 7 — Production Readiness

### 7.1 Missing UI components
- `Tooltip.tsx` — Radix UI `@radix-ui/react-tooltip`, styled `bg-panel border border-border text-xs`
- `ConfirmModal.tsx` — generic destructive-action modal (order cancel, account reset)

### 7.2 Dark/Light theme toggle
**File:** `frontend/src/components/layout/Topbar.tsx`

Sun/moon icon button toggles `html.light` class on `document.documentElement`. Reads/writes `theme.store.ts`. Persist in `localStorage`.

### 7.3 GitHub Actions CI/CD

**`.github/workflows/backend.yml`:** test (go test -race) → lint (golangci-lint) → docker build → GHCR push → SSH deploy
**`.github/workflows/frontend.yml`:** lint (eslint + tsc --noEmit) → build (vite, assert < 1MB) → GHCR push → SSH deploy

### 7.4 Playwright E2E Tests
- `e2e/auth.spec.ts` — register → login → 2FA setup
- `e2e/trade.spec.ts` — login → place market order → verify position → cancel
- `e2e/alerts.spec.ts` — create alert → verify in list → delete

### 7.5 Swagger / OpenAPI
Complete `swag init` annotations on all handlers. Add `make swagger` target to Makefile.

---

## Build Order

```
Phase 0  BUG-01  risk check wired in PlaceOrder
Phase 0  BUG-02  wallet debit/credit + insufficient funds check
Phase 0  BUG-03  wire alert/leaderboard/risk/watchlist in server.go
Phase 0  BUG-04  fix daily PnL SQL (interim fix)
Phase 0  BUG-05  verify equity formula after BUG-02 (no code change)
         smoke test: docker compose up → register → login → place order → check balance decrements

Phase 1  backend  multi-timeframe candle aggregator (all 6 timeframes)
Phase 1  frontend timeframe selector in PriceChart

Phase 2  backend  migration 006 (TP/SL, fill_pnl, parent_order_id, time_in_force)
Phase 2  backend  TP/SL auto-order creation + OCO cancellation logic
Phase 2  frontend OrderPanel: Market/Limit/Stop tabs
Phase 2  frontend OrderPanel: TP/SL collapsible + position sizing strip
Phase 2  frontend OrderBook.tsx (new file, synthetic depth)
Phase 2  frontend TradingPage: add OrderBook to right rail

Phase 3  frontend ExposureRing.tsx
Phase 3  frontend PnLChart.tsx
Phase 3  frontend LeaderboardPage + route + sidebar nav link
Phase 3  frontend AlertsPage + route + sidebar nav link
Phase 3  frontend Risk Controls tab in SettingsPage

Phase 4  backend  LeaderboardService interface + inject into portfolio snapshot job

Phase 5  backend  FeedAdapter interface + SimulatorFeed refactor
Phase 5  backend  PolygonFeed implementation
Phase 5  config   MARKET_FEED + POLYGON_API_KEY env vars

Phase 6  backend  migration 007 (trade_notes)
Phase 6  backend  journal service + handler (analytics, export, note upsert)
Phase 6  frontend JournalPage full implementation

Phase 7  frontend Tooltip.tsx + ConfirmModal.tsx
Phase 7  frontend dark/light toggle in Topbar
Phase 7  CI/CD    GitHub Actions workflows (backend + frontend)
Phase 7  e2e      Playwright test suite (auth, trade, alerts)
Phase 7  docs     Swagger annotations complete + make swagger target
```

---

## File Change Summary

| Phase | Backend | Frontend | Migrations |
|---|---|---|---|
| 0 (bugs) | 3 edits (order, server, risk) | 0 | 0 |
| 1 (candles) | 1 edit (market) | 1 edit (PriceChart) | 0 |
| 2 (order types) | 1 edit (order) | 3 files (OrderPanel, OrderBook, TradingPage) | 1 (006) |
| 3 (frontend gaps) | 0 | 5 files (ExposureRing, PnLChart, Leaderboard, Alerts, Settings) | 0 |
| 4 (lb integration) | 1 edit (portfolio) | 0 | 0 |
| 5 (price feed) | 2 new (feed adapter, polygon impl) | 0 | 0 |
| 6 (journal) | 2 new (service, handler) | 1 edit (JournalPage) | 1 (007) |
| 7 (prod) | CI/CD yml files | 2 new + 1 edit | 0 |
