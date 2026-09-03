# decision-engine (Go)

The **Decision + Execution planes**: API, event ingestion, ERV computation, deterministic
policy/safety engine, idempotent action executor, recovery state machine, reconciliation,
and audit writes. This service holds financial authority; the LLM never does.

## Phase 0

Stdlib-only HTTP server with liveness endpoints so the service boots and health-checks.

```bash
go run ./cmd/server         # listens on :8080 (DECISION_ENGINE_PORT)
curl -s localhost:8080/health
curl -s localhost:8080/version
```

- `GET /health` → `{"status":"ok","service":"decision-engine","version":"0.1.0"}`
- `GET /version`

## Layout (grows by phase)

```
cmd/server/         entrypoint
internal/config/    env configuration
internal/ingest/    (Phase 1) idempotent webhook ingestion
internal/erv/       (Phase 2-3) ERV optimizer
internal/policy/    (Phase 2,5) deterministic policy/safety engine
internal/executor/  (Phase 2,6) idempotent action dispatch
internal/reconcile/ (Phase 6) ambiguous-outcome reconciliation
internal/api/       (Phase 7) public merchant-scoped API
```

Env: `DECISION_ENGINE_PORT` (default 8080), `SERVICE_VERSION`. `DATABASE_URL` / `REDIS_URL`
are consumed from Phase 1 onward.
