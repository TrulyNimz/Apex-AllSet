package config

import (
	"fmt"
	"os"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	App      AppConfig
	Database DatabaseConfig
	Redis    RedisConfig
	JWT      JWTConfig
}

type AppConfig struct {
	Env     string
	Version string
	Port    string
}

type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	Name     string
	SSLMode  string
}

// DSN returns a postgres:// connection string.
func (d DatabaseConfig) DSN() string {
	return fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=%s",
		d.User, d.Password, d.Host, d.Port, d.Name, d.SSLMode,
	)
}

type RedisConfig struct {
	Host     string
	Port     string
	Password string
	DB       int
}

type JWTConfig struct {
	AccessSecret    string
	RefreshSecret   string
	AccessTokenTTL  time.Duration
	RefreshTokenTTL time.Duration
}

// Load reads environment variables (and an optional .env file) into a typed Config.
// Returns an error immediately if any required variable is missing.
func Load() (*Config, error) {
	// Silently ignore missing .env — in production vars are injected directly.
	_ = godotenv.Load()

	accessSecret, err := require("JWT_ACCESS_SECRET")
	if err != nil {
		return nil, err
	}
	refreshSecret, err := require("JWT_REFRESH_SECRET")
	if err != nil {
		return nil, err
	}
	dbUser, err := require("DB_USER")
	if err != nil {
		return nil, err
	}
	dbPassword, err := require("DB_PASSWORD")
	if err != nil {
		return nil, err
	}
	dbName, err := require("DB_NAME")
	if err != nil {
		return nil, err
	}

	return &Config{
		App: AppConfig{
			Env:     getOr("APP_ENV", "development"),
			Version: getOr("APP_VERSION", "dev"),
			Port:    getOr("APP_PORT", "8080"),
		},
		Database: DatabaseConfig{
			Host:     getOr("DB_HOST", "localhost"),
			Port:     getOr("DB_PORT", "5432"),
			User:     dbUser,
			Password: dbPassword,
			Name:     dbName,
			SSLMode:  getOr("DB_SSLMODE", "disable"),
		},
		Redis: RedisConfig{
			Host:     getOr("REDIS_HOST", "localhost"),
			Port:     getOr("REDIS_PORT", "6379"),
			Password: getOr("REDIS_PASSWORD", ""),
		},
		JWT: JWTConfig{
			AccessSecret:    accessSecret,
			RefreshSecret:   refreshSecret,
			AccessTokenTTL:  parseDuration(getOr("JWT_ACCESS_TTL", "15m")),
			RefreshTokenTTL: parseDuration(getOr("JWT_REFRESH_TTL", "168h")),
		},
	}, nil
}

func getOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func require(key string) (string, error) {
	v := os.Getenv(key)
	if v == "" {
		return "", fmt.Errorf("required environment variable %q is not set", key)
	}
	return v, nil
}

func parseDuration(s string) time.Duration {
	d, err := time.ParseDuration(s)
	if err != nil {
		return 15 * time.Minute
	}
	return d
}
