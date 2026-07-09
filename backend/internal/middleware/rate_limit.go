package middleware

import (
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
)

// RateLimit returns a general-purpose limiter: 100 requests per minute per IP
// in production. Non-production raises the cap so local dev / e2e suites (which
// poll several endpoints on a short interval from one IP) aren't throttled.
func RateLimit(env string) fiber.Handler {
	max := 100
	if env != "production" {
		max = 10000
	}
	return limiter.New(limiter.Config{
		Max:        max,
		Expiration: time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			return "ip:" + c.IP()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return fiber.NewError(fiber.StatusTooManyRequests, "rate limit exceeded, slow down")
		},
	})
}

// AuthRateLimit returns a stricter limiter for auth endpoints: 20 requests per
// minute per IP in production. In non-production environments the cap is raised
// so local development and end-to-end test suites (which register/log in many
// times in quick succession from one IP) aren't throttled.
func AuthRateLimit(env string) fiber.Handler {
	max := 20
	if env != "production" {
		max = 1000
	}
	return limiter.New(limiter.Config{
		Max:        max,
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
// user may open multiple browser tabs or use the API directly. Non-production
// raises the cap for local dev / e2e suites.
func UserRateLimit(env string) fiber.Handler {
	max := 200
	if env != "production" {
		max = 10000
	}
	return limiter.New(limiter.Config{
		Max:        max,
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
