// Package config loads decision-engine configuration from the environment.
// Kept stdlib-only. Phase 1 adds DATABASE_URL (durable store) and WEBHOOK_SECRET
// (ingestion signature verification); Phase 3 adds SUCCESS_MODEL_PATH (the trained P(success)
// artifact); Phase 4 adds DIAGNOSIS_SERVICE_URL + DIAGNOSIS_TIMEOUT_MS (the LLM diagnosis
// gateway, with a bounded per-call timeout); REDIS_URL is wired in Phase 6.
package config

import (
	"os"
	"strconv"
	"time"
)

// Config holds runtime configuration for the decision engine.
type Config struct {
	Port        string
	ServiceName string
	Version     string

	// DatabaseURL is the PostgreSQL DSN (single source of truth). When empty, the
	// service still boots for liveness/version but the ingestion endpoint is disabled.
	DatabaseURL string

	// WebhookSecret is the shared secret for HMAC-SHA256 verification of inbound webhook
	// bodies. When empty, signature verification is disabled (dev convenience) and the
	// service logs a warning at startup — never silently in production.
	WebhookSecret string

	// SuccessModelPath is the path to the trained P(success) logistic-regression artifact
	// (ml/artifacts/success_model.json). When empty or unreadable, the engine falls back to
	// the Phase-2 heuristic estimator and logs it at startup — the pipeline never stalls on a
	// missing model.
	SuccessModelPath string

	// DiagnosisServiceURL is the base URL of the Phase 4 LLM diagnosis service (Intelligence
	// plane). When empty, the decision plane uses the deterministic Phase-2 rule table directly
	// (logged at startup). When set, the pipeline calls the service and falls back to the rule
	// table on any failure — so the decision plane keeps functioning even if intelligence is down.
	DiagnosisServiceURL string

	// DiagnosisTimeout bounds a single call to the diagnosis service. It must stay well under
	// the ingest handler's overall pipeline budget so a slow LLM degrades to rule-based rather
	// than wedging ingestion. Sourced from DIAGNOSIS_TIMEOUT_MS (milliseconds).
	DiagnosisTimeout time.Duration
}

// defaultDiagnosisTimeout is the per-call ceiling for the LLM diagnosis service when
// DIAGNOSIS_TIMEOUT_MS is unset. Comfortably under the ingest pipeline's 15s budget.
const defaultDiagnosisTimeout = 6 * time.Second

// Load reads configuration from environment variables, applying sane defaults.
func Load() Config {
	return Config{
		Port:                getenv("DECISION_ENGINE_PORT", "8080"),
		ServiceName:         getenv("SERVICE_NAME", "decision-engine"),
		Version:             getenv("SERVICE_VERSION", "0.1.0"),
		DatabaseURL:         os.Getenv("DATABASE_URL"),
		WebhookSecret:       os.Getenv("WEBHOOK_SECRET"),
		SuccessModelPath:    os.Getenv("SUCCESS_MODEL_PATH"),
		DiagnosisServiceURL: os.Getenv("DIAGNOSIS_SERVICE_URL"),
		DiagnosisTimeout:    getdurationMs("DIAGNOSIS_TIMEOUT_MS", defaultDiagnosisTimeout),
	}
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// getdurationMs reads a millisecond count from the environment, returning def when unset,
// non-numeric, or non-positive (a zero/negative timeout would defeat the bound).
func getdurationMs(key string, def time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	ms, err := strconv.Atoi(v)
	if err != nil || ms <= 0 {
		return def
	}
	return time.Duration(ms) * time.Millisecond
}
