package market

import (
	"context"
	"maps"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/apex-trading/apex-backend/pkg/logger"
)

func testSource(t *testing.T, coinbase, frankfurter, gold string) *priceSource {
	t.Helper()
	return &priceSource{
		client:      &http.Client{Timeout: 2 * time.Second},
		log:         logger.New("test"),
		coinbaseURL: coinbase,
		frankfurter: frankfurter,
		goldURL:     gold,
	}
}

// TestApplyLiveOverridesFallback verifies that when every source responds, all
// seeds are overwritten with correctly-converted live values.
func TestApplyLiveOverridesFallback(t *testing.T) {
	cb := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"data":{"amount":"101234.56","base":"BTC","currency":"USD"}}`))
	}))
	defer cb.Close()

	fx := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		// base USD: units per 1 USD
		_, _ = w.Write([]byte(`{"base":"USD","rates":{"EUR":0.90,"GBP":0.80,"JPY":150,"CHF":0.80,"AUD":1.60}}`))
	}))
	defer fx.Close()

	gold := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"name":"Gold","price":2700.5}`))
	}))
	defer gold.Close()

	seeds := maps.Clone(staticSeeds)

	// coinbaseURL is a base; fetchCoinbaseSpot appends /prices/<pair>/spot.
	// The test server ignores the path and always returns the BTC payload.
	src := testSource(t, cb.URL, fx.URL, gold.URL)
	src.apply(context.Background(), seeds)

	if got := seeds["BTCUSD"]; got != 101234.56 {
		t.Errorf("BTCUSD = %v, want 101234.56", got)
	}
	// EURUSD = 1/0.90 ≈ 1.1111
	if got := seeds["EURUSD"]; got < 1.11 || got > 1.112 {
		t.Errorf("EURUSD = %v, want ~1.1111", got)
	}
	if got := seeds["USDJPY"]; got != 150 {
		t.Errorf("USDJPY = %v, want 150", got)
	}
	if got := seeds["USDCHF"]; got != 0.80 {
		t.Errorf("USDCHF = %v, want 0.80", got)
	}
	if got := seeds["XAUUSD"]; got != 2700.5 {
		t.Errorf("XAUUSD = %v, want 2700.5", got)
	}
}

// TestApplyKeepsFallbackOnError verifies that unreachable sources leave the
// static fallback values untouched — the platform stays viewable offline.
func TestApplyKeepsFallbackOnError(t *testing.T) {
	// All sources point at a closed server → connection refused.
	dead := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {}))
	deadURL := dead.URL
	dead.Close()

	seeds := maps.Clone(staticSeeds)

	src := testSource(t, deadURL, deadURL, deadURL)
	src.apply(context.Background(), seeds)

	for sym, want := range staticSeeds {
		if seeds[sym] != want {
			t.Errorf("%s = %v, want fallback %v", sym, seeds[sym], want)
		}
	}
}
