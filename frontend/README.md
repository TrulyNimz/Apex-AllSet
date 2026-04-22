# Apex Trading — Frontend

> React 19 + TypeScript SPA for the Apex multi-asset trading platform.

## Stack

| Layer           | Technology                              |
|----------------|-----------------------------------------|
| Framework      | React 19 + TypeScript (strict)          |
| Build          | Vite 5 + SWC                            |
| Styling        | Tailwind CSS (custom Apex design tokens)|
| State          | Zustand (global) + React Query (server) |
| HTTP           | Axios with JWT interceptor + auto-refresh |
| WebSocket      | Custom WS client with exponential backoff |
| Charts         | TradingView Lightweight Charts          |
| Forms          | React Hook Form + Zod validation        |
| Animation      | Framer Motion                           |
| Routing        | React Router v6                         |
| Notifications  | React Hot Toast                         |

---

## Project Structure

```
apex-frontend/src/
├── app/
│   └── App.tsx              # Router + route guards
├── components/
│   ├── ui/                  # Reusable primitives: Button, Input, Badge, Modal
│   ├── charts/              # TradingView chart wrapper, indicators
│   ├── trading/             # OrderPanel, OrderBook, PositionTable
│   ├── portfolio/           # PortfolioSummary, PnLChart, ExposureRing
│   └── layout/              # AppLayout (sidebar + topbar), AuthLayout
├── features/
│   ├── auth/                # LoginPage, RegisterPage, 2FA flow
│   ├── dashboard/           # DashboardPage: watchlist + overview
│   ├── trading/             # TradingPage: chart + order panel
│   ├── portfolio/           # PortfolioPage: positions + history
│   ├── journal/             # JournalPage: trade log + analytics
│   └── settings/            # SettingsPage: profile, security, preferences
├── hooks/
│   ├── useAuth.ts           # Login, register, logout mutations
│   ├── useTick.ts           # WS price subscription hook
│   └── useOrders.ts         # Order CRUD queries (Phase 2)
├── lib/
│   ├── api-client.ts        # Axios instance + JWT interceptor
│   └── ws-client.ts         # WebSocket singleton with reconnect
├── services/
│   └── auth.service.ts      # Typed API calls per domain
├── store/
│   ├── auth.store.ts        # User + token state (persisted)
│   └── market.store.ts      # Live tick data from WebSocket
├── types/
│   └── index.ts             # Shared TypeScript interfaces
└── styles/
    └── globals.css          # Tailwind base + custom CSS vars
```

---

## Quick Start

### Prerequisites
- Node.js 22+
- npm 10+
- Backend running on :8080 (see apex-backend README)

### 1. Install dependencies

```bash
npm ci
```

### 2. Configure environment

```bash
cp .env.example .env.local
# VITE_API_URL defaults to http://localhost:8080
```

### 3. Start dev server

```bash
npm run dev
# Opens at http://localhost:5173
# API calls proxied to backend — no CORS issues
```

---

## Available Scripts

```bash
npm run dev      # Dev server with HMR
npm run build    # Type-check + production build
npm run preview  # Preview production build locally
npm run lint     # ESLint
npm run format   # Prettier
```

---

## Design System

Apex uses a custom dark-first design system defined in `tailwind.config.js`.

### Colour Tokens

| Token      | Hex         | Usage                        |
|-----------|-------------|------------------------------|
| `void`    | `#050608`   | Page background              |
| `deep`    | `#0a0c10`   | Sidebar, nav                 |
| `surface` | `#0f1117`   | Cards, panels                |
| `panel`   | `#141820`   | Elevated panels              |
| `gold`    | `#c9a84c`   | Primary accent, CTA          |
| `teal`    | `#00d4aa`   | Profit, success, gain        |
| `danger`  | `#ff4757`   | Loss, error, sell            |

### Typography

| Font            | Usage                     |
|----------------|---------------------------|
| DM Sans        | Body, UI labels           |
| DM Mono        | Numbers, codes, monospace |
| Instrument Serif | Editorial headings       |
| Bebas Neue     | Large display numbers     |

### Price Flash Animations

Use the `animate-tick-up` / `animate-tick-down` Tailwind classes on price cells when a tick arrives. The `useTick` hook returns both `tick` and `prevTick` so you can compare.

---

## State Management

### Zustand stores

- `useAuthStore` — user identity, access/refresh tokens (persisted to localStorage)
- `useMarketStore` — live price ticks from WebSocket (in-memory, not persisted)

### React Query

Used for all server state: user profile, orders, positions, watchlists.
Keeps server data fresh with background refetching, optimistic updates, and request deduplication.

---

## WebSocket

The `wsClient` singleton in `src/lib/ws-client.ts` manages one persistent WebSocket connection for the entire session. It:

- Reconnects automatically with exponential backoff (max 30s)
- Re-subscribes to all active symbols after reconnect
- Sends keep-alive pings every 20 seconds
- Exposes `subscribe(symbol, handler)` returning an unsubscribe function

Use the `useTick` hook — it manages subscribe/unsubscribe lifecycle automatically:

```tsx
import { useTick } from '@hooks/useTick'

function PriceCell({ symbol }: { symbol: string }) {
  const { tick, prevTick } = useTick(symbol)
  const isUp = tick && prevTick && tick.mid > prevTick.mid

  return (
    <span className={isUp ? 'animate-tick-up text-teal' : 'animate-tick-down text-danger'}>
      {tick?.mid.toFixed(5) ?? '—'}
    </span>
  )
}
```

---

## Deployment

Push to `main` → GitHub Actions → Docker build → SSH deploy to VPS.

The Dockerfile builds the Vite app and serves it via Nginx with:
- SPA fallback (`try_files $uri /index.html`)
- API proxy to backend (`/api/` → `http://backend:8080`)
- WebSocket proxy (`/api/v1/ws/` with Upgrade header)
- Immutable asset caching (1 year)
- Security headers (CSP, HSTS, X-Frame-Options)
