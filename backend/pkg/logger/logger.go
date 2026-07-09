package logger

import (
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// Logger wraps zap.Logger to keep the API surface thin and testable.
type Logger struct {
	*zap.Logger
}

// New creates a JSON logger in production and a colored console logger otherwise.
func New(env string) *Logger {
	var cfg zap.Config

	if env == "production" {
		cfg = zap.NewProductionConfig()
	} else {
		cfg = zap.NewDevelopmentConfig()
		cfg.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
	}

	l, err := cfg.Build(zap.AddCallerSkip(0))
	if err != nil {
		panic("failed to init logger: " + err.Error())
	}

	return &Logger{l}
}

// ── Typed field constructors ───────────────────────────────────────────────────

func String(key, val string) zap.Field          { return zap.String(key, val) }
func Error(err error) zap.Field                  { return zap.Error(err) }
func Int(key string, val int) zap.Field          { return zap.Int(key, val) }
func Float64(key string, val float64) zap.Field  { return zap.Float64(key, val) }
func Duration(key string, val time.Duration) zap.Field { return zap.Duration(key, val) }
func Bool(key string, val bool) zap.Field        { return zap.Bool(key, val) }
