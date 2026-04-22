package response

import "github.com/gofiber/fiber/v2"

// Success writes a { "success": true, "data": data } JSON envelope.
func Success(c *fiber.Ctx, status int, data any) error {
	return c.Status(status).JSON(fiber.Map{
		"success": true,
		"data":    data,
	})
}

// Fail writes a { "success": false, "error": message } JSON envelope.
func Fail(c *fiber.Ctx, status int, message string) error {
	return c.Status(status).JSON(fiber.Map{
		"success": false,
		"error":   message,
	})
}
