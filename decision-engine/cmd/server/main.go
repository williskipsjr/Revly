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
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/ingest"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/store"
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

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", healthHandler(cfg, database))
	mux.HandleFunc("GET /version", versionHandler(cfg))

	if database != nil {
		ingestor := store.New(database)
		mux.HandleFunc(
			"POST /v1/merchants/{id}/events/payment-failed",
			ingest.NewHandler(ingestor, cfg.WebhookSecret, logger),
		)
		if cfg.WebhookSecret == "" {
			slog.Warn("webhook signature verification DISABLED: WEBHOOK_SECRET not set")
		} else {
			slog.Info("webhook signature verification enabled")
		}
		slog.Info("ingestion endpoint mounted", "route", "POST /v1/merchants/{id}/events/payment-failed")
	}

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
