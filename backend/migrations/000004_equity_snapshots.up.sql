-- Migration: 004_equity_snapshots
-- Stores periodic equity curve snapshots per user for charting.

CREATE TABLE IF NOT EXISTS equity_snapshots (
    id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    equity      DECIMAL(18,2) NOT NULL,
    balance     DECIMAL(18,2) NOT NULL,
    unrealized  DECIMAL(18,2) NOT NULL DEFAULT 0,
    realized    DECIMAL(18,2) NOT NULL DEFAULT 0,
    snapped_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equity_snapshots_user
    ON equity_snapshots (user_id, snapped_at DESC);
