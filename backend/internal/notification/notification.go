package notification

import (
	"context"
	"fmt"
	"time"

	"github.com/apex-trading/apex-backend/internal/middleware"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// ── Domain types ──────────────────────────────────────────────────────────────

type Notification struct {
	ID        string    `db:"id"         json:"id"`
	UserID    string    `db:"user_id"    json:"user_id"`
	Type      string    `db:"type"       json:"type"`
	Title     string    `db:"title"      json:"title"`
	Body      string    `db:"body"       json:"body"`
	Read      bool      `db:"read"       json:"read"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

// ── Repository ────────────────────────────────────────────────────────────────

type Repository struct{ db *sqlx.DB }

func NewRepository(db *sqlx.DB) *Repository { return &Repository{db: db} }

func (r *Repository) Create(ctx context.Context, n *Notification) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO notifications (id, user_id, type, title, body)
		VALUES ($1, $2, $3, $4, $5)
	`, n.ID, n.UserID, n.Type, n.Title, n.Body)
	return err
}

func (r *Repository) List(ctx context.Context, userID string, limit int) ([]Notification, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	var out []Notification
	err := r.db.SelectContext(ctx, &out, `
		SELECT id, user_id, type, title, body, read, created_at
		FROM notifications
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, userID, limit)
	return out, err
}

func (r *Repository) UnreadCount(ctx context.Context, userID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND read=FALSE`, userID)
	return count, err
}

func (r *Repository) MarkRead(ctx context.Context, userID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE notifications SET read=TRUE WHERE id=$1 AND user_id=$2`, id, userID)
	return err
}

func (r *Repository) MarkAllRead(ctx context.Context, userID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE notifications SET read=TRUE WHERE user_id=$1 AND read=FALSE`, userID)
	return err
}

// ── Service ───────────────────────────────────────────────────────────────────

type Service struct{ repo *Repository }

func NewService(repo *Repository) *Service { return &Service{repo: repo} }

func (s *Service) CreateOnFill(ctx context.Context, userID, orderID, symbol, side string, fillPrice float64) error {
	action := "Bought"
	if side == "sell" {
		action = "Sold"
	}
	n := &Notification{
		ID:     uuid.NewString(),
		UserID: userID,
		Type:   "order_filled",
		Title:  fmt.Sprintf("Order Filled: %s %s", action, symbol),
		Body:   fmt.Sprintf("%s %s at %.5f (order %s)", action, symbol, fillPrice, orderID[:8]),
	}
	return s.repo.Create(ctx, n)
}

func (s *Service) List(ctx context.Context, userID string, limit int) ([]Notification, error) {
	return s.repo.List(ctx, userID, limit)
}

func (s *Service) UnreadCount(ctx context.Context, userID string) (int, error) {
	return s.repo.UnreadCount(ctx, userID)
}

func (s *Service) MarkRead(ctx context.Context, userID, id string) error {
	return s.repo.MarkRead(ctx, userID, id)
}

func (s *Service) MarkAllRead(ctx context.Context, userID string) error {
	return s.repo.MarkAllRead(ctx, userID)
}

// ── Handler ───────────────────────────────────────────────────────────────────

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) List(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	limit := c.QueryInt("limit", 50)

	items, err := h.svc.List(c.Context(), claims.UserID, limit)
	if err != nil {
		return err
	}
	count, _ := h.svc.UnreadCount(c.Context(), claims.UserID)

	if items == nil {
		items = []Notification{}
	}
	return c.JSON(fiber.Map{
		"success":       true,
		"data":          items,
		"unread_count":  count,
	})
}

func (h *Handler) MarkRead(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	id := c.Params("id")
	if id == "" {
		return fiber.NewError(fiber.StatusBadRequest, "id required")
	}
	if err := h.svc.MarkRead(c.Context(), claims.UserID, id); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true})
}

func (h *Handler) MarkAllRead(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if err := h.svc.MarkAllRead(c.Context(), claims.UserID); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true})
}
