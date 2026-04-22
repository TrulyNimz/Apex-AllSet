package watchlist

import (
	"context"
	"time"

	"github.com/apex-trading/apex-backend/internal/market"
	"github.com/apex-trading/apex-backend/internal/middleware"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// ── Domain types ──────────────────────────────────────────────────────────────

type Watchlist struct {
	ID        string    `db:"id"         json:"id"`
	UserID    string    `db:"user_id"    json:"user_id"`
	Name      string    `db:"name"       json:"name"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

type WatchlistItem struct {
	WatchlistID string    `db:"watchlist_id" json:"watchlist_id"`
	Symbol      string    `db:"symbol"       json:"symbol"`
	Position    int       `db:"position"     json:"position"`
	AddedAt     time.Time `db:"added_at"     json:"added_at"`
	// Injected at read time
	Bid   *float64 `db:"-" json:"bid,omitempty"`
	Ask   *float64 `db:"-" json:"ask,omitempty"`
	Mid   *float64 `db:"-" json:"mid,omitempty"`
}

type CreateRequest struct {
	Name string `json:"name" validate:"required,min=1,max=100"`
}

type AddItemRequest struct {
	Symbol string `json:"symbol" validate:"required"`
}

type ReorderRequest struct {
	Symbols []string `json:"symbols" validate:"required"`
}

// ── Repository ────────────────────────────────────────────────────────────────

type Repository struct{ db *sqlx.DB }

func NewRepository(db *sqlx.DB) *Repository { return &Repository{db: db} }

func (r *Repository) ListByUser(ctx context.Context, userID string) ([]Watchlist, error) {
	var rows []Watchlist
	err := r.db.SelectContext(ctx, &rows,
		`SELECT id, user_id, name, created_at FROM watchlists WHERE user_id=$1 ORDER BY created_at ASC`,
		userID)
	return rows, err
}

func (r *Repository) Create(ctx context.Context, userID, name string) (*Watchlist, error) {
	w := &Watchlist{ID: uuid.NewString(), UserID: userID, Name: name, CreatedAt: time.Now()}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO watchlists (id, user_id, name) VALUES ($1, $2, $3)`,
		w.ID, w.UserID, w.Name)
	if err != nil {
		return nil, err
	}
	return w, nil
}

func (r *Repository) Delete(ctx context.Context, id, userID string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM watchlists WHERE id=$1 AND user_id=$2`, id, userID)
	return err
}

func (r *Repository) GetItems(ctx context.Context, watchlistID, userID string) ([]WatchlistItem, error) {
	// Verify ownership
	var ownerID string
	if err := r.db.GetContext(ctx, &ownerID,
		`SELECT user_id FROM watchlists WHERE id=$1`, watchlistID); err != nil {
		return nil, fiber.NewError(fiber.StatusNotFound, "watchlist not found")
	}
	if ownerID != userID {
		return nil, fiber.NewError(fiber.StatusForbidden, "access denied")
	}

	var items []WatchlistItem
	err := r.db.SelectContext(ctx, &items,
		`SELECT watchlist_id, symbol, position, added_at
		 FROM watchlist_items WHERE watchlist_id=$1 ORDER BY position ASC`, watchlistID)
	return items, err
}

func (r *Repository) AddItem(ctx context.Context, watchlistID, userID, symbol string) error {
	// Verify ownership
	var ownerID string
	if err := r.db.GetContext(ctx, &ownerID,
		`SELECT user_id FROM watchlists WHERE id=$1`, watchlistID); err != nil {
		return fiber.NewError(fiber.StatusNotFound, "watchlist not found")
	}
	if ownerID != userID {
		return fiber.NewError(fiber.StatusForbidden, "access denied")
	}

	_, err := r.db.ExecContext(ctx, `
		INSERT INTO watchlist_items (watchlist_id, symbol, position)
		VALUES ($1, $2, COALESCE((SELECT MAX(position)+1 FROM watchlist_items WHERE watchlist_id=$1), 0))
		ON CONFLICT (watchlist_id, symbol) DO NOTHING
	`, watchlistID, symbol)
	return err
}

func (r *Repository) RemoveItem(ctx context.Context, watchlistID, userID, symbol string) error {
	var ownerID string
	if err := r.db.GetContext(ctx, &ownerID,
		`SELECT user_id FROM watchlists WHERE id=$1`, watchlistID); err != nil {
		return fiber.NewError(fiber.StatusNotFound, "watchlist not found")
	}
	if ownerID != userID {
		return fiber.NewError(fiber.StatusForbidden, "access denied")
	}

	_, err := r.db.ExecContext(ctx,
		`DELETE FROM watchlist_items WHERE watchlist_id=$1 AND symbol=$2`, watchlistID, symbol)
	return err
}

func (r *Repository) ReorderItems(ctx context.Context, watchlistID, userID string, symbols []string) error {
	var ownerID string
	if err := r.db.GetContext(ctx, &ownerID,
		`SELECT user_id FROM watchlists WHERE id=$1`, watchlistID); err != nil {
		return fiber.NewError(fiber.StatusNotFound, "watchlist not found")
	}
	if ownerID != userID {
		return fiber.NewError(fiber.StatusForbidden, "access denied")
	}

	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for i, sym := range symbols {
		if _, err := tx.ExecContext(ctx,
			`UPDATE watchlist_items SET position=$1 WHERE watchlist_id=$2 AND symbol=$3`,
			i, watchlistID, sym); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *Repository) EnsureDefault(ctx context.Context, userID string) error {
	var count int
	_ = r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM watchlists WHERE user_id=$1`, userID)
	if count > 0 {
		return nil
	}

	id := uuid.NewString()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO watchlists (id, user_id, name) VALUES ($1, $2, 'My Watchlist') ON CONFLICT DO NOTHING`,
		id, userID)
	return err
}

// ── Service ───────────────────────────────────────────────────────────────────

type Service struct {
	repo *Repository
	hub  *market.Hub
}

func NewService(repo *Repository, hub *market.Hub) *Service {
	return &Service{repo: repo, hub: hub}
}

func (s *Service) List(ctx context.Context, userID string) ([]Watchlist, error) {
	return s.repo.ListByUser(ctx, userID)
}

func (s *Service) Create(ctx context.Context, userID, name string) (*Watchlist, error) {
	return s.repo.Create(ctx, userID, name)
}

func (s *Service) Delete(ctx context.Context, id, userID string) error {
	return s.repo.Delete(ctx, id, userID)
}

func (s *Service) GetItems(ctx context.Context, watchlistID, userID string) ([]WatchlistItem, error) {
	items, err := s.repo.GetItems(ctx, watchlistID, userID)
	if err != nil {
		return nil, err
	}
	// Inject live prices
	for i := range items {
		if tick, ok := s.hub.GetPrice(items[i].Symbol); ok {
			bid, ask, mid := tick.Bid, tick.Ask, tick.Mid
			items[i].Bid = &bid
			items[i].Ask = &ask
			items[i].Mid = &mid
		}
	}
	return items, nil
}

func (s *Service) AddItem(ctx context.Context, watchlistID, userID, symbol string) error {
	return s.repo.AddItem(ctx, watchlistID, userID, symbol)
}

func (s *Service) RemoveItem(ctx context.Context, watchlistID, userID, symbol string) error {
	return s.repo.RemoveItem(ctx, watchlistID, userID, symbol)
}

func (s *Service) ReorderItems(ctx context.Context, watchlistID, userID string, symbols []string) error {
	return s.repo.ReorderItems(ctx, watchlistID, userID, symbols)
}

func (s *Service) EnsureDefault(ctx context.Context, userID string) error {
	return s.repo.EnsureDefault(ctx, userID)
}

// ── Handler ───────────────────────────────────────────────────────────────────

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) List(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	lists, err := h.svc.List(c.Context(), claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": lists})
}

func (h *Handler) Create(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	var req CreateRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	w, err := h.svc.Create(c.Context(), claims.UserID, req.Name)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"success": true, "data": w})
}

func (h *Handler) Delete(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if err := h.svc.Delete(c.Context(), c.Params("id"), claims.UserID); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true})
}

func (h *Handler) GetItems(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	items, err := h.svc.GetItems(c.Context(), c.Params("id"), claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": items})
}

func (h *Handler) AddItem(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	var req AddItemRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	if err := h.svc.AddItem(c.Context(), c.Params("id"), claims.UserID, req.Symbol); err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"success": true})
}

func (h *Handler) RemoveItem(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if err := h.svc.RemoveItem(c.Context(), c.Params("id"), claims.UserID, c.Params("symbol")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true})
}

func (h *Handler) ReorderItems(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	var req ReorderRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	if err := h.svc.ReorderItems(c.Context(), c.Params("id"), claims.UserID, req.Symbols); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true})
}
