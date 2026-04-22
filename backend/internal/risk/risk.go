package risk

import (
	"context"
	"time"

	"github.com/apex-trading/apex-backend/internal/middleware"
	"github.com/apex-trading/apex-backend/pkg/logger"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// ── Domain types ──────────────────────────────────────────────────────────────

type Profile struct {
	UserID               string    `db:"user_id"               json:"user_id"`
	MaxDrawdownPct       float64   `db:"max_drawdown_pct"      json:"max_drawdown_pct"`
	MaxPositionSizePct   float64   `db:"max_position_size_pct" json:"max_position_size_pct"`
	MaxOpenPositions     int       `db:"max_open_positions"    json:"max_open_positions"`
	DailyLossLimitPct    float64   `db:"daily_loss_limit_pct"  json:"daily_loss_limit_pct"`
	TradingHalted        bool      `db:"trading_halted"        json:"trading_halted"`
	HaltReason           string    `db:"halt_reason"           json:"halt_reason,omitempty"`
	PeakEquity           float64   `db:"peak_equity"           json:"peak_equity"`
	UpdatedAt            time.Time `db:"updated_at"            json:"updated_at"`
}

type CheckResult struct {
	Allowed bool   `json:"allowed"`
	Reason  string `json:"reason,omitempty"`
}

type UpdateRequest struct {
	MaxDrawdownPct     *float64 `json:"max_drawdown_pct"`
	MaxPositionSizePct *float64 `json:"max_position_size_pct"`
	MaxOpenPositions   *int     `json:"max_open_positions"`
	DailyLossLimitPct  *float64 `json:"daily_loss_limit_pct"`
}

type RiskEvent struct {
	ID          string    `db:"id"          json:"id"`
	UserID      string    `db:"user_id"      json:"user_id"`
	EventType   string    `db:"event_type"   json:"event_type"`
	Description string    `db:"description"  json:"description"`
	CreatedAt   time.Time `db:"created_at"   json:"created_at"`
}

// NotificationService is the narrow interface for sending risk alerts.
type NotificationService interface {
	Create(ctx context.Context, userID, typ, title, body string) error
}

// ── Repository ────────────────────────────────────────────────────────────────

type Repository struct{ db *sqlx.DB }

func NewRepository(db *sqlx.DB) *Repository { return &Repository{db: db} }

func (r *Repository) EnsureProfile(ctx context.Context, userID string) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO risk_profiles (user_id) VALUES ($1)
		ON CONFLICT (user_id) DO NOTHING
	`, userID)
	return err
}

func (r *Repository) GetProfile(ctx context.Context, userID string) (*Profile, error) {
	_ = r.EnsureProfile(ctx, userID)
	var p Profile
	err := r.db.GetContext(ctx, &p, `
		SELECT user_id, max_drawdown_pct, max_position_size_pct, max_open_positions,
		       daily_loss_limit_pct, trading_halted, COALESCE(halt_reason,'') AS halt_reason,
		       peak_equity, updated_at
		FROM risk_profiles WHERE user_id=$1
	`, userID)
	return &p, err
}

func (r *Repository) Update(ctx context.Context, userID string, req UpdateRequest) error {
	p, err := r.GetProfile(ctx, userID)
	if err != nil {
		return err
	}
	if req.MaxDrawdownPct != nil {
		p.MaxDrawdownPct = *req.MaxDrawdownPct
	}
	if req.MaxPositionSizePct != nil {
		p.MaxPositionSizePct = *req.MaxPositionSizePct
	}
	if req.MaxOpenPositions != nil {
		p.MaxOpenPositions = *req.MaxOpenPositions
	}
	if req.DailyLossLimitPct != nil {
		p.DailyLossLimitPct = *req.DailyLossLimitPct
	}
	_, err = r.db.ExecContext(ctx, `
		UPDATE risk_profiles
		SET max_drawdown_pct=$1, max_position_size_pct=$2, max_open_positions=$3,
		    daily_loss_limit_pct=$4, updated_at=NOW()
		WHERE user_id=$5
	`, p.MaxDrawdownPct, p.MaxPositionSizePct, p.MaxOpenPositions, p.DailyLossLimitPct, userID)
	return err
}

func (r *Repository) SetHalt(ctx context.Context, userID string, halted bool, reason string) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE risk_profiles SET trading_halted=$1, halt_reason=$2, updated_at=NOW()
		WHERE user_id=$3
	`, halted, reason, userID)
	return err
}

func (r *Repository) UpdatePeakEquity(ctx context.Context, userID string, equity float64) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE risk_profiles SET peak_equity=GREATEST(peak_equity, $1), updated_at=NOW()
		WHERE user_id=$2
	`, equity, userID)
	return err
}

func (r *Repository) LogEvent(ctx context.Context, userID, eventType, description string) {
	_, _ = r.db.ExecContext(ctx, `
		INSERT INTO risk_events (id, user_id, event_type, description)
		VALUES ($1, $2, $3, $4)
	`, uuid.NewString(), userID, eventType, description)
}

func (r *Repository) GetEvents(ctx context.Context, userID string) ([]RiskEvent, error) {
	var rows []RiskEvent
	err := r.db.SelectContext(ctx, &rows, `
		SELECT id, user_id, event_type, COALESCE(description,'') AS description, created_at
		FROM risk_events WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100
	`, userID)
	return rows, err
}

func (r *Repository) GetOpenPositionCount(ctx context.Context, userID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `
		SELECT COUNT(*) FROM positions WHERE user_id=$1 AND ABS(quantity) > 0.000000001
	`, userID)
	return count, err
}

func (r *Repository) GetDailyPnL(ctx context.Context, userID string) (float64, error) {
	// Sum of realized PnL from fills today
	var pnl float64
	_ = r.db.GetContext(ctx, &pnl, `
		SELECT COALESCE(SUM(fill_price * quantity * CASE WHEN side='sell' THEN 1 ELSE -1 END), 0)
		FROM orders
		WHERE user_id=$1 AND status='filled' AND filled_at >= NOW()::date
	`, userID)
	return pnl, nil
}

// ── Service ───────────────────────────────────────────────────────────────────

type Service struct {
	repo     *Repository
	notifSvc NotificationService
	log      *logger.Logger
}

func NewService(repo *Repository, notifSvc NotificationService, log *logger.Logger) *Service {
	return &Service{repo: repo, notifSvc: notifSvc, log: log}
}

func (s *Service) Check(ctx context.Context, userID, symbol string, equity float64) (*CheckResult, error) {
	p, err := s.repo.GetProfile(ctx, userID)
	if err != nil {
		// If risk profile doesn't exist yet, allow the trade
		return &CheckResult{Allowed: true}, nil
	}

	if p.TradingHalted {
		return &CheckResult{Allowed: false, Reason: "trading halted: " + p.HaltReason}, nil
	}

	// Drawdown check
	if p.PeakEquity > 0 {
		drawdownPct := (p.PeakEquity - equity) / p.PeakEquity * 100
		if drawdownPct >= p.MaxDrawdownPct {
			reason := "max drawdown limit reached"
			_ = s.repo.SetHalt(ctx, userID, true, reason)
			s.repo.LogEvent(ctx, userID, "halt", "drawdown exceeded limit")
			go func() {
				nCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				_ = s.notifSvc.Create(nCtx, userID, "risk_halt",
					"Trading Halted", "Your account has been halted due to exceeding the maximum drawdown limit.")
			}()
			return &CheckResult{Allowed: false, Reason: reason}, nil
		}
	}

	// Open position count check
	openCount, _ := s.repo.GetOpenPositionCount(ctx, userID)
	if openCount >= p.MaxOpenPositions {
		return &CheckResult{Allowed: false, Reason: "maximum open positions reached"}, nil
	}

	return &CheckResult{Allowed: true}, nil
}

func (s *Service) UpdatePeakEquity(ctx context.Context, userID string, equity float64) {
	_ = s.repo.UpdatePeakEquity(ctx, userID, equity)
}

func (s *Service) GetProfile(ctx context.Context, userID string) (*Profile, error) {
	return s.repo.GetProfile(ctx, userID)
}

func (s *Service) Update(ctx context.Context, userID string, req UpdateRequest) (*Profile, error) {
	if err := s.repo.Update(ctx, userID, req); err != nil {
		return nil, err
	}
	return s.repo.GetProfile(ctx, userID)
}

func (s *Service) ResetHalt(ctx context.Context, userID string) error {
	if err := s.repo.SetHalt(ctx, userID, false, ""); err != nil {
		return err
	}
	s.repo.LogEvent(ctx, userID, "halt_reset", "trading halt manually cleared")
	return nil
}

func (s *Service) GetEvents(ctx context.Context, userID string) ([]RiskEvent, error) {
	return s.repo.GetEvents(ctx, userID)
}

// ── Handler ───────────────────────────────────────────────────────────────────

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) GetProfile(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	p, err := h.svc.GetProfile(c.Context(), claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": p})
}

func (h *Handler) Update(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	var req UpdateRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	p, err := h.svc.Update(c.Context(), claims.UserID, req)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": p})
}

func (h *Handler) ResetHalt(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if err := h.svc.ResetHalt(c.Context(), claims.UserID); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true})
}

func (h *Handler) GetEvents(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	events, err := h.svc.GetEvents(c.Context(), claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": events})
}
