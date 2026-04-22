package user

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/apex-trading/apex-backend/internal/middleware"
	"github.com/apex-trading/apex-backend/pkg/logger"
	"github.com/gofiber/fiber/v2"
	"github.com/jmoiron/sqlx"
)

// ── Domain Models ─────────────────────────────────────────────────────────────

type UpdateRequest struct {
	FirstName string `json:"first_name" validate:"omitempty,min=2,max=50"`
	LastName  string `json:"last_name"  validate:"omitempty,min=2,max=50"`
	AvatarURL string `json:"avatar_url" validate:"omitempty,url"`
}

type UserRow struct {
	ID          string    `db:"id"           json:"id"`
	FirstName   string    `db:"first_name"   json:"first_name"`
	LastName    string    `db:"last_name"    json:"last_name"`
	Email       string    `db:"email"        json:"email"`
	Role        string    `db:"role"         json:"role"`
	AvatarURL   *string   `db:"avatar_url"   json:"avatar_url"`
	TOTPEnabled bool      `db:"totp_enabled" json:"totp_enabled"`
	KYCStatus   string    `db:"kyc_status"   json:"kyc_status"`
	CreatedAt   time.Time `db:"created_at"   json:"created_at"`
}

// ── Repository ────────────────────────────────────────────────────────────────

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) GetByID(ctx context.Context, id string) (*UserRow, error) {
	var u UserRow
	err := r.db.GetContext(ctx, &u, `
		SELECT id, first_name, last_name, email, role,
		       avatar_url, totp_enabled, kyc_status, created_at
		FROM users
		WHERE id = $1 AND deleted_at IS NULL
	`, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &u, err
}

func (r *Repository) SubmitKYC(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE users SET kyc_status = 'submitted'
		WHERE id = $1 AND kyc_status = 'pending' AND deleted_at IS NULL
	`, id)
	return err
}

func (r *Repository) Update(ctx context.Context, id string, req UpdateRequest) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE users
		SET first_name = COALESCE(NULLIF($1, ''), first_name),
		    last_name  = COALESCE(NULLIF($2, ''), last_name),
		    avatar_url = COALESCE(NULLIF($3, ''), avatar_url)
		WHERE id = $4 AND deleted_at IS NULL
	`, req.FirstName, req.LastName, req.AvatarURL, id)
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

func (s *Service) GetProfile(ctx context.Context, userID string) (*UserRow, error) {
	u, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, fiber.NewError(fiber.StatusNotFound, "user not found")
	}
	return u, nil
}

func (s *Service) SubmitKYC(ctx context.Context, userID string) (*UserRow, error) {
	if err := s.repo.SubmitKYC(ctx, userID); err != nil {
		return nil, err
	}
	return s.GetProfile(ctx, userID)
}

func (s *Service) UpdateProfile(ctx context.Context, userID string, req UpdateRequest) (*UserRow, error) {
	if err := s.repo.Update(ctx, userID, req); err != nil {
		return nil, err
	}
	return s.GetProfile(ctx, userID)
}

// ── HTTP Handler ──────────────────────────────────────────────────────────────

type Handler struct {
	svc *Service
	log *logger.Logger
}

func NewHandler(svc *Service, log *logger.Logger) *Handler {
	return &Handler{svc: svc, log: log}
}

func (h *Handler) GetMe(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	u, err := h.svc.GetProfile(c.Context(), claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": u})
}

// SubmitKYC godoc
// @Summary      Submit KYC for review
// @Tags         users
// @Security     BearerAuth
// @Produce      json
// @Success      200 {object} map[string]interface{}
// @Failure      400 {object} map[string]interface{}
// @Router       /users/kyc/submit [post]
func (h *Handler) SubmitKYC(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	u, err := h.svc.SubmitKYC(c.Context(), claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": u})
}

func (h *Handler) UpdateMe(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)

	var req UpdateRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	u, err := h.svc.UpdateProfile(c.Context(), claims.UserID, req)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": u})
}
