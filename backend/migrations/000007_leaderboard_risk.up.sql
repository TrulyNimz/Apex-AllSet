-- Migration: 007_leaderboard_risk
-- Leaderboard opt-in flag, risk profiles, and risk event audit log.

ALTER TABLE users ADD COLUMN IF NOT EXISTS leaderboard_opt_in BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE risk_profiles (
    user_id               UUID         PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    max_drawdown_pct      DECIMAL(5,2) NOT NULL DEFAULT 20.0,
    max_position_size_pct DECIMAL(5,2) NOT NULL DEFAULT 10.0,
    max_open_positions    SMALLINT     NOT NULL DEFAULT 10,
    daily_loss_limit_pct  DECIMAL(5,2) NOT NULL DEFAULT 5.0,
    trading_halted        BOOLEAN      NOT NULL DEFAULT FALSE,
    halt_reason           TEXT,
    peak_equity           DECIMAL(18,6) NOT NULL DEFAULT 100000.0,
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE risk_events (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type  VARCHAR(50) NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_risk_events_user ON risk_events (user_id, created_at DESC);

-- Pending limit/stop orders index for efficient tick-driven evaluation
CREATE INDEX IF NOT EXISTS idx_orders_pending_open
    ON orders (symbol, type, side)
    WHERE status = 'open' AND type IN ('limit', 'stop');
