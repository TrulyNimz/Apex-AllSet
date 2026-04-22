package database

import (
	"time"

	"github.com/apex-trading/apex-backend/internal/config"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq" // postgres driver
)

// NewPostgres opens a sqlx connection pool to Postgres and verifies connectivity.
func NewPostgres(cfg config.DatabaseConfig) (*sqlx.DB, error) {
	db, err := sqlx.Connect("postgres", cfg.DSN())
	if err != nil {
		return nil, err
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	db.SetConnMaxIdleTime(2 * time.Minute)

	return db, nil
}
