package portfolio

import (
	"context"
	"math"
	"time"

	"github.com/apex-trading/apex-backend/internal/market"
	"github.com/apex-trading/apex-backend/internal/middleware"
	"github.com/apex-trading/apex-backend/pkg/logger"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// ── Domain types ──────────────────────────────────────────────────────────────

type Summary struct {
	Balance       float64 `json:"balance"`
	UnrealizedPnL float64 `json:"unrealized_pnl"`
	RealizedPnL   float64 `json:"realized_pnl"`
	Equity        float64 `json:"equity"`
	OpenPositions int     `json:"open_positions"`
}

type EquityPoint struct {
	SnappedAt  time.Time `db:"snapped_at"  json:"snapped_at"`
	Equity     float64   `db:"equity"      json:"equity"`
	Balance    float64   `db:"balance"     json:"balance"`
	Unrealized float64   `db:"unrealized"  json:"unrealized"`
	Realized   float64   `db:"realized"    json:"realized"`
}

type positionRow struct {
	Symbol      string  `db:"symbol"`
	Quantity    float64 `db:"quantity"`
	AvgPrice    float64 `db:"avg_price"`
	RealizedPnL float64 `db:"realized_pnl"`
}

// ── Service ───────────────────────────────────────────────────────────────────

type Service struct {
	db  *sqlx.DB
	hub *market.Hub
	log *logger.Logger
}

func NewService(db *sqlx.DB, hub *market.Hub, log *logger.Logger) *Service {
	s := &Service{db: db, hub: hub, log: log}
	go s.runSnapshotJob()
	return s
}

func (s *Service) GetSummary(ctx context.Context, userID string) (*Summary, error) {
	var balance float64
	_ = s.db.GetContext(ctx, &balance,
		`SELECT COALESCE(balance, 0) FROM wallets WHERE user_id=$1 AND currency='USD'`, userID)

	var rows []positionRow
	_ = s.db.SelectContext(ctx, &rows,
		`SELECT symbol, quantity, avg_price, realized_pnl
		 FROM positions WHERE user_id=$1`, userID)

	var totalUnrealized, totalRealized float64
	open := 0

	for _, p := range rows {
		totalRealized += p.RealizedPnL
		if math.Abs(p.Quantity) > 1e-9 {
			if tick, ok := s.hub.GetPrice(p.Symbol); ok {
				unrealized := (tick.Mid - p.AvgPrice) * p.Quantity
				totalUnrealized += unrealized
			}
			open++
		}
	}

	return &Summary{
		Balance:       balance,
		UnrealizedPnL: totalUnrealized,
		RealizedPnL:   totalRealized,
		Equity:        balance + totalUnrealized,
		OpenPositions: open,
	}, nil
}

func (s *Service) GetEquityCurve(ctx context.Context, userID string, days int) ([]EquityPoint, error) {
	if days <= 0 || days > 365 {
		days = 7
	}
	var points []EquityPoint
	err := s.db.SelectContext(ctx, &points, `
		SELECT snapped_at, equity, balance, unrealized, realized
		FROM equity_snapshots
		WHERE user_id = $1
		  AND snapped_at >= NOW() - ($2 || ' days')::interval
		ORDER BY snapped_at ASC
	`, userID, days)
	if err != nil {
		return nil, err
	}
	if points == nil {
		points = []EquityPoint{}
	}
	return points, nil
}

// runSnapshotJob saves equity snapshots for all active users every 5 minutes.
func (s *Service) runSnapshotJob() {
	// Wait 1 minute after startup before first snapshot
	time.Sleep(time.Minute)

	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		s.snapshotAllUsers()
	}
}

func (s *Service) snapshotAllUsers() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Find all users who have a wallet (i.e. have been active)
	var userIDs []string
	if err := s.db.SelectContext(ctx, &userIDs,
		`SELECT DISTINCT user_id FROM wallets WHERE currency='USD'`); err != nil {
		s.log.Error("equity snapshot: failed to list users", logger.Error(err))
		return
	}

	for _, uid := range userIDs {
		summary, err := s.GetSummary(ctx, uid)
		if err != nil {
			continue
		}
		_, _ = s.db.ExecContext(ctx, `
			INSERT INTO equity_snapshots (id, user_id, equity, balance, unrealized, realized)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, uuid.NewString(), uid,
			summary.Equity, summary.Balance, summary.UnrealizedPnL, summary.RealizedPnL)
	}
}

// ── Handler ───────────────────────────────────────────────────────────────────

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) GetSummary(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	summary, err := h.svc.GetSummary(c.Context(), claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": summary})
}

func (h *Handler) GetEquityCurve(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	days := c.QueryInt("days", 7)

	points, err := h.svc.GetEquityCurve(c.Context(), claims.UserID, days)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": points})
}
