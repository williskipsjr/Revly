// Package config loads decision-engine configuration from the environment.
// Kept stdlib-only. Phase 1 adds DATABASE_URL (durable store) and WEBHOOK_SECRET
// (ingestion signature verification); Phase 3 adds SUCCESS_MODEL_PATH (the trained P(success)
// artifact); Phase 4 adds DIAGNOSIS_SERVICE_URL + DIAGNOSIS_TIMEOUT_MS (the LLM diagnosis
// gateway, with a bounded per-call timeout); Phase 6 adds REDIS_URL (ephemeral cooldown/rate
// counters + job queue; never authoritative) and the optional RAZORPAY_* sandbox credentials;
// Phase 7 adds API_KEY / ADMIN_API_KEY (public API auth).
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

	// RedisURL is the Redis DSN for the Phase 6 ephemeral cooldown/rate-limit counters and job
	// queue. Redis is NEVER authoritative (PLAN.md §13): when empty or unreachable, all checks
	// fall back to the Postgres-derived facts, so correctness never depends on Redis being up.
	RedisURL string

	// ReconcileInterval is how often the background reconciler sweeps pending_confirmation
	// actions (Phase 6). Zero disables the background loop (the endpoint still works on demand).
	// Sourced from RECONCILE_INTERVAL_MS.
	ReconcileInterval time.Duration

	// Razorpay sandbox credentials (Phase 6). When RazorpayKeyID is set, the executor dispatches
	// against the Razorpay sandbox with an external idempotency-key header; otherwise it uses the
	// deterministic MockDispatcher (PLAN.md §15 MVP: notify/alt-method may be mocked).
	RazorpayKeyID     string
	RazorpayKeySecret string
	RazorpayBaseURL   string

	// APIKey gates the Phase 7 merchant-scoped public API (GET decisions/metrics/audit, POST
	// override). When empty, API auth is disabled (dev convenience) and logged at startup.
	APIKey string

	// AdminAPIKey gates the admin-only Phase 7 endpoints (kill switch, policy-config). When
	// empty, admin auth is disabled (dev convenience) and logged at startup.
	AdminAPIKey string
}

// defaultDiagnosisTimeout is the per-call ceiling for the LLM diagnosis service when
// DIAGNOSIS_TIMEOUT_MS is unset. Comfortably under the ingest pipeline's 15s budget.
const defaultDiagnosisTimeout = 6 * time.Second

// defaultReconcileInterval sweeps pending_confirmation actions periodically. Zero (unset)
// disables the background loop.
const defaultReconcileInterval = 0

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
		RedisURL:            os.Getenv("REDIS_URL"),
		ReconcileInterval:   getdurationMs("RECONCILE_INTERVAL_MS", defaultReconcileInterval),
		RazorpayKeyID:       os.Getenv("RAZORPAY_KEY_ID"),
		RazorpayKeySecret:   os.Getenv("RAZORPAY_KEY_SECRET"),
		RazorpayBaseURL:     getenv("RAZORPAY_BASE_URL", "https://api.razorpay.com"),
		APIKey:              os.Getenv("API_KEY"),
		AdminAPIKey:         os.Getenv("ADMIN_API_KEY"),
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
