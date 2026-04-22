-- Migration: 001_create_users
-- Creates the core users table with all Phase 1 fields.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

CREATE TABLE IF NOT EXISTS users (
    id            UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name    VARCHAR(50)     NOT NULL,
    last_name     VARCHAR(50)     NOT NULL,
    email         CITEXT          NOT NULL UNIQUE,
    password_hash TEXT            NOT NULL,
    role          VARCHAR(20)     NOT NULL DEFAULT 'trader'
                                  CHECK (role IN ('trader', 'admin', 'support')),
    avatar_url    TEXT,

    -- 2FA
    totp_secret   TEXT,
    totp_enabled  BOOLEAN         NOT NULL DEFAULT FALSE,

    -- KYC (Phase 3)
    kyc_status    VARCHAR(20)     NOT NULL DEFAULT 'pending'
                                  CHECK (kyc_status IN ('pending', 'submitted', 'approved', 'rejected')),

    -- Soft delete
    deleted_at    TIMESTAMPTZ,

    created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_users_email     ON users (email)     WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role      ON users (role)      WHERE deleted_at IS NULL;
CREATE INDEX idx_users_created   ON users (created_at DESC);
