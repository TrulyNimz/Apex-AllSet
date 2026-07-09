package market

import (
	"context"
	"encoding/json"
	"fmt"
	"maps"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/apex-trading/apex-backend/pkg/logger"
)

// staticSeeds are realistic fallback mid prices (refreshed for 2026). They are
// used when MARKET_SEED_SOURCE=static, or whenever a live fetch is unavailable
// so the platform is always viewable — including fully offline.
var staticSeeds = map[string]float64{
	"EURUSD": 1.08000,
	"GBPUSD": 1.27000,
	"USDJPY": 155.000,
	"USDCHF": 0.88000,
	"AUDUSD": 0.65000,
	"XAUUSD": 2650.00,
	"BTCUSD": 98000.0,
}

// priceSource fetches current spot prices from free, keyless public APIs.
// Endpoints are struct fields so tests can point them at httptest servers.
type priceSource struct {
	client      *http.Client
	log         *logger.Logger
	coinbaseURL string // base, e.g. https://api.coinbase.com/v2
	frankfurter string // full latest endpoint, base=USD
	goldURL     string // full gold spot endpoint
}

func newPriceSource(log *logger.Logger) *priceSource {
	return &priceSource{
		client:      &http.Client{Timeout: 4 * time.Second},
		log:         log,
		coinbaseURL: "https://api.coinbase.com/v2",
		frankfurter: "https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,CHF,AUD",
		goldURL:     "https://api.gold-api.com/price/XAU",
	}
}

// resolveSeeds returns the initial mid price for every instrument, honoring
// MARKET_SEED_SOURCE (default "live"). It is best-effort: any symbol whose live
// fetch fails keeps its static fallback value, and the call never blocks longer
// than the source client's timeout.
func resolveSeeds(log *logger.Logger) map[string]float64 {
	out := make(map[string]float64, len(staticSeeds))
	maps.Copy(out, staticSeeds)

	if strings.EqualFold(os.Getenv("MARKET_SEED_SOURCE"), "static") {
		log.Info("market seeds: static mode (live fetch disabled)")
		return out
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	newPriceSource(log).apply(ctx, out)
	return out
}

// apply overwrites entries in seeds with live values where a source succeeds,
// logging the anchor source per symbol and leaving the fallback in place on error.
func (p *priceSource) apply(ctx context.Context, seeds map[string]float64) {
	// Crypto — Coinbase public spot (keyless).
	if v, err := p.fetchCoinbaseSpot(ctx, "BTC-USD"); err == nil && v > 0 {
		seeds["BTCUSD"] = v
		p.anchored("BTCUSD", "coinbase", v)
	} else {
		p.fellBack("BTCUSD", err)
	}

	// FX — Frankfurter (ECB data, keyless). One call yields all five pairs.
	if rates, err := p.fetchFrankfurterUSD(ctx); err == nil {
		p.applyFX(seeds, rates)
	} else {
		p.fellBack("FX", err)
	}

	// Gold — gold-api.com (keyless); no reliable free keyless alternative, so
	// this is purely best-effort on top of the static fallback.
	if v, err := p.fetchGold(ctx); err == nil && v > 0 {
		seeds["XAUUSD"] = v
		p.anchored("XAUUSD", "gold-api", v)
	} else {
		p.fellBack("XAUUSD", err)
	}
}

// applyFX converts USD-based rates (units per 1 USD) into the pair conventions
// the platform trades.
func (p *priceSource) applyFX(seeds map[string]float64, r map[string]float64) {
	set := func(sym string, v float64, ok bool) {
		if ok && v > 0 {
			seeds[sym] = v
			p.anchored(sym, "frankfurter", v)
		} else {
			p.fellBack(sym, fmt.Errorf("rate missing"))
		}
	}
	eur, ok := r["EUR"]
	set("EURUSD", 1/eur, ok)
	gbp, ok := r["GBP"]
	set("GBPUSD", 1/gbp, ok)
	aud, ok := r["AUD"]
	set("AUDUSD", 1/aud, ok)
	jpy, ok := r["JPY"]
	set("USDJPY", jpy, ok) // quoted as JPY per USD already
	chf, ok := r["CHF"]
	set("USDCHF", chf, ok) // quoted as CHF per USD already
}

func (p *priceSource) fetchCoinbaseSpot(ctx context.Context, pair string) (float64, error) {
	var body struct {
		Data struct {
			Amount string `json:"amount"`
		} `json:"data"`
	}
	if err := p.getJSON(ctx, p.coinbaseURL+"/prices/"+pair+"/spot", &body); err != nil {
		return 0, err
	}
	return strconv.ParseFloat(body.Data.Amount, 64)
}

func (p *priceSource) fetchFrankfurterUSD(ctx context.Context) (map[string]float64, error) {
	var body struct {
		Rates map[string]float64 `json:"rates"`
	}
	if err := p.getJSON(ctx, p.frankfurter, &body); err != nil {
		return nil, err
	}
	if len(body.Rates) == 0 {
		return nil, fmt.Errorf("empty rates")
	}
	return body.Rates, nil
}

func (p *priceSource) fetchGold(ctx context.Context) (float64, error) {
	var body struct {
		Price float64 `json:"price"`
	}
	if err := p.getJSON(ctx, p.goldURL, &body); err != nil {
		return 0, err
	}
	return body.Price, nil
}

func (p *priceSource) getJSON(ctx context.Context, url string, dst any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	resp, err := p.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status %d", resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(dst)
}

func (p *priceSource) anchored(symbol, source string, v float64) {
	p.log.Info("market seed anchored to real price",
		logger.String("symbol", symbol),
		logger.String("source", source),
		logger.Float64("mid", round(v, 6)),
	)
}

func (p *priceSource) fellBack(symbol string, err error) {
	p.log.Warn("market seed using static fallback",
		logger.String("symbol", symbol),
		logger.Error(err),
	)
}
