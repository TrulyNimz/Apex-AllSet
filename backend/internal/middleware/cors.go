package middleware

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

// CORS returns a configured CORS middleware.
// In development it allows the Vite dev server; in production only the live domain.
func CORS(env string) fiber.Handler {
	origins := "http://localhost:5173,http://localhost:3000"
	if env == "production" {
		origins = "https://apextrading.io"
	}

	return cors.New(cors.Config{
		AllowOrigins:     origins,
		AllowMethods:     "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization,X-Request-ID",
		ExposeHeaders:    "X-Request-ID",
		AllowCredentials: true,
		MaxAge:           86400,
	})
}
