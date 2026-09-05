// Command server is the entrypoint for the Go Decision + Execution planes.
//
// Phase 0: stdlib-only HTTP server exposing liveness/version.
// Phase 1: connects to PostgreSQL (pgx) and mounts the idempotent payment-event ingestion.
// Phase 2–5: recovery pipeline (diagnose → P(success) → ERV → full policy) persisted to Postgres.
// Phase 6: real/mock execution with pending_confirmation + reconciliation; Redis (optional,
//
//	never authoritative) for cooldown/rate counters + job queue.
//
// Phase 7: merchant-scoped public API (decisions, metrics, audit, override, kill switch, config).
// Phase 10: /metrics Prometheus endpoint + structured logging.
package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/api"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/cache"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/config"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/db"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/diagnosis/llm"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/execapi"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/executor"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/ingest"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/metrics"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/pipeline"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/reconcile"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/scoreapi"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/store"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/successmodel"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	cfg := config.Load()

	rootCtx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// Durable store (single source of truth). Configured-but-unreachable is fatal.
	var database *sql.DB
	if cfg.DatabaseURL != "" {
		database = mustConnect(cfg.DatabaseURL)
		defer func() { _ = database.Close() }()
	} else {
		slog.Warn("ingestion disabled: DATABASE_URL not set (liveness/version only)")
	}

	// Phase 6: optional Redis (ephemeral, never authoritative — PLAN.md §13). A missing/down
	// Redis degrades to the Postgres-derived checks; the engine keeps working.
	redisCache, err := cache.New(cfg.RedisURL)
	if err != nil {
		slog.Error("invalid REDIS_URL", "err", err)
	}
	defer func() { _ = redisCache.Close() }()
	if cfg.RedisURL == "" {
		slog.Warn("Redis disabled: REDIS_URL not set (cooldown/rate checks use Postgres-derived facts)")
	} else if redisCache.Available() {
		slog.Info("Redis connected (cooldown/rate accelerator + job queue)")
	} else {
		slog.Warn("Redis configured but unreachable at startup; falling back to Postgres-derived facts")
	}

	scorer := loadScorer(cfg.SuccessModelPath)
	diagOpts := loadDiagnoserOpts(cfg, logger)

	// Phase 6: choose the executor. Real Razorpay sandbox when credentials are set; otherwise the
	// deterministic mock (PLAN.md §15 MVP). Both satisfy StatusResolver for reconciliation.
	dispatcher := chooseDispatcher(cfg, logger)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", healthHandler(cfg, database, redisCache))
	mux.HandleFunc("GET /ready", readyHandler(database, redisCache))
	mux.HandleFunc("GET /version", versionHandler(cfg))
	mux.HandleFunc("GET /metrics", metrics.Handler())

	// Internal scoring/explainability endpoints.
	var costs scoreapi.CostSource
	if database != nil {
		costs = store.New(database)
	}
	internalAPI := scoreapi.NewHandlers(scorer, costs)
	mux.HandleFunc("POST /internal/success-model/score", internalAPI.Score)
	mux.HandleFunc("POST /internal/erv/compute", internalAPI.ErvCompute)

	if database != nil {
		st := store.New(database)
		runner := pipeline.NewRunner(st, dispatcher, scorer, logger, diagOpts...)
		mux.HandleFunc(
			"POST /v1/merchants/{id}/events/payment-failed",
			ingest.NewHandler(st, runner, cfg.WebhookSecret, logger),
		)
		if cfg.WebhookSecret == "" {
			slog.Warn("webhook signature verification DISABLED: WEBHOOK_SECRET not set")
		}

		// Phase 6: reconciliation (background loop + on-demand endpoint) + execute-action.
		var reconciler *reconcile.Reconciler
		if resolver, ok := dispatcher.(executor.StatusResolver); ok {
			reconciler = reconcile.NewReconciler(st, resolver, logger)
			go reconciler.RunLoop(rootCtx, cfg.ReconcileInterval)
			if cfg.ReconcileInterval > 0 {
				slog.Info("reconciliation loop started", "interval", cfg.ReconcileInterval)
			}
		}
		execapi.NewHandlers(dispatcher, st, reconciler, logger).Register(mux)

		// Phase 7: merchant-scoped public API.
		apiHandlers := api.NewHandlers(st, api.Auth{MerchantKey: cfg.APIKey, AdminKey: cfg.AdminAPIKey}, logger)
		apiHandlers.Register(mux)
		if cfg.APIKey == "" {
			slog.Warn("public API auth DISABLED: API_KEY not set (dev only)")
		}
		if cfg.AdminAPIKey == "" {
			slog.Warn("admin API auth DISABLED: ADMIN_API_KEY not set (dev only)")
		}
		slog.Info("public + internal APIs mounted")
	}
	slog.Info("internal scoring endpoints mounted", "success_model", scorer.Version())

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           requestLogger(logger, mux),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		slog.Info("decision-engine starting", "port", cfg.Port, "version", cfg.Version)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server error", "err", err)
			os.Exit(1)
		}
	}()

	<-rootCtx.Done()
	slog.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("graceful shutdown failed", "err", err)
	}
}

// chooseDispatcher selects the real Razorpay sandbox executor when credentials are configured,
// else the deterministic mock (PLAN.md §15).
func chooseDispatcher(cfg config.Config, logger *slog.Logger) executor.Dispatcher {
	if cfg.RazorpayKeyID != "" && cfg.RazorpayKeySecret != "" {
		slog.Info("using Razorpay sandbox executor", "base_url", cfg.RazorpayBaseURL)
		return executor.NewRazorpayDispatcher(cfg.RazorpayBaseURL, cfg.RazorpayKeyID, cfg.RazorpayKeySecret, 8*time.Second, logger)
	}
	slog.Warn("using MOCK executor: RAZORPAY_KEY_ID/SECRET not set (no real money movement)")
	return executor.MockDispatcher{}
}

func mustConnect(dsn string) *sql.DB {
	const attempts = 10
	var lastErr error
	for i := 0; i < attempts; i++ {
		database, err := db.Connect(context.Background(), dsn)
		if err == nil {
			slog.Info("connected to database")
			return database
		}
		lastErr = err
		slog.Warn("database not ready, retrying", "attempt", i+1, "err", err)
		time.Sleep(time.Second)
	}
	slog.Error("could not connect to database", "err", lastErr)
	os.Exit(1)
	return nil
}

func loadScorer(path string) successmodel.Scorer {
	if path == "" {
		slog.Warn("SUCCESS_MODEL_PATH not set: using Phase-2 heuristic P(success) estimator")
		return successmodel.HeuristicScorer{}
	}
	model, err := successmodel.LoadModel(path)
	if err != nil {
		slog.Warn("could not load success model; falling back to heuristic estimator", "path", path, "err", err)
		return successmodel.HeuristicScorer{}
	}
	slog.Info("loaded statistical P(success) model", "path", path, "version", model.Version())
	return model
}

func loadDiagnoserOpts(cfg config.Config, logger *slog.Logger) []pipeline.Option {
	if cfg.DiagnosisServiceURL == "" {
		slog.Warn("DIAGNOSIS_SERVICE_URL not set: using deterministic rule-based diagnosis")
		return nil
	}
	slog.Info("LLM diagnosis enabled (rule-based fallback on any failure)",
		"service_url", cfg.DiagnosisServiceURL, "timeout", cfg.DiagnosisTimeout)
	d := llm.New(cfg.DiagnosisServiceURL, cfg.DiagnosisTimeout, logger)
	return []pipeline.Option{pipeline.WithDiagnoser(d)}
}

type healthResponse struct {
	Status  string `json:"status"`
	Service string `json:"service"`
	Version string `json:"version"`
	DB      string `json:"db"`    // "ok" | "down" | "disabled"
	Redis   string `json:"redis"` // "ok" | "down" | "disabled"
}

func healthHandler(cfg config.Config, database *sql.DB, c cache.Cache) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		dbState := dbStatus(r.Context(), database)
		redisState := redisStatus(r.Context(), c)
		metrics.SetDBUp(dbState == "ok")
		metrics.SetRedisUp(redisState == "ok")
		writeJSON(w, http.StatusOK, healthResponse{
			Status: "ok", Service: cfg.ServiceName, Version: cfg.Version, DB: dbState, Redis: redisState,
		})
	}
}

// readyHandler is a readiness probe: 200 only when the durable store is reachable (Redis being
// down does not flip readiness — it is optional by design).
func readyHandler(database *sql.DB, c cache.Cache) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if database == nil || dbStatus(r.Context(), database) != "ok" {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not_ready", "db": dbStatus(r.Context(), database)})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ready", "db": "ok", "redis": redisStatus(r.Context(), c)})
	}
}

func dbStatus(ctx context.Context, database *sql.DB) string {
	if database == nil {
		return "disabled"
	}
	pingCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	if err := database.PingContext(pingCtx); err != nil {
		return "down"
	}
	return "ok"
}

func redisStatus(ctx context.Context, c cache.Cache) string {
	if c == nil || !c.Available() {
		if c == nil {
			return "disabled"
		}
		// Distinguish unconfigured (Noop) from configured-but-down.
		if _, isNoop := c.(cache.Noop); isNoop {
			return "disabled"
		}
		return "down"
	}
	pingCtx, cancel := context.WithTimeout(ctx, 1*time.Second)
	defer cancel()
	if err := c.Ping(pingCtx); err != nil {
		return "down"
	}
	return "ok"
}

func versionHandler(cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"service": cfg.ServiceName, "version": cfg.Version})
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// statusRecorder captures the response status for logging + metrics.
type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}

func requestLogger(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		dur := time.Since(start)
		metrics.ObserveHTTP(r.Method, rec.status, dur.Seconds())
		logger.Info("request", "method", r.Method, "path", r.URL.Path, "status", rec.status, "dur_ms", dur.Milliseconds())
	})
}
