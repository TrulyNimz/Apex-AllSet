package database

import (
	"context"
	"fmt"

	"github.com/apex-trading/apex-backend/internal/config"
	"github.com/redis/go-redis/v9"
)

// NewRedis creates a Redis client and verifies connectivity with a PING.
func NewRedis(cfg config.RedisConfig) (*redis.Client, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%s", cfg.Host, cfg.Port),
		Password: cfg.Password,
		DB:       cfg.DB,
	})

	if err := rdb.Ping(context.Background()).Err(); err != nil {
		return nil, fmt.Errorf("redis ping failed: %w", err)
	}

	return rdb, nil
}
