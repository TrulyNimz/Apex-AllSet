-- Migration: 002_create_trading_core
-- Instruments, wallets, orders, positions tables.

-- ── Instruments ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS instruments (
    symbol      VARCHAR(20)     PRIMARY KEY,
    base        VARCHAR(10)     NOT NULL,
    quote       VARCHAR(10)     NOT NULL,
    pip_size    DECIMAL(18,10)  NOT NULL DEFAULT 0.0001,
    min_qty     DECIMAL(18,6)   NOT NULL DEFAULT 1000,
    is_active   BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

INSERT INTO instruments (symbol, base, quote, pip_size, min_qty) VALUES
    ('EURUSD', 'EUR', 'USD', 0.0001,  1000),
    ('GBPUSD', 'GBP', 'USD', 0.0001,  1000),
    ('USDJPY', 'USD', 'JPY', 0.01,    1000),
    ('USDCHF', 'USD', 'CHF', 0.0001,  1000),
    ('AUDUSD', 'AUD', 'USD', 0.0001,  1000),
    ('XAUUSD', 'XAU', 'USD', 0.01,    1),
    ('BTCUSD', 'BTC', 'USD', 1.0,     0.001)
ON CONFLICT DO NOTHING;

-- ── Wallets (paper money: $100k per user) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallets (
    id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    currency    VARCHAR(10)     NOT NULL DEFAULT 'USD',
    balance     DECIMAL(18,6)   NOT NULL DEFAULT 100000.00,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, currency)
);

-- ── Orders ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
    id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol      VARCHAR(20)     NOT NULL REFERENCES instruments(symbol),
    side        VARCHAR(4)      NOT NULL CHECK (side IN ('buy', 'sell')),
    type        VARCHAR(10)     NOT NULL CHECK (type IN ('market', 'limit', 'stop')),
    quantity    DECIMAL(18,6)   NOT NULL CHECK (quantity > 0),
    price       DECIMAL(18,6),
    fill_price  DECIMAL(18,6),
    status      VARCHAR(20)     NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'open', 'filled', 'cancelled', 'rejected')),
    filled_at   TIMESTAMPTZ,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_user   ON orders (user_id, created_at DESC);
CREATE INDEX idx_orders_symbol ON orders (symbol);
CREATE INDEX idx_orders_status ON orders (status) WHERE status IN ('pending', 'open');

-- ── Positions (net model: positive qty = long, negative = short) ───────────────
CREATE TABLE IF NOT EXISTS positions (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol          VARCHAR(20)     NOT NULL REFERENCES instruments(symbol),
    quantity        DECIMAL(18,6)   NOT NULL,
    avg_price       DECIMAL(18,6)   NOT NULL,
    realized_pnl    DECIMAL(18,6)   NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, symbol)
);

CREATE INDEX idx_positions_user ON positions (user_id);

-- ── Triggers ──────────────────────────────────────────────────────────────────
CREATE TRIGGER wallets_updated_at
    BEFORE UPDATE ON wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER positions_updated_at
    BEFORE UPDATE ON positions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
