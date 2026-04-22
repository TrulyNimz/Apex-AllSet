.PHONY: dev build test test-race coverage lint \
        migrate-up migrate-down migrate-create \
        docker-up docker-down docker-up-tools \
        generate-secrets swagger tools

BINARY     = apex-api
CMD_PATH   = ./cmd/server
MIGRATIONS = ./migrations

# Load DB_DSN from .env if not already set
DB_DSN ?= $(shell grep -s '^DB_DSN=' .env | cut -d= -f2-)

# ── Development ────────────────────────────────────────────────────────────────
dev:
	air

build:
	go build -ldflags="-s -w" -o ./tmp/$(BINARY) $(CMD_PATH)

# ── Testing ────────────────────────────────────────────────────────────────────
test:
	go test ./...

test-race:
	go test -race ./...

coverage:
	go test -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out

# ── Linting ────────────────────────────────────────────────────────────────────
lint:
	golangci-lint run

# ── Migrations ─────────────────────────────────────────────────────────────────
migrate-up:
	migrate -path $(MIGRATIONS) -database "$(DB_DSN)" up

migrate-down:
	migrate -path $(MIGRATIONS) -database "$(DB_DSN)" down 1

migrate-create:
	@test -n "$(NAME)" || (echo "Usage: make migrate-create NAME=<name>" && exit 1)
	migrate create -ext sql -dir $(MIGRATIONS) -seq $(NAME)

# ── Docker ─────────────────────────────────────────────────────────────────────
docker-up:
	docker compose up -d postgres redis

docker-down:
	docker compose down

docker-up-tools:
	docker compose --profile dev-tools up -d

# ── Utilities ──────────────────────────────────────────────────────────────────
generate-secrets:
	@echo "JWT_ACCESS_SECRET=$$(openssl rand -hex 32)"
	@echo "JWT_REFRESH_SECRET=$$(openssl rand -hex 32)"

# ── Swagger / OpenAPI ──────────────────────────────────────────────────────────
swagger:
	swag init -g cmd/server/main.go -o docs --parseDependency

tools:
	go install github.com/air-verse/air@latest
	go install github.com/golang-migrate/migrate/v4/cmd/migrate@latest
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	go install github.com/swaggo/swag/cmd/swag@latest
