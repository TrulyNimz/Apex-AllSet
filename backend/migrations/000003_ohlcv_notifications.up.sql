-- Migration: 003_ohlcv_notifications
-- OHLCV candlestick storage + in-app notifications

-- ── OHLCV ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ohlcv (
    symbol     VARCHAR(20)   NOT NULL REFERENCES instruments(symbol) ON DELETE CASCADE,
    timeframe  VARCHAR(10)   NOT NULL CHECK (timeframe IN ('1m','5m','15m','1h','4h','1d')),
    open_time  TIMESTAMPTZ   NOT NULL,
    open       DECIMAL(18,6) NOT NULL,
    high       DECIMAL(18,6) NOT NULL,
    low        DECIMAL(18,6) NOT NULL,
    close      DECIMAL(18,6) NOT NULL,
    volume     DECIMAL(18,6) NOT NULL DEFAULT 0,

    PRIMARY KEY (symbol, timeframe, open_time)
);

CREATE INDEX IF NOT EXISTS idx_ohlcv_lookup
    ON ohlcv (symbol, timeframe, open_time DESC);

-- ── Notifications ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       VARCHAR(50)   NOT NULL DEFAULT 'info',
    title      TEXT          NOT NULL,
    body       TEXT          NOT NULL DEFAULT '',
    read       BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notifications (user_id, created_at DESC)
    WHERE read = FALSE;

CREATE INDEX IF NOT EXISTS idx_notifications_user
    ON notifications (user_id, created_at DESC);
