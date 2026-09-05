// Command server is the entrypoint for the Go Decision + Execution planes.
//
// Phase 0: stdlib-only HTTP server exposing liveness/version.
// Phase 1: connects to PostgreSQL (pgx) and mounts the idempotent payment-event
// ingestion endpoint. If DATABASE_URL is unset the service still boots for
// liveness/version, but ingestion is disabled.
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

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/config"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/db"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/diagnosis/llm"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/executor"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/ingest"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/pipeline"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/scoreapi"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/store"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/successmodel"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	cfg := config.Load()

	// Connect to the durable store. The decision engine has no purpose without its source
	// of truth, so a configured-but-unreachable database is a fatal startup error (after a
	// short retry to absorb the container start-up race). With no DATABASE_URL we degrade to
	// Phase 0 liveness-only mode.
	var database *sql.DB
	if cfg.DatabaseURL != "" {
		database = mustConnect(cfg.DatabaseURL)
		defer func() { _ = database.Close() }()
	} else {
		slog.Warn("ingestion disabled: DATABASE_URL not set (liveness/version only)")
	}

	// Phase 3: load the trained P(success) logistic-regression artifact. If it is absent or
	// unreadable, degrade to the Phase-2 heuristic estimator rather than stalling — P(success)
	// stays a code path fully separate from diagnosis either way (PLAN.md §5/§7).
	scorer := loadScorer(cfg.SuccessModelPath)

	// Phase 4: choose the diagnoser. When DIAGNOSIS_SERVICE_URL is set, use the LLM-backed
	// diagnoser (which falls back to the rule table on any failure); otherwise the pipeline
	// uses the deterministic rule table directly. Either way diagnosis never stalls the plane.
	diagOpts := loadDiagnoserOpts(cfg, logger)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", healthHandler(cfg, database))
	mux.HandleFunc("GET /version", versionHandler(cfg))

	// Internal, service-to-service scoring/explainability endpoints (PLAN.md §9). The score
	// endpoint needs only the scorer; erv/compute needs merchant costs, so it degrades to 503
	// when no DB is configured (costs == nil).
	var costs scoreapi.CostSource
	if database != nil {
		costs = store.New(database)
	}
	internalAPI := scoreapi.NewHandlers(scorer, costs)
	mux.HandleFunc("POST /internal/success-model/score", internalAPI.Score)
	mux.HandleFunc("POST /internal/erv/compute", internalAPI.ErvCompute)

	if database != nil {
		st := store.New(database)
		// Phase 2/3: the recovery pipeline runs the full decision/execution slice for each newly
		// ingested event, sourcing P(success) from the statistical scorer. External action calls
		// are mocked (executor.MockDispatcher); Postgres is the only durable store — no Redis
		// dependency (PLAN.md §15).
		runner := pipeline.NewRunner(st, executor.MockDispatcher{}, scorer, logger, diagOpts...)
		mux.HandleFunc(
			"POST /v1/merchants/{id}/events/payment-failed",
			ingest.NewHandler(st, runner, cfg.WebhookSecret, logger),
		)
		if cfg.WebhookSecret == "" {
			slog.Warn("webhook signature verification DISABLED: WEBHOOK_SECRET not set")
		} else {
			slog.Info("webhook signature verification enabled")
		}
		slog.Info("ingestion endpoint mounted", "route", "POST /v1/merchants/{id}/events/payment-failed")
	}
	slog.Info("internal scoring endpoints mounted",
		"score", "POST /internal/success-model/score",
		"erv", "POST /internal/erv/compute",
		"success_model", scorer.Version(),
	)

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

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	<-ctx.Done()

	slog.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("graceful shutdown failed", "err", err)
	}
}

// mustConnect connects to Postgres, retrying briefly to absorb the container start-up
// race (docker-compose already gates on postgres health, but a direct `go run` may race).
// It exits the process if the database is configured but unreachable.
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
	return nil // unreachable
}

// loadScorer returns the statistical P(success) scorer loaded from path, or the Phase-2
// heuristic fallback when path is empty or the artifact cannot be read/parsed. The choice is
// logged so the active estimator is never a mystery.
func loadScorer(path string) successmodel.Scorer {
	if path == "" {
		slog.Warn("SUCCESS_MODEL_PATH not set: using Phase-2 heuristic P(success) estimator")
		return successmodel.HeuristicScorer{}
	}
	model, err := successmodel.LoadModel(path)
	if err != nil {
		slog.Warn("could not load success model; falling back to heuristic estimator",
			"path", path, "err", err)
		return successmodel.HeuristicScorer{}
	}
	slog.Info("loaded statistical P(success) model", "path", path, "version", model.Version())
	return model
}

// loadDiagnoserOpts returns the pipeline options selecting the Phase-4 LLM diagnoser when
// DIAGNOSIS_SERVICE_URL is configured, or none (rule-table default) otherwise. Mirrors
// loadScorer: the active diagnosis path is always logged, never a mystery. Note the LLM
// diagnoser still falls back to the rule table per-call if the service is unreachable — so a
// configured-but-down service degrades gracefully rather than failing decisions.
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
	DB      string `json:"db"` // "ok" | "down" | "disabled"
}

// healthHandler is a liveness probe: HTTP 200 whenever the process is serving. The db
// field reports readiness of the durable store informationally (a down DB does not flip
// liveness, so the compose healthcheck stays meaningful for process supervision).
func healthHandler(cfg config.Config, database *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, healthResponse{
			Status:  "ok",
			Service: cfg.ServiceName,
			Version: cfg.Version,
			DB:      dbStatus(r.Context(), database),
		})
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

func versionHandler(cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{
			"service": cfg.ServiceName,
			"version": cfg.Version,
		})
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func requestLogger(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		logger.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"dur_ms", time.Since(start).Milliseconds(),
		)
	})
}
