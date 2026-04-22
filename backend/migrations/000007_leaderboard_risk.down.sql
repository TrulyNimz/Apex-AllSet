DROP INDEX IF EXISTS idx_orders_pending_open;
DROP TABLE IF EXISTS risk_events;
DROP TABLE IF EXISTS risk_profiles;
ALTER TABLE users DROP COLUMN IF EXISTS leaderboard_opt_in;
