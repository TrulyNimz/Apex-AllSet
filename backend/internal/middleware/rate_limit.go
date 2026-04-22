package middleware

import (
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
)

// RateLimit returns a general-purpose limiter: 100 requests per minute per IP.
func RateLimit() fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        100,
		Expiration: time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			return "ip:" + c.IP()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return fiber.NewError(fiber.StatusTooManyRequests, "rate limit exceeded, slow down")
		},
	})
}

// AuthRateLimit returns a stricter limiter for auth endpoints: 20 requests per minute per IP.
func AuthRateLimit() fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        20,
		Expiration: time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			return "auth:" + c.IP()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return fiber.NewError(fiber.StatusTooManyRequests, "too many auth attempts, try again later")
		},
	})
}

// UserRateLimit returns a per-authenticated-user limiter applied after JWT validation.
// Falls back to IP if no claims are present (should not happen on protected routes).
// Limit: 200 requests per minute per user — more generous than per-IP since a single
// user may open multiple browser tabs or use the API directly.
func UserRateLimit() fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        200,
		Expiration: time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			if claims := GetClaims(c); claims != nil {
				return fmt.Sprintf("user:%s", claims.UserID)
			}
			return "ip:" + c.IP()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return fiber.NewError(fiber.StatusTooManyRequests, "user rate limit exceeded")
		},
	})
}
