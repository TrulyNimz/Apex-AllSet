-- Migration: 005_watchlists
-- Per-user symbol watchlists with ordered items.

CREATE TABLE watchlists (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       VARCHAR(100) NOT NULL DEFAULT 'My Watchlist',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, name)
);

CREATE TABLE watchlist_items (
    watchlist_id UUID        NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
    symbol       VARCHAR(20) NOT NULL REFERENCES instruments(symbol),
    position     SMALLINT    NOT NULL DEFAULT 0,
    added_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (watchlist_id, symbol)
);

CREATE INDEX idx_watchlist_items_list ON watchlist_items (watchlist_id, position);
