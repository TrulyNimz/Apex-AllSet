package middleware

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// RequestID injects a unique request ID into every response header and context local.
// If the caller already provides X-Request-ID, that value is echoed back.
func RequestID() fiber.Handler {
	return func(c *fiber.Ctx) error {
		id := c.Get("X-Request-ID")
		if id == "" {
			id = uuid.NewString()
		}
		c.Set("X-Request-ID", id)
		c.Locals("requestID", id)
		return c.Next()
	}
}
