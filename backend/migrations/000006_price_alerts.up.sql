-- Migration: 006_price_alerts
-- User-defined price threshold alerts delivered via notification service.

CREATE TABLE price_alerts (
    id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol       VARCHAR(20)   NOT NULL REFERENCES instruments(symbol),
    direction    VARCHAR(5)    NOT NULL CHECK (direction IN ('above', 'below')),
    price        DECIMAL(18,6) NOT NULL,
    message      TEXT,
    triggered    BOOLEAN       NOT NULL DEFAULT FALSE,
    triggered_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_user   ON price_alerts (user_id)  WHERE triggered = FALSE;
CREATE INDEX idx_alerts_symbol ON price_alerts (symbol)   WHERE triggered = FALSE;
