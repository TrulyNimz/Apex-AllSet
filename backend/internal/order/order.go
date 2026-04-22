package order

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
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

type PlaceOrderRequest struct {
	Symbol   string  `json:"symbol"   validate:"required"`
	Side     string  `json:"side"     validate:"required,oneof=buy sell"`
	Type     string  `json:"type"     validate:"required,oneof=market limit stop"`
	Quantity float64 `json:"quantity" validate:"required,gt=0"`
	Price    float64 `json:"price"`
}

type Order struct {
	ID        string     `db:"id"         json:"id"`
	UserID    string     `db:"user_id"    json:"user_id"`
	Symbol    string     `db:"symbol"     json:"symbol"`
	Side      string     `db:"side"       json:"side"`
	Type      string     `db:"type"       json:"type"`
	Quantity  float64    `db:"quantity"   json:"quantity"`
	Price     *float64   `db:"price"      json:"price"`
	FillPrice *float64   `db:"fill_price" json:"fill_price"`
	Status    string     `db:"status"     json:"status"`
	FilledAt  *time.Time `db:"filled_at"  json:"filled_at"`
	CreatedAt time.Time  `db:"created_at" json:"created_at"`
}

type Position struct {
	ID            string    `db:"id"           json:"id"`
	UserID        string    `db:"user_id"      json:"user_id"`
	Symbol        string    `db:"symbol"       json:"symbol"`
	Quantity      float64   `db:"quantity"     json:"quantity"` // positive=long, negative=short
	AvgPrice      float64   `db:"avg_price"    json:"avg_price"`
	RealizedPnL   float64   `db:"realized_pnl" json:"realized_pnl"`
	CurrentPrice  float64   `db:"-"            json:"current_price"`
	UnrealizedPnL float64   `db:"-"            json:"unrealized_pnl"`
	UnrealizedPct float64   `db:"-"            json:"unrealized_pnl_pct"`
	Side          string    `db:"-"            json:"side"` // "long" | "short"
	CreatedAt     time.Time `db:"created_at"   json:"created_at"`
	UpdatedAt     time.Time `db:"updated_at"   json:"updated_at"`
}

// ── Repository ────────────────────────────────────────────────────────────────

type Repository struct{ db *sqlx.DB }

func NewRepository(db *sqlx.DB) *Repository { return &Repository{db: db} }

func (r *Repository) EnsureWallet(ctx context.Context, userID string) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO wallets (id, user_id, currency, balance)
		VALUES ($1, $2, 'USD', 100000.00)
		ON CONFLICT (user_id, currency) DO NOTHING
	`, uuid.NewString(), userID)
	return err
}

func (r *Repository) GetWalletBalance(ctx context.Context, userID string) (float64, error) {
	var balance float64
	err := r.db.GetContext(ctx, &balance,
		`SELECT balance FROM wallets WHERE user_id=$1 AND currency='USD'`, userID)
	return balance, err
}

func (r *Repository) CreateOrder(ctx context.Context, o *Order) error {
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO orders (id, user_id, symbol, side, type, quantity, price, fill_price, status, filled_at)
		VALUES (:id, :user_id, :symbol, :side, :type, :quantity, :price, :fill_price, :status, :filled_at)
	`, o)
	return err
}

func (r *Repository) FillOrder(ctx context.Context, orderID string, fillPrice float64, now time.Time) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE orders
		SET status='filled', fill_price=$1, filled_at=$2, updated_at=NOW()
		WHERE id=$3 AND status='open'
	`, fillPrice, now, orderID)
	return err
}

func (r *Repository) CancelOrder(ctx context.Context, userID, orderID string) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE orders SET status='cancelled', updated_at=NOW()
		WHERE id=$1 AND user_id=$2 AND status='open'
	`, orderID, userID)
	return err
}

func (r *Repository) ListOrders(ctx context.Context, userID string, limit int) ([]Order, error) {
	var orders []Order
	err := r.db.SelectContext(ctx, &orders, `
		SELECT id, user_id, symbol, side, type, quantity, price, fill_price, status, filled_at, created_at
		FROM orders WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2
	`, userID, limit)
	return orders, err
}

// ListPendingBySymbol returns all open limit/stop orders for a given symbol.
func (r *Repository) ListPendingBySymbol(ctx context.Context, symbol string) ([]Order, error) {
	var orders []Order
	err := r.db.SelectContext(ctx, &orders, `
		SELECT id, user_id, symbol, side, type, quantity, price, fill_price, status, filled_at, created_at
		FROM orders
		WHERE symbol=$1 AND status='open' AND type IN ('limit','stop')
	`, symbol)
	return orders, err
}

func (r *Repository) GetPosition(ctx context.Context, userID, symbol string) (*Position, error) {
	var p Position
	err := r.db.GetContext(ctx, &p, `
		SELECT id, user_id, symbol, quantity, avg_price, realized_pnl, created_at, updated_at
		FROM positions WHERE user_id=$1 AND symbol=$2
	`, userID, symbol)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &p, err
}

func (r *Repository) UpsertPosition(ctx context.Context, p *Position) error {
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO positions (id, user_id, symbol, quantity, avg_price, realized_pnl)
		VALUES (:id, :user_id, :symbol, :quantity, :avg_price, :realized_pnl)
		ON CONFLICT (user_id, symbol) DO UPDATE
		SET quantity     = EXCLUDED.quantity,
		    avg_price    = EXCLUDED.avg_price,
		    realized_pnl = positions.realized_pnl + EXCLUDED.realized_pnl,
		    updated_at   = NOW()
	`, p)
	return err
}

func (r *Repository) ListPositions(ctx context.Context, userID string) ([]Position, error) {
	var positions []Position
	err := r.db.SelectContext(ctx, &positions, `
		SELECT id, user_id, symbol, quantity, avg_price, realized_pnl, created_at, updated_at
		FROM positions WHERE user_id=$1 AND quantity != 0
		ORDER BY symbol
	`, userID)
	return positions, err
}

// ── Service interfaces ────────────────────────────────────────────────────────

// NotificationService is a minimal interface to avoid circular imports.
type NotificationService interface {
	CreateOnFill(ctx context.Context, userID, orderID, symbol, side string, fillPrice float64) error
}

// RiskService interface — implemented by risk.Service.
type RiskService interface {
	Check(ctx context.Context, userID, symbol string, equity float64) (allowed bool, reason string, err error)
}

// ── Service ───────────────────────────────────────────────────────────────────

type Service struct {
	repo     *Repository
	hub      *market.Hub
	log      *logger.Logger
	notifSvc NotificationService
	riskSvc  RiskService // optional; nil = no risk checks
}

func NewService(repo *Repository, hub *market.Hub, log *logger.Logger, notifSvc NotificationService) *Service {
	s := &Service{repo: repo, hub: hub, log: log, notifSvc: notifSvc}
	go s.runOrderProcessor()
	return s
}

// SetRiskService wires in the optional risk service after construction to
// avoid an import cycle (risk imports portfolio, portfolio doesn't import order).
func (s *Service) SetRiskService(rsk RiskService) { s.riskSvc = rsk }

func (s *Service) PlaceOrder(ctx context.Context, userID string, req PlaceOrderRequest) (*Order, error) {
	if err := s.repo.EnsureWallet(ctx, userID); err != nil {
		return nil, fmt.Errorf("ensure wallet: %w", err)
	}

	now := time.Now()

	switch req.Type {
	case "market":
		return s.placeMarket(ctx, userID, req, now)
	case "limit", "stop":
		return s.placePending(ctx, userID, req, now)
	default:
		return nil, fiber.NewError(fiber.StatusBadRequest, "unsupported order type")
	}
}

func (s *Service) placeMarket(ctx context.Context, userID string, req PlaceOrderRequest, now time.Time) (*Order, error) {
	tick, ok := s.hub.GetPrice(req.Symbol)
	if !ok {
		return nil, fiber.NewError(fiber.StatusBadRequest, "no price available for "+req.Symbol)
	}

	fillPrice := tick.Ask
	if req.Side == "sell" {
		fillPrice = tick.Bid
	}

	o := &Order{
		ID:        uuid.NewString(),
		UserID:    userID,
		Symbol:    req.Symbol,
		Side:      req.Side,
		Type:      req.Type,
		Quantity:  req.Quantity,
		FillPrice: &fillPrice,
		Status:    "filled",
		FilledAt:  &now,
		CreatedAt: now,
	}

	if err := s.repo.CreateOrder(ctx, o); err != nil {
		return nil, fmt.Errorf("create order: %w", err)
	}

	if err := s.updatePosition(ctx, userID, req.Symbol, req.Side, req.Quantity, fillPrice); err != nil {
		return nil, fmt.Errorf("update position: %w", err)
	}

	s.fireNotification(userID, o.ID, req.Symbol, req.Side, fillPrice)
	return o, nil
}

func (s *Service) placePending(ctx context.Context, userID string, req PlaceOrderRequest, now time.Time) (*Order, error) {
	if req.Price <= 0 {
		return nil, fiber.NewError(fiber.StatusBadRequest, "price is required for limit/stop orders")
	}

	p := req.Price
	o := &Order{
		ID:        uuid.NewString(),
		UserID:    userID,
		Symbol:    req.Symbol,
		Side:      req.Side,
		Type:      req.Type,
		Quantity:  req.Quantity,
		Price:     &p,
		Status:    "open",
		CreatedAt: now,
	}

	if err := s.repo.CreateOrder(ctx, o); err != nil {
		return nil, fmt.Errorf("create order: %w", err)
	}
	return o, nil
}

// runOrderProcessor evaluates open limit/stop orders on every tick.
func (s *Service) runOrderProcessor() {
	sub := make(chan market.Tick, 256)
	s.hub.Subscribe(sub)
	defer s.hub.Unsubscribe(sub)

	for tick := range sub {
		s.evaluateOrders(tick)
	}
}

func (s *Service) evaluateOrders(tick market.Tick) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	orders, err := s.repo.ListPendingBySymbol(ctx, tick.Symbol)
	if err != nil || len(orders) == 0 {
		return
	}

	for _, o := range orders {
		if o.Price == nil {
			continue
		}
		triggerPrice := *o.Price

		var fillPrice float64
		var triggered bool

		switch o.Type {
		case "limit":
			if o.Side == "buy" && tick.Ask <= triggerPrice {
				fillPrice = tick.Ask
				triggered = true
			} else if o.Side == "sell" && tick.Bid >= triggerPrice {
				fillPrice = tick.Bid
				triggered = true
			}
		case "stop":
			if o.Side == "buy" && tick.Ask >= triggerPrice {
				fillPrice = tick.Ask
				triggered = true
			} else if o.Side == "sell" && tick.Bid <= triggerPrice {
				fillPrice = tick.Bid
				triggered = true
			}
		}

		if !triggered {
			continue
		}

		now := time.Now()
		if err := s.repo.FillOrder(ctx, o.ID, fillPrice, now); err != nil {
			s.log.Error("order processor: fill failed", logger.Error(err), logger.String("order_id", o.ID))
			continue
		}
		if err := s.updatePosition(ctx, o.UserID, o.Symbol, o.Side, o.Quantity, fillPrice); err != nil {
			s.log.Error("order processor: position update failed", logger.Error(err))
			continue
		}
		s.fireNotification(o.UserID, o.ID, o.Symbol, o.Side, fillPrice)
	}
}

func (s *Service) fireNotification(userID, orderID, symbol, side string, fillPrice float64) {
	if s.notifSvc == nil {
		return
	}
	go func() {
		nCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = s.notifSvc.CreateOnFill(nCtx, userID, orderID, symbol, side, fillPrice)
	}()
}

func (s *Service) updatePosition(ctx context.Context, userID, symbol, side string, qty, price float64) error {
	signed := qty
	if side == "sell" {
		signed = -qty
	}

	existing, err := s.repo.GetPosition(ctx, userID, symbol)
	if err != nil {
		return err
	}

	var newQty, newAvg, realizedPnL float64

	if existing == nil {
		newQty = signed
		newAvg = price
	} else {
		oldQty := existing.Quantity
		newQty = oldQty + signed

		if (oldQty > 0 && signed > 0) || (oldQty < 0 && signed < 0) {
			total := math.Abs(oldQty)*existing.AvgPrice + math.Abs(signed)*price
			newAvg = total / math.Abs(newQty)
		} else {
			closed := math.Min(math.Abs(oldQty), math.Abs(signed))
			if oldQty > 0 {
				realizedPnL = closed * (price - existing.AvgPrice)
			} else {
				realizedPnL = closed * (existing.AvgPrice - price)
			}
			if math.Abs(newQty) < 1e-9 {
				newAvg = 0
			} else {
				newAvg = price
			}
		}
	}

	pos := &Position{
		ID:          uuid.NewString(),
		UserID:      userID,
		Symbol:      symbol,
		Quantity:    newQty,
		AvgPrice:    newAvg,
		RealizedPnL: realizedPnL,
	}
	return s.repo.UpsertPosition(ctx, pos)
}

func (s *Service) GetPositions(ctx context.Context, userID string) ([]Position, error) {
	positions, err := s.repo.ListPositions(ctx, userID)
	if err != nil {
		return nil, err
	}

	for i := range positions {
		p := &positions[i]
		if tick, ok := s.hub.GetPrice(p.Symbol); ok {
			p.CurrentPrice = tick.Mid
			p.UnrealizedPnL = (tick.Mid - p.AvgPrice) * p.Quantity
			if p.AvgPrice > 0 {
				cost := p.AvgPrice * math.Abs(p.Quantity)
				if cost > 0 {
					p.UnrealizedPct = p.UnrealizedPnL / cost * 100
				}
			}
		}
		if p.Quantity > 0 {
			p.Side = "long"
		} else {
			p.Side = "short"
		}
	}

	return positions, nil
}

func (s *Service) ListOrders(ctx context.Context, userID string) ([]Order, error) {
	return s.repo.ListOrders(ctx, userID, 100)
}

func (s *Service) CancelOrder(ctx context.Context, userID, orderID string) error {
	return s.repo.CancelOrder(ctx, userID, orderID)
}

// ── Handler ───────────────────────────────────────────────────────────────────

type Handler struct {
	svc *Service
	log *logger.Logger
}

func NewHandler(svc *Service, log *logger.Logger) *Handler { return &Handler{svc: svc, log: log} }

// PlaceOrder godoc
// @Summary      Place a market, limit, or stop order
// @Tags         trading
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body body PlaceOrderRequest true "Order request"
// @Success      201 {object} map[string]interface{}
// @Failure      400 {object} map[string]interface{}
// @Router       /orders [post]
func (h *Handler) PlaceOrder(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	var req PlaceOrderRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	o, err := h.svc.PlaceOrder(c.Context(), claims.UserID, req)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"success": true, "data": o})
}

func (h *Handler) ListOrders(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	orders, err := h.svc.ListOrders(c.Context(), claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": orders})
}

func (h *Handler) CancelOrder(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	orderID := c.Params("id")
	if err := h.svc.CancelOrder(c.Context(), claims.UserID, orderID); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true})
}

func (h *Handler) GetPositions(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	positions, err := h.svc.GetPositions(c.Context(), claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": positions})
}
