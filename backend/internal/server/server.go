package server

import (
	"errors"

	"github.com/apex-trading/apex-backend/internal/auth"
	"github.com/apex-trading/apex-backend/internal/config"
	"github.com/apex-trading/apex-backend/internal/market"
	"github.com/apex-trading/apex-backend/internal/middleware"
	"github.com/apex-trading/apex-backend/internal/notification"
	"github.com/apex-trading/apex-backend/internal/order"
	"github.com/apex-trading/apex-backend/internal/portfolio"
	"github.com/apex-trading/apex-backend/internal/user"
	"github.com/apex-trading/apex-backend/pkg/logger"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/websocket/v2"
	jwt "github.com/golang-jwt/jwt/v5"
	"github.com/jmoiron/sqlx"
	"github.com/redis/go-redis/v9"
)

func New(cfg *config.Config, db *sqlx.DB, rdb *redis.Client, log *logger.Logger) *fiber.App {
	app := fiber.New(fiber.Config{
		ErrorHandler: errorHandler(log),
	})

	// ── Global middleware ──────────────────────────────────────────────────────
	app.Use(recover.New())
	app.Use(middleware.RequestID())
	app.Use(middleware.CORS(cfg.App.Env))

	// ── Health (no auth, no rate limit) ───────────────────────────────────────
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "version": cfg.App.Version})
	})
	app.Get("/ready", func(c *fiber.Ctx) error {
		if err := db.PingContext(c.Context()); err != nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"status": "db unavailable"})
		}
		return c.JSON(fiber.Map{"status": "ready"})
	})

	// ── Domain dependencies ────────────────────────────────────────────────────
	// Phase 1
	authRepo    := auth.NewRepository(db, rdb)
	authSvc     := auth.NewService(authRepo, cfg.JWT, log)
	authHandler := auth.NewHandler(authSvc, log)

	userRepo    := user.NewRepository(db)
	userSvc     := user.NewService(userRepo, log)
	userHandler := user.NewHandler(userSvc, log)

	// Phase 2
	mktRepo    := market.NewRepository(db)
	mktSvc     := market.NewService(mktRepo, log)
	mktHandler := market.NewHandler(mktSvc)

	// Phase 3: notifications (created before order so it can be passed in)
	notifRepo     := notification.NewRepository(db)
	notifSvc      := notification.NewService(notifRepo)
	notifHandler  := notification.NewHandler(notifSvc)

	ordRepo    := order.NewRepository(db)
	ordSvc     := order.NewService(ordRepo, mktSvc.Hub(), log, notifSvc)
	ordHandler := order.NewHandler(ordSvc, log)

	portSvc     := portfolio.NewService(db, mktSvc.Hub(), log)
	portHandler := portfolio.NewHandler(portSvc)

	// ── WebSocket endpoint (JWT via query param) ───────────────────────────────
	app.Get("/api/v1/ws/prices", wsTokenAuth(cfg.JWT.AccessSecret), websocket.New(mktHandler.WebSocket))

	// ── API v1 ─────────────────────────────────────────────────────────────────
	v1 := app.Group("/api/v1")
	v1.Use(middleware.RateLimit())

	// Auth — public
	authPublic := v1.Group("/auth")
	authPublic.Use(middleware.AuthRateLimit())
	authPublic.Post("/register", authHandler.Register)
	authPublic.Post("/login",    authHandler.Login)
	authPublic.Post("/refresh",  authHandler.RefreshToken)

	// Auth — protected
	authPrivate := v1.Group("/auth", middleware.JWTProtected(cfg.JWT.AccessSecret), middleware.UserRateLimit())
	authPrivate.Post("/logout",      authHandler.Logout)
	authPrivate.Post("/2fa/setup",   authHandler.Setup2FA)
	authPrivate.Post("/2fa/verify",  authHandler.Verify2FA)
	authPrivate.Post("/2fa/disable", authHandler.Disable2FA)

	// Users — protected
	users := v1.Group("/users", middleware.JWTProtected(cfg.JWT.AccessSecret), middleware.UserRateLimit())
	users.Get("/me",          userHandler.GetMe)
	users.Patch("/me",        userHandler.UpdateMe)
	users.Post("/kyc/submit", userHandler.SubmitKYC)

	// Market — public
	v1.Get("/instruments",              mktHandler.ListInstruments)
	v1.Get("/market/:symbol/candles",   mktHandler.GetCandles)

	// Orders, Positions, Notifications — protected
	trading := v1.Group("/", middleware.JWTProtected(cfg.JWT.AccessSecret), middleware.UserRateLimit())
	trading.Post("/orders",                    ordHandler.PlaceOrder)
	trading.Get("/orders",                     ordHandler.ListOrders)
	trading.Delete("/orders/:id",              ordHandler.CancelOrder)
	trading.Get("/positions",                  ordHandler.GetPositions)
	trading.Get("/portfolio",                  portHandler.GetSummary)
	trading.Get("/portfolio/equity-curve",     portHandler.GetEquityCurve)
	trading.Get("/notifications",              notifHandler.List)
	trading.Patch("/notifications/:id/read",   notifHandler.MarkRead)
	trading.Post("/notifications/read-all",    notifHandler.MarkAllRead)

	return app
}

// wsTokenAuth validates the JWT passed as ?token= query param on WebSocket upgrades.
func wsTokenAuth(secret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if !websocket.IsWebSocketUpgrade(c) {
			return fiber.ErrUpgradeRequired
		}
		tokenStr := c.Query("token")
		if tokenStr == "" {
			return fiber.NewError(fiber.StatusUnauthorized, "missing token")
		}
		claims := &middleware.Claims{}
		t, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fiber.NewError(fiber.StatusUnauthorized, "unexpected signing method")
			}
			return []byte(secret), nil
		})
		if err != nil || !t.Valid {
			return fiber.NewError(fiber.StatusUnauthorized, "invalid or expired token")
		}
		c.Locals("claims", claims)
		return c.Next()
	}
}

func errorHandler(log *logger.Logger) fiber.ErrorHandler {
	return func(c *fiber.Ctx, err error) error {
		code := fiber.StatusInternalServerError
		msg  := "internal server error"

		var fe *fiber.Error
		if errors.As(err, &fe) {
			code = fe.Code
			msg  = fe.Message
		}

		if code >= 500 {
			log.Error("unhandled server error",
				logger.Error(err),
				logger.String("method", c.Method()),
				logger.String("path", c.Path()),
			)
		}

		return c.Status(code).JSON(fiber.Map{"success": false, "error": msg})
	}
}
