package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/apex-trading/apex-backend/internal/config"
	"github.com/apex-trading/apex-backend/internal/database"
	"github.com/apex-trading/apex-backend/internal/server"
	"github.com/apex-trading/apex-backend/pkg/logger"
)

// @title           Apex Trading API
// @version         1.0
// @description     Multi-asset trading platform API
// @termsOfService  https://apextrading.io/terms

// @contact.name   Apex Trading Support
// @contact.url    https://apextrading.io/support
// @contact.email  support@apextrading.io

// @license.name  Proprietary
// @license.url   https://apextrading.io/license

// @host      localhost:8080
// @BasePath  /api/v1

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Type "Bearer" followed by a space and JWT token.
func main() {
	// ── Load config ──────────────────────────────────────────────────
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "FATAL: failed to load config: %v\n", err)
		os.Exit(1)
	}

	// ── Init logger ──────────────────────────────────────────────────
	log := logger.New(cfg.App.Env)
	defer log.Sync() //nolint:errcheck

	log.Info("Starting Apex Trading API",
		logger.String("env", cfg.App.Env),
		logger.String("version", cfg.App.Version),
	)

	// ── Connect to Postgres ──────────────────────────────────────────
	db, err := database.NewPostgres(cfg.Database)
	if err != nil {
		log.Fatal("Failed to connect to Postgres", logger.Error(err))
	}
	defer db.Close()

	// ── Connect to Redis ─────────────────────────────────────────────
	rdb, err := database.NewRedis(cfg.Redis)
	if err != nil {
		log.Fatal("Failed to connect to Redis", logger.Error(err))
	}
	defer rdb.Close()

	// ── Run migrations ───────────────────────────────────────────────
	if err := database.RunMigrations(cfg.Database.DSN()); err != nil {
		log.Fatal("Failed to run migrations", logger.Error(err))
	}

	// ── Build & start server ─────────────────────────────────────────
	srv := server.New(cfg, db, rdb, log)

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)

	go func() {
		addr := fmt.Sprintf(":%s", cfg.App.Port)
		log.Info("HTTP server listening", logger.String("addr", addr))
		if err := srv.Listen(addr); err != nil {
			log.Fatal("Server error", logger.Error(err))
		}
	}()

	<-quit
	log.Info("Shutdown signal received")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.ShutdownWithContext(ctx); err != nil {
		log.Error("Graceful shutdown failed", logger.Error(err))
	}

	log.Info("Server exited cleanly")
}
