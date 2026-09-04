// Package config loads decision-engine configuration from the environment.
// Kept stdlib-only. Phase 1 adds DATABASE_URL (durable store) and WEBHOOK_SECRET
// (ingestion signature verification); Phase 3 adds SUCCESS_MODEL_PATH (the trained P(success)
// artifact); REDIS_URL is wired in Phase 6.
package config

import "os"

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
}

// Load reads configuration from environment variables, applying sane defaults.
func Load() Config {
	return Config{
		Port:             getenv("DECISION_ENGINE_PORT", "8080"),
		ServiceName:      getenv("SERVICE_NAME", "decision-engine"),
		Version:          getenv("SERVICE_VERSION", "0.1.0"),
		DatabaseURL:      os.Getenv("DATABASE_URL"),
		WebhookSecret:    os.Getenv("WEBHOOK_SECRET"),
		SuccessModelPath: os.Getenv("SUCCESS_MODEL_PATH"),
	}
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
