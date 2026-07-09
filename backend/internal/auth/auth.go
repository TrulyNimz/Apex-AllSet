package auth

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/apex-trading/apex-backend/internal/config"
	"github.com/apex-trading/apex-backend/internal/middleware"
	"github.com/apex-trading/apex-backend/pkg/logger"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/pquerna/otp/totp"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
)

// ── Domain Models ─────────────────────────────────────────────────────────────

type RegisterRequest struct {
	FirstName string `json:"first_name" validate:"required,min=2,max=50"`
	LastName  string `json:"last_name"  validate:"required,min=2,max=50"`
	Email     string `json:"email"      validate:"required,email"`
	Password  string `json:"password"   validate:"required,min=8"`
}

type LoginRequest struct {
	Email    string `json:"email"    validate:"required,email"`
	Password string `json:"password" validate:"required"`
	TOTPCode string `json:"totp_code,omitempty"`
}

type TokenPair struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresAt    time.Time `json:"expires_at"`
}

type UserRow struct {
	ID               string         `db:"id"`
	FirstName        string         `db:"first_name"`
	LastName         string         `db:"last_name"`
	Email            string         `db:"email"`
	PasswordHash     string         `db:"password_hash"`
	Role             string         `db:"role"`
	AvatarURL        sql.NullString `db:"avatar_url"`
	TOTPSecret       sql.NullString `db:"totp_secret"`
	TOTPEnabled      bool           `db:"totp_enabled"`
	KYCStatus        string         `db:"kyc_status"`
	LeaderboardOptIn bool           `db:"leaderboard_opt_in"`
	DeletedAt        sql.NullTime   `db:"deleted_at"`
	CreatedAt        time.Time      `db:"created_at"`
	UpdatedAt        time.Time      `db:"updated_at"`
}

// ── Repository ────────────────────────────────────────────────────────────────

type Repository struct {
	db  *sqlx.DB
	rdb *redis.Client
}

func NewRepository(db *sqlx.DB, rdb *redis.Client) *Repository {
	return &Repository{db: db, rdb: rdb}
}

func (r *Repository) CreateUser(ctx context.Context, u *UserRow) error {
	q := `
		INSERT INTO users (id, first_name, last_name, email, password_hash, role)
		VALUES (:id, :first_name, :last_name, :email, :password_hash, :role)
	`
	_, err := r.db.NamedExecContext(ctx, q, u)
	return err
}

func (r *Repository) GetUserByEmail(ctx context.Context, email string) (*UserRow, error) {
	var u UserRow
	err := r.db.GetContext(ctx, &u, `SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL`, email)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &u, err
}

func (r *Repository) GetUserByID(ctx context.Context, id string) (*UserRow, error) {
	var u UserRow
	err := r.db.GetContext(ctx, &u, `SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL`, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &u, err
}

func (r *Repository) UpdateTOTP(ctx context.Context, userID, secret string, enabled bool) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE users SET totp_secret = $1, totp_enabled = $2 WHERE id = $3`,
		secret, enabled, userID,
	)
	return err
}

// StoreRefreshToken saves a hashed refresh token in Redis with TTL.
func (r *Repository) StoreRefreshToken(ctx context.Context, userID, tokenID string, ttl time.Duration) error {
	key := fmt.Sprintf("refresh:%s:%s", userID, tokenID)
	return r.rdb.Set(ctx, key, "1", ttl).Err()
}

// ValidateRefreshToken checks if a refresh token ID exists in Redis.
func (r *Repository) ValidateRefreshToken(ctx context.Context, userID, tokenID string) (bool, error) {
	key := fmt.Sprintf("refresh:%s:%s", userID, tokenID)
	res, err := r.rdb.Exists(ctx, key).Result()
	return res > 0, err
}

// RevokeRefreshToken deletes a refresh token from Redis (logout).
func (r *Repository) RevokeRefreshToken(ctx context.Context, userID, tokenID string) error {
	key := fmt.Sprintf("refresh:%s:%s", userID, tokenID)
	return r.rdb.Del(ctx, key).Err()
}

// RevokeAllRefreshTokens deletes all tokens for a user (logout all devices).
func (r *Repository) RevokeAllRefreshTokens(ctx context.Context, userID string) error {
	pattern := fmt.Sprintf("refresh:%s:*", userID)
	keys, err := r.rdb.Keys(ctx, pattern).Result()
	if err != nil || len(keys) == 0 {
		return err
	}
	return r.rdb.Del(ctx, keys...).Err()
}

// ── Service ───────────────────────────────────────────────────────────────────

type Service struct {
	repo *Repository
	cfg  config.JWTConfig
	log  *logger.Logger
}

func NewService(repo *Repository, cfg config.JWTConfig, log *logger.Logger) *Service {
	return &Service{repo: repo, cfg: cfg, log: log}
}

func (s *Service) Register(ctx context.Context, req RegisterRequest) (*TokenPair, error) {
	// Check duplicate email
	existing, err := s.repo.GetUserByEmail(ctx, req.Email)
	if err != nil {
		return nil, fmt.Errorf("lookup user: %w", err)
	}
	if existing != nil {
		return nil, fiber.NewError(fiber.StatusConflict, "email already registered")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	u := &UserRow{
		ID:           uuid.NewString(),
		FirstName:    req.FirstName,
		LastName:     req.LastName,
		Email:        req.Email,
		PasswordHash: string(hash),
		Role:         "trader",
	}

	if err := s.repo.CreateUser(ctx, u); err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}

	return s.issueTokenPair(ctx, u)
}

func (s *Service) Login(ctx context.Context, req LoginRequest) (*TokenPair, error) {
	u, err := s.repo.GetUserByEmail(ctx, req.Email)
	if err != nil {
		return nil, fmt.Errorf("lookup user: %w", err)
	}
	if u == nil {
		return nil, fiber.NewError(fiber.StatusUnauthorized, "invalid credentials")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(req.Password)); err != nil {
		return nil, fiber.NewError(fiber.StatusUnauthorized, "invalid credentials")
	}

	// Enforce TOTP if enabled
	if u.TOTPEnabled {
		if req.TOTPCode == "" {
			return nil, fiber.NewError(fiber.StatusUnauthorized, "totp_required")
		}
		if !totp.Validate(req.TOTPCode, u.TOTPSecret.String) {
			return nil, fiber.NewError(fiber.StatusUnauthorized, "invalid totp code")
		}
	}

	return s.issueTokenPair(ctx, u)
}

func (s *Service) RefreshToken(ctx context.Context, refreshToken string) (*TokenPair, error) {
	claims := &middleware.Claims{}
	token, err := jwt.ParseWithClaims(refreshToken, claims, func(t *jwt.Token) (interface{}, error) {
		return []byte(s.cfg.RefreshSecret), nil
	})
	if err != nil || !token.Valid {
		return nil, fiber.NewError(fiber.StatusUnauthorized, "invalid refresh token")
	}

	tokenID := claims.ID
	valid, err := s.repo.ValidateRefreshToken(ctx, claims.UserID, tokenID)
	if err != nil || !valid {
		return nil, fiber.NewError(fiber.StatusUnauthorized, "refresh token revoked")
	}

	// Rotate: revoke old, issue new
	_ = s.repo.RevokeRefreshToken(ctx, claims.UserID, tokenID)

	u, err := s.repo.GetUserByID(ctx, claims.UserID)
	if err != nil || u == nil {
		return nil, fiber.NewError(fiber.StatusUnauthorized, "user not found")
	}

	return s.issueTokenPair(ctx, u)
}

func (s *Service) Logout(ctx context.Context, userID, tokenID string) error {
	return s.repo.RevokeRefreshToken(ctx, userID, tokenID)
}

func (s *Service) Setup2FA(ctx context.Context, userID string) (string, string, error) {
	u, err := s.repo.GetUserByID(ctx, userID)
	if err != nil || u == nil {
		return "", "", fiber.NewError(fiber.StatusNotFound, "user not found")
	}

	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "Apex Trading",
		AccountName: u.Email,
	})
	if err != nil {
		return "", "", fmt.Errorf("generate totp: %w", err)
	}

	// Store secret (not yet enabled — user must verify first)
	if err := s.repo.UpdateTOTP(ctx, userID, key.Secret(), false); err != nil {
		return "", "", fmt.Errorf("store totp: %w", err)
	}

	return key.Secret(), key.URL(), nil
}

func (s *Service) Verify2FA(ctx context.Context, userID, code string) error {
	u, err := s.repo.GetUserByID(ctx, userID)
	if err != nil || u == nil {
		return fiber.NewError(fiber.StatusNotFound, "user not found")
	}

	if !totp.Validate(code, u.TOTPSecret.String) {
		return fiber.NewError(fiber.StatusBadRequest, "invalid totp code")
	}

	return s.repo.UpdateTOTP(ctx, userID, u.TOTPSecret.String, true)
}

func (s *Service) Disable2FA(ctx context.Context, userID, code string) error {
	u, err := s.repo.GetUserByID(ctx, userID)
	if err != nil || u == nil {
		return fiber.NewError(fiber.StatusNotFound, "user not found")
	}

	if !totp.Validate(code, u.TOTPSecret.String) {
		return fiber.NewError(fiber.StatusBadRequest, "invalid totp code")
	}

	return s.repo.UpdateTOTP(ctx, userID, "", false)
}

// issueTokenPair generates a new access + refresh token pair and stores the refresh token in Redis.
func (s *Service) issueTokenPair(ctx context.Context, u *UserRow) (*TokenPair, error) {
	now := time.Now()
	tokenID := uuid.NewString()

	// Access token
	accessClaims := &middleware.Claims{
		UserID: u.ID,
		Email:  u.Email,
		Role:   u.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(s.cfg.AccessTokenTTL)),
			IssuedAt:  jwt.NewNumericDate(now),
			ID:        uuid.NewString(),
		},
	}
	accessToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims).SignedString([]byte(s.cfg.AccessSecret))
	if err != nil {
		return nil, fmt.Errorf("sign access token: %w", err)
	}

	// Refresh token (longer TTL, different secret)
	refreshClaims := &middleware.Claims{
		UserID: u.ID,
		Email:  u.Email,
		Role:   u.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(s.cfg.RefreshTokenTTL)),
			IssuedAt:  jwt.NewNumericDate(now),
			ID:        tokenID,
		},
	}
	refreshToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims).SignedString([]byte(s.cfg.RefreshSecret))
	if err != nil {
		return nil, fmt.Errorf("sign refresh token: %w", err)
	}

	// Persist refresh token in Redis for revocation support
	if err := s.repo.StoreRefreshToken(ctx, u.ID, tokenID, s.cfg.RefreshTokenTTL); err != nil {
		return nil, fmt.Errorf("store refresh token: %w", err)
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    now.Add(s.cfg.AccessTokenTTL),
	}, nil
}

// ── HTTP Handler ──────────────────────────────────────────────────────────────

type Handler struct {
	svc *Service
	log *logger.Logger
}

func NewHandler(svc *Service, log *logger.Logger) *Handler {
	return &Handler{svc: svc, log: log}
}

// Register godoc
// @Summary      Register a new user
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        body body RegisterRequest true "Register request"
// @Success      201 {object} map[string]interface{}
// @Failure      400 {object} map[string]interface{}
// @Failure      409 {object} map[string]interface{}
// @Router       /auth/register [post]
func (h *Handler) Register(c *fiber.Ctx) error {
	var req RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	// TODO: validate with go-playground/validator

	pair, err := h.svc.Register(c.Context(), req)
	if err != nil {
		return err
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data":    pair,
	})
}

// Login godoc
// @Summary      Login with email and password
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        body body LoginRequest true "Login request"
// @Success      200 {object} map[string]interface{}
// @Failure      401 {object} map[string]interface{}
// @Router       /auth/login [post]
func (h *Handler) Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	pair, err := h.svc.Login(c.Context(), req)
	if err != nil {
		return err
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    pair,
	})
}

func (h *Handler) RefreshToken(c *fiber.Ctx) error {
	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := c.BodyParser(&body); err != nil || body.RefreshToken == "" {
		return fiber.NewError(fiber.StatusBadRequest, "refresh_token required")
	}

	pair, err := h.svc.RefreshToken(c.Context(), body.RefreshToken)
	if err != nil {
		return err
	}

	return c.JSON(fiber.Map{"success": true, "data": pair})
}

func (h *Handler) Logout(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if err := h.svc.Logout(c.Context(), claims.UserID, claims.ID); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "message": "logged out"})
}

func (h *Handler) Setup2FA(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	secret, otpURL, err := h.svc.Setup2FA(c.Context(), claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"secret":  secret,
			"otp_url": otpURL,
		},
	})
}

func (h *Handler) Verify2FA(c *fiber.Ctx) error {
	var body struct {
		Code string `json:"code"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "code required")
	}
	claims := middleware.GetClaims(c)
	if err := h.svc.Verify2FA(c.Context(), claims.UserID, body.Code); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "message": "2fa enabled"})
}

func (h *Handler) Disable2FA(c *fiber.Ctx) error {
	var body struct {
		Code string `json:"code"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "code required")
	}
	claims := middleware.GetClaims(c)
	if err := h.svc.Disable2FA(c.Context(), claims.UserID, body.Code); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "message": "2fa disabled"})
}
