package alert

import (
	"context"
	"strconv"
	"sync"
	"time"

	"github.com/apex-trading/apex-backend/internal/market"
	"github.com/apex-trading/apex-backend/internal/middleware"
	"github.com/apex-trading/apex-backend/pkg/logger"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// ── Domain types ──────────────────────────────────────────────────────────────

type Alert struct {
	ID          string     `db:"id"           json:"id"`
	UserID      string     `db:"user_id"      json:"user_id"`
	Symbol      string     `db:"symbol"       json:"symbol"`
	Direction   string     `db:"direction"    json:"direction"` // "above" | "below"
	Price       float64    `db:"price"        json:"price"`
	Message     string     `db:"message"      json:"message"`
	Triggered   bool       `db:"triggered"    json:"triggered"`
	TriggeredAt *time.Time `db:"triggered_at" json:"triggered_at,omitempty"`
	CreatedAt   time.Time  `db:"created_at"   json:"created_at"`
}

type CreateRequest struct {
	Symbol    string  `json:"symbol"    validate:"required"`
	Direction string  `json:"direction" validate:"required,oneof=above below"`
	Price     float64 `json:"price"     validate:"required,gt=0"`
	Message   string  `json:"message"`
}

// NotificationService is the narrow interface used to fire alerts.
type NotificationService interface {
	Create(ctx context.Context, userID, typ, title, body string) error
}

// ── Repository ────────────────────────────────────────────────────────────────

type Repository struct{ db *sqlx.DB }

func NewRepository(db *sqlx.DB) *Repository { return &Repository{db: db} }

func (r *Repository) Create(ctx context.Context, userID string, req CreateRequest) (*Alert, error) {
	a := &Alert{
		ID:        uuid.NewString(),
		UserID:    userID,
		Symbol:    req.Symbol,
		Direction: req.Direction,
		Price:     req.Price,
		Message:   req.Message,
		CreatedAt: time.Now(),
	}
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO price_alerts (id, user_id, symbol, direction, price, message)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, a.ID, a.UserID, a.Symbol, a.Direction, a.Price, a.Message)
	return a, err
}

func (r *Repository) List(ctx context.Context, userID string) ([]Alert, error) {
	var rows []Alert
	err := r.db.SelectContext(ctx, &rows, `
		SELECT id, user_id, symbol, direction, price, message, triggered, triggered_at, created_at
		FROM price_alerts WHERE user_id=$1 ORDER BY created_at DESC
	`, userID)
	return rows, err
}

func (r *Repository) Delete(ctx context.Context, id, userID string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM price_alerts WHERE id=$1 AND user_id=$2`, id, userID)
	return err
}

func (r *Repository) ListActive(ctx context.Context) ([]Alert, error) {
	var rows []Alert
	err := r.db.SelectContext(ctx, &rows, `
		SELECT id, user_id, symbol, direction, price, message, triggered, triggered_at, created_at
		FROM price_alerts WHERE triggered=FALSE
	`)
	return rows, err
}

func (r *Repository) MarkTriggered(ctx context.Context, id string, at time.Time) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE price_alerts SET triggered=TRUE, triggered_at=$2 WHERE id=$1
	`, id, at)
	return err
}

// ── Service ───────────────────────────────────────────────────────────────────

type Service struct {
	repo     *Repository
	hub      *market.Hub
	notifSvc NotificationService
	log      *logger.Logger

	mu      sync.Mutex
	active  []Alert // in-memory cache of untriggered alerts
}

func NewService(repo *Repository, hub *market.Hub, notifSvc NotificationService, log *logger.Logger) *Service {
	s := &Service{repo: repo, hub: hub, notifSvc: notifSvc, log: log}
	go s.runChecker()
	return s
}

func (s *Service) Create(ctx context.Context, userID string, req CreateRequest) (*Alert, error) {
	a, err := s.repo.Create(ctx, userID, req)
	if err != nil {
		return nil, err
	}
	s.mu.Lock()
	s.active = append(s.active, *a)
	s.mu.Unlock()
	return a, nil
}

func (s *Service) List(ctx context.Context, userID string) ([]Alert, error) {
	return s.repo.List(ctx, userID)
}

func (s *Service) Delete(ctx context.Context, id, userID string) error {
	if err := s.repo.Delete(ctx, id, userID); err != nil {
		return err
	}
	s.mu.Lock()
	newActive := s.active[:0]
	for _, a := range s.active {
		if a.ID != id {
			newActive = append(newActive, a)
		}
	}
	s.active = newActive
	s.mu.Unlock()
	return nil
}

// runChecker polls active alerts every 2 seconds and fires when conditions are met.
func (s *Service) runChecker() {
	// Initial load of active alerts from DB
	ctx := context.Background()
	if rows, err := s.repo.ListActive(ctx); err == nil {
		s.mu.Lock()
		s.active = rows
		s.mu.Unlock()
	}

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		s.checkAlerts()
	}
}

func (s *Service) checkAlerts() {
	s.mu.Lock()
	snapshot := make([]Alert, len(s.active))
	copy(snapshot, s.active)
	s.mu.Unlock()

	now := time.Now()
	var remaining []Alert

	for _, a := range snapshot {
		tick, ok := s.hub.GetPrice(a.Symbol)
		if !ok {
			remaining = append(remaining, a)
			continue
		}

		triggered := false
		switch a.Direction {
		case "above":
			triggered = tick.Mid >= a.Price
		case "below":
			triggered = tick.Mid <= a.Price
		}

		if !triggered {
			remaining = append(remaining, a)
			continue
		}

		// Fire notification asynchronously
		go func(al Alert, ts time.Time) {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			msg := al.Message
			if msg == "" {
				msg = al.Symbol
			}
			title := "Price Alert: " + al.Symbol
			body := al.Direction + " " + formatPrice(al.Price) + " — " + msg

			if err := s.notifSvc.Create(ctx, al.UserID, "price_alert", title, body); err != nil {
				s.log.Error("alert: failed to create notification", logger.Error(err))
			}
			if err := s.repo.MarkTriggered(ctx, al.ID, ts); err != nil {
				s.log.Error("alert: failed to mark triggered", logger.Error(err))
			}
		}(a, now)
	}

	s.mu.Lock()
	s.active = remaining
	s.mu.Unlock()
}

func formatPrice(p float64) string {
	// Simple formatting — avoids fmt import cycle concerns
	return strconv.FormatFloat(p, 'f', -1, 64)
}

// ── Handler ───────────────────────────────────────────────────────────────────

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) Create(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	var req CreateRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	a, err := h.svc.Create(c.Context(), claims.UserID, req)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"success": true, "data": a})
}

func (h *Handler) List(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	alerts, err := h.svc.List(c.Context(), claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": alerts})
}

func (h *Handler) Delete(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if err := h.svc.Delete(c.Context(), c.Params("id"), claims.UserID); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true})
}
