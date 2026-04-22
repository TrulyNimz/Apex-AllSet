-- Migration: 002_create_trading_core (down)
DROP TRIGGER IF EXISTS positions_updated_at ON positions;
DROP TRIGGER IF EXISTS orders_updated_at    ON orders;
DROP TRIGGER IF EXISTS wallets_updated_at   ON wallets;
DROP INDEX IF EXISTS idx_positions_user;
DROP INDEX IF EXISTS idx_orders_status;
DROP INDEX IF EXISTS idx_orders_symbol;
DROP INDEX IF EXISTS idx_orders_user;
DROP TABLE IF EXISTS positions;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS wallets;
DROP TABLE IF EXISTS instruments;
