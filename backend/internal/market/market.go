package market

import (
	"context"
	"encoding/json"
	"math"
	"math/rand/v2"
	"sync"
	"time"

	"github.com/apex-trading/apex-backend/pkg/logger"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
	"github.com/jmoiron/sqlx"
)

// ── Domain types ──────────────────────────────────────────────────────────────

type Instrument struct {
	Symbol   string  `db:"symbol"    json:"symbol"`
	Base     string  `db:"base"      json:"base"`
	Quote    string  `db:"quote"     json:"quote"`
	PipSize  float64 `db:"pip_size"  json:"pip_size"`
	MinQty   float64 `db:"min_qty"   json:"min_qty"`
	IsActive bool    `db:"is_active" json:"is_active"`
}

type Tick struct {
	Symbol    string  `json:"symbol"`
	Bid       float64 `json:"bid"`
	Ask       float64 `json:"ask"`
	Mid       float64 `json:"mid"`
	Spread    float64 `json:"spread"`
	Timestamp int64   `json:"timestamp"`
}

type OHLCV struct {
	Symbol    string    `db:"symbol"    json:"symbol"`
	Timeframe string    `db:"timeframe" json:"timeframe"`
	OpenTime  time.Time `db:"open_time" json:"open_time"`
	Open      float64   `db:"open"      json:"open"`
	High      float64   `db:"high"      json:"high"`
	Low       float64   `db:"low"       json:"low"`
	Close     float64   `db:"close"     json:"close"`
	Volume    float64   `db:"volume"    json:"volume"`
}

// ── Seed data ─────────────────────────────────────────────────────────────────
// Initial mid prices are resolved at startup by resolveSeeds (see seed.go),
// which anchors to real-world figures from free sources with a static fallback.

var halfSpreads = map[string]float64{
	"EURUSD": 0.00010,
	"GBPUSD": 0.00015,
	"USDJPY": 0.010,
	"USDCHF": 0.00015,
	"AUDUSD": 0.00015,
	"XAUUSD": 0.25,
	"BTCUSD": 25.0,
}

// volatility is the max pip step per 500ms tick.
var volatility = map[string]float64{
	"EURUSD": 0.00020,
	"GBPUSD": 0.00025,
	"USDJPY": 0.025,
	"USDCHF": 0.00020,
	"AUDUSD": 0.00020,
	"XAUUSD": 0.50,
	"BTCUSD": 50.0,
}

// ── Hub ───────────────────────────────────────────────────────────────────────

// Hub manages WebSocket clients and broadcasts price ticks. It also fans ticks
// out to internal Go consumers (e.g. the order processor) via subscriber channels.
type Hub struct {
	mu       sync.RWMutex
	subs     map[string]map[*Client]struct{} // symbol → clients
	prices   sync.Map                        // symbol → Tick
	tickSubs map[chan Tick]struct{}          // internal consumers → every tick
}

func newHub() *Hub {
	return &Hub{
		subs:     make(map[string]map[*Client]struct{}),
		tickSubs: make(map[chan Tick]struct{}),
	}
}

// Subscribe registers an internal consumer channel to receive every tick.
// Sends are non-blocking; a full channel drops the tick to avoid stalling the hub.
func (h *Hub) Subscribe(ch chan Tick) {
	h.mu.Lock()
	h.tickSubs[ch] = struct{}{}
	h.mu.Unlock()
}

// Unsubscribe removes an internal consumer channel.
func (h *Hub) Unsubscribe(ch chan Tick) {
	h.mu.Lock()
	delete(h.tickSubs, ch)
	h.mu.Unlock()
}

func (h *Hub) addClient(_ *Client) {}

func (h *Hub) removeClient(c *Client) {
	h.mu.Lock()
	for _, set := range h.subs {
		delete(set, c)
	}
	h.mu.Unlock()
}

func (h *Hub) subscribe(c *Client, symbol string) {
	h.mu.Lock()
	if h.subs[symbol] == nil {
		h.subs[symbol] = make(map[*Client]struct{})
	}
	h.subs[symbol][c] = struct{}{}
	h.mu.Unlock()

	// Send current snapshot immediately
	if v, ok := h.prices.Load(symbol); ok {
		c.writeJSON(fiber.Map{"type": "tick", "symbol": symbol, "data": v.(Tick)})
	}
	c.writeJSON(fiber.Map{"type": "subscribed", "symbol": symbol})
}

func (h *Hub) unsubscribe(c *Client, symbol string) {
	h.mu.Lock()
	if h.subs[symbol] != nil {
		delete(h.subs[symbol], c)
	}
	h.mu.Unlock()
}

func (h *Hub) broadcast(tick Tick) {
	h.prices.Store(tick.Symbol, tick)

	msg, _ := json.Marshal(fiber.Map{"type": "tick", "symbol": tick.Symbol, "data": tick})

	h.mu.RLock()
	clients := h.subs[tick.Symbol]
	for c := range clients {
		c.writeRaw(msg)
	}
	// Fan out to internal consumers (non-blocking; drop on slow consumer).
	for ch := range h.tickSubs {
		select {
		case ch <- tick:
		default:
		}
	}
	h.mu.RUnlock()
}

// GetPrice returns the latest tick for a symbol (used by order + portfolio services).
func (h *Hub) GetPrice(symbol string) (Tick, bool) {
	v, ok := h.prices.Load(symbol)
	if !ok {
		return Tick{}, false
	}
	return v.(Tick), true
}

// ── Client ────────────────────────────────────────────────────────────────────

type Client struct {
	mu   sync.Mutex
	conn *websocket.Conn
}

func (c *Client) writeJSON(v any) {
	c.mu.Lock()
	defer c.mu.Unlock()
	_ = c.conn.WriteJSON(v)
}

func (c *Client) writeRaw(b []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()
	_ = c.conn.WriteMessage(websocket.TextMessage, b)
}

// ── Repository ────────────────────────────────────────────────────────────────

type Repository struct{ db *sqlx.DB }

func NewRepository(db *sqlx.DB) *Repository { return &Repository{db: db} }

func (r *Repository) ListInstruments(ctx context.Context) ([]Instrument, error) {
	var out []Instrument
	err := r.db.SelectContext(ctx, &out,
		`SELECT symbol, base, quote, pip_size, min_qty, is_active
		 FROM instruments WHERE is_active = true ORDER BY symbol`)
	return out, err
}

func (r *Repository) UpsertCandle(ctx context.Context, c *OHLCV) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO ohlcv (symbol, timeframe, open_time, open, high, low, close, volume)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (symbol, timeframe, open_time) DO UPDATE
		  SET high   = GREATEST(ohlcv.high,  EXCLUDED.high),
		      low    = LEAST(ohlcv.low,    EXCLUDED.low),
		      close  = EXCLUDED.close,
		      volume = ohlcv.volume + EXCLUDED.volume
	`, c.Symbol, c.Timeframe, c.OpenTime, c.Open, c.High, c.Low, c.Close, c.Volume)
	return err
}

func (r *Repository) GetCandles(ctx context.Context, symbol, timeframe string, limit int) ([]OHLCV, error) {
	if limit <= 0 || limit > 1000 {
		limit = 500
	}
	var rows []OHLCV
	// Subquery to get last N rows in ascending order for chart rendering
	err := r.db.SelectContext(ctx, &rows, `
		SELECT symbol, timeframe, open_time, open, high, low, close, volume
		FROM (
			SELECT symbol, timeframe, open_time, open, high, low, close, volume
			FROM ohlcv
			WHERE symbol = $1 AND timeframe = $2
			ORDER BY open_time DESC
			LIMIT $3
		) sub
		ORDER BY open_time ASC
	`, symbol, timeframe, limit)
	return rows, err
}

// ── OHLCV aggregator ──────────────────────────────────────────────────────────

type candleState struct {
	candle   OHLCV
	openTime time.Time
}

// ── Service ───────────────────────────────────────────────────────────────────

type Service struct {
	repo      *Repository
	hub       *Hub
	log       *logger.Logger
	candleMu  sync.Mutex
	candles   map[string]*candleState
}

func NewService(repo *Repository, log *logger.Logger) *Service {
	s := &Service{
		repo:    repo,
		hub:     newHub(),
		log:     log,
		candles: make(map[string]*candleState),
	}
	go s.runSimulator()
	return s
}

// Hub exposes the price hub so other domains can query current prices.
func (s *Service) Hub() *Hub { return s.hub }

func (s *Service) ListInstruments(ctx context.Context) ([]Instrument, error) {
	return s.repo.ListInstruments(ctx)
}

func (s *Service) GetCandles(ctx context.Context, symbol, timeframe string, limit int) ([]OHLCV, error) {
	return s.repo.GetCandles(ctx, symbol, timeframe, limit)
}

func (s *Service) runSimulator() {
	// Resolve initial prices from real-world sources (with static fallback),
	// then random-walk forward from those anchors.
	seeds := resolveSeeds(s.log)
	for symbol, mid := range seeds {
		s.hub.prices.Store(symbol, makeTick(symbol, mid))
	}

	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for range ticker.C {
		for symbol := range seeds {
			v, _ := s.hub.prices.Load(symbol)
			prev := v.(Tick)
			step := (rand.Float64() - 0.49) * volatility[symbol] * 2
			tick := makeTick(symbol, prev.Mid+step)
			s.hub.broadcast(tick)
			s.aggregateTick(tick)
		}
	}
}

func (s *Service) aggregateTick(tick Tick) {
	openTime := time.UnixMilli(tick.Timestamp).UTC().Truncate(time.Minute)

	s.candleMu.Lock()
	state, exists := s.candles[tick.Symbol]

	if !exists || !state.openTime.Equal(openTime) {
		// Persist the completed candle asynchronously
		if exists {
			completed := state.candle
			go func() {
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				if err := s.repo.UpsertCandle(ctx, &completed); err != nil {
					s.log.Error("failed to persist candle", logger.Error(err))
				}
			}()
		}
		// Start new candle
		s.candles[tick.Symbol] = &candleState{
			openTime: openTime,
			candle: OHLCV{
				Symbol:    tick.Symbol,
				Timeframe: "1m",
				OpenTime:  openTime,
				Open:      tick.Mid,
				High:      tick.Mid,
				Low:       tick.Mid,
				Close:     tick.Mid,
				Volume:    1,
			},
		}
		s.candleMu.Unlock()
		return
	}

	// Update existing candle
	if tick.Mid > state.candle.High {
		state.candle.High = tick.Mid
	}
	if tick.Mid < state.candle.Low {
		state.candle.Low = tick.Mid
	}
	state.candle.Close = tick.Mid
	state.candle.Volume++
	s.candleMu.Unlock()

	// Upsert current candle to DB on every tick so data survives restarts
	candle := state.candle
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := s.repo.UpsertCandle(ctx, &candle); err != nil {
			s.log.Error("failed to upsert candle", logger.Error(err))
		}
	}()
}

func makeTick(symbol string, mid float64) Tick {
	hs := halfSpreads[symbol]
	return Tick{
		Symbol:    symbol,
		Bid:       round(mid-hs, 6),
		Ask:       round(mid+hs, 6),
		Mid:       round(mid, 6),
		Spread:    round(hs*2, 6),
		Timestamp: time.Now().UnixMilli(),
	}
}

func round(f float64, decimals int) float64 {
	factor := math.Pow(10, float64(decimals))
	return math.Round(f*factor) / factor
}

// ── Handler ───────────────────────────────────────────────────────────────────

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) ListInstruments(c *fiber.Ctx) error {
	instruments, err := h.svc.ListInstruments(c.Context())
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": instruments})
}

func (h *Handler) GetCandles(c *fiber.Ctx) error {
	symbol := c.Params("symbol")
	if symbol == "" {
		return fiber.NewError(fiber.StatusBadRequest, "symbol required")
	}
	timeframe := c.Query("timeframe", "1m")
	limit := min(c.QueryInt("limit", 500), 1000)

	candles, err := h.svc.GetCandles(c.Context(), symbol, timeframe, limit)
	if err != nil {
		return err
	}
	if candles == nil {
		candles = []OHLCV{}
	}
	return c.JSON(fiber.Map{"success": true, "data": candles})
}

type wsMsg struct {
	Type   string `json:"type"`
	Symbol string `json:"symbol,omitempty"`
}

// WebSocket is the Fiber WebSocket handler for /api/v1/ws/prices.
func (h *Handler) WebSocket(c *websocket.Conn) {
	client := &Client{conn: c}
	h.svc.hub.addClient(client)
	defer h.svc.hub.removeClient(client)

	for {
		var msg wsMsg
		if err := c.ReadJSON(&msg); err != nil {
			break // client disconnected or sent invalid data
		}
		switch msg.Type {
		case "subscribe":
			if msg.Symbol != "" {
				h.svc.hub.subscribe(client, msg.Symbol)
			}
		case "unsubscribe":
			if msg.Symbol != "" {
				h.svc.hub.unsubscribe(client, msg.Symbol)
			}
		case "ping":
			client.writeJSON(fiber.Map{"type": "pong"})
		}
	}
}
