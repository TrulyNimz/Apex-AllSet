package leaderboard

import (
	"context"
	"strconv"
	"time"

	"github.com/apex-trading/apex-backend/internal/middleware"
	"github.com/apex-trading/apex-backend/pkg/logger"
	"github.com/gofiber/fiber/v2"
	"github.com/jmoiron/sqlx"
	"github.com/redis/go-redis/v9"
)

const (
	redisKey        = "leaderboard:global"
	redisMetaPrefix = "leaderboard:meta:"
	startingEquity  = 100_000.0
)

// ── Domain types ──────────────────────────────────────────────────────────────

type Entry struct {
	Rank        int     `json:"rank"`
	UserID      string  `json:"user_id"`
	DisplayName string  `json:"display_name"`
	AvatarURL   string  `json:"avatar_url,omitempty"`
	Equity      float64 `json:"equity"`
	ReturnPct   float64 `json:"return_pct"`
}

type userMeta struct {
	DisplayName string `json:"display_name"`
	AvatarURL   string `json:"avatar_url"`
	OptIn       bool
}

// ── Repository ────────────────────────────────────────────────────────────────

type Repository struct {
	db  *sqlx.DB
	rdb *redis.Client
	log *logger.Logger
}

func NewRepository(db *sqlx.DB, rdb *redis.Client, log *logger.Logger) *Repository {
	return &Repository{db: db, rdb: rdb, log: log}
}

// UpsertScore updates a user's equity score in the Redis sorted set and
// refreshes their display name/avatar metadata hash.
func (r *Repository) UpsertScore(ctx context.Context, userID string, equity float64) {
	// Check opt-in before writing
	var optIn bool
	_ = r.db.GetContext(ctx, &optIn,
		`SELECT leaderboard_opt_in FROM users WHERE id=$1`, userID)
	if !optIn {
		r.rdb.ZRem(ctx, redisKey, userID)
		return
	}

	r.rdb.ZAdd(ctx, redisKey, redis.Z{Score: equity, Member: userID})

	// Refresh metadata
	var row struct {
		FirstName string  `db:"first_name"`
		LastName  string  `db:"last_name"`
		AvatarURL *string `db:"avatar_url"`
	}
	if err := r.db.GetContext(ctx, &row,
		`SELECT first_name, last_name, avatar_url FROM users WHERE id=$1`, userID); err == nil {
		display := row.FirstName
		if row.LastName != "" {
			display += " " + string([]rune(row.LastName)[:1]) + "."
		}
		av := ""
		if row.AvatarURL != nil {
			av = *row.AvatarURL
		}
		r.rdb.HSet(ctx, redisMetaPrefix+userID, "display_name", display, "avatar_url", av)
	}
}

// Top returns the top N entries from the leaderboard.
func (r *Repository) Top(ctx context.Context, n int) ([]Entry, error) {
	res, err := r.rdb.ZRevRangeWithScores(ctx, redisKey, 0, int64(n-1)).Result()
	if err != nil {
		return nil, err
	}

	entries := make([]Entry, 0, len(res))
	for i, z := range res {
		userID := z.Member.(string)
		meta, _ := r.rdb.HGetAll(ctx, redisMetaPrefix+userID).Result()

		equity := z.Score
		returnPct := (equity - startingEquity) / startingEquity * 100

		entries = append(entries, Entry{
			Rank:        i + 1,
			UserID:      userID,
			DisplayName: meta["display_name"],
			AvatarURL:   meta["avatar_url"],
			Equity:      equity,
			ReturnPct:   returnPct,
		})
	}
	return entries, nil
}

// MyRank returns the calling user's rank and entry.
func (r *Repository) MyRank(ctx context.Context, userID string) (*Entry, error) {
	rank, err := r.rdb.ZRevRank(ctx, redisKey, userID).Result()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	score, _ := r.rdb.ZScore(ctx, redisKey, userID).Result()
	meta, _  := r.rdb.HGetAll(ctx, redisMetaPrefix+userID).Result()

	return &Entry{
		Rank:        int(rank) + 1,
		UserID:      userID,
		DisplayName: meta["display_name"],
		AvatarURL:   meta["avatar_url"],
		Equity:      score,
		ReturnPct:   (score - startingEquity) / startingEquity * 100,
	}, nil
}

// SetOptIn updates the user's leaderboard opt-in preference.
func (r *Repository) SetOptIn(ctx context.Context, userID string, optIn bool) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE users SET leaderboard_opt_in=$1 WHERE id=$2`, optIn, userID)
	if !optIn {
		r.rdb.ZRem(ctx, redisKey, userID)
	}
	return err
}

// ── Service ───────────────────────────────────────────────────────────────────

type Service struct {
	repo *Repository
	log  *logger.Logger
}

func NewService(repo *Repository, log *logger.Logger) *Service {
	return &Service{repo: repo, log: log}
}

// PushScore is called by the portfolio snapshot job after computing equity.
func (s *Service) PushScore(ctx context.Context, userID string, equity float64) {
	s.repo.UpsertScore(ctx, userID, equity)
}

func (s *Service) Top(ctx context.Context, n int) ([]Entry, error) {
	if n <= 0 || n > 200 {
		n = 50
	}
	return s.repo.Top(ctx, n)
}

func (s *Service) MyRank(ctx context.Context, userID string) (*Entry, error) {
	return s.repo.MyRank(ctx, userID)
}

func (s *Service) SetOptIn(ctx context.Context, userID string, optIn bool) error {
	return s.repo.SetOptIn(ctx, userID, optIn)
}

// ── Handler ───────────────────────────────────────────────────────────────────

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) Top(c *fiber.Ctx) error {
	n, _ := strconv.Atoi(c.Query("n", "50"))
	entries, err := h.svc.Top(c.Context(), n)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": entries})
}

func (h *Handler) MyRank(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	entry, err := h.svc.MyRank(c.Context(), claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": entry})
}

func (h *Handler) SetOptIn(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	var body struct {
		OptIn bool `json:"opt_in"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	if err := h.svc.SetOptIn(c.Context(), claims.UserID, body.OptIn); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true})
}

// ── Time helper (unused but useful reference) ─────────────────────────────────

var _ = time.Now // keep time import used
