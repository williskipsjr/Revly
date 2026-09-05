# Backend Running

How to run the Go `decision-engine` backend (and its Postgres/Redis/diagnosis dependencies)
locally. See **Backend Contracts API.md** for the endpoint reference.

## Prerequisites
- Docker + Docker Compose (the one-command path), **or** for bare-metal: Go 1.23+, PostgreSQL 16,
  `psql`, and optionally Redis 7 and Python 3.11+ (for the diagnosis service + simulation).

## Option A — Docker Compose (recommended)
From the repo root:
```bash
docker compose up -d --build        # postgres, redis, decision-engine, diagnosis-service, dashboard, prometheus, grafana
docker compose ps                   # check health
```
Migrations `001`–`004` and `scripts/seed_dev.sql` are auto-applied **on a fresh volume** (mounted
into Postgres `/docker-entrypoint-initdb.d/`). To re-apply after editing them, recreate the volume:
```bash
docker compose down -v && docker compose up -d --build
```
Seed richer demo data + drive events through the pipeline:
```bash
./scripts/seed_demo_data.sh         # needs the stack up; posts demo events
```

## Option B — bare metal (Go on host)
1. **Postgres** (via compose or local):
   ```bash
   docker compose up -d postgres redis
   ```
2. **Migrate + seed:**
   ```bash
   make db-migrate     # psql 001,002,003,004
   make db-seed        # psql scripts/seed_dev.sql
   ```
3. **Run the engine:**
   ```bash
   cd decision-engine
   go mod tidy         # first time only (resolves go.sum); needs network
   DATABASE_URL="postgres://revrec:revrec_dev_pw@localhost:5432/revrecovery?sslmode=disable" \
   REDIS_URL="redis://localhost:6379/0" \
   go run ./cmd/server
   ```

## Required / notable environment variables
| Var | Purpose | Default / if unset |
|---|---|---|
| `DATABASE_URL` | Postgres DSN (source of truth) | unset → liveness-only mode |
| `REDIS_URL` | ephemeral cooldown/rate + job queue | unset → Postgres-derived fallback (correct, just no accel) |
| `WEBHOOK_SECRET` | HMAC verify inbound webhooks | unset → verification disabled (dev) |
| `SUCCESS_MODEL_PATH` | trained P(success) artifact | unset → Phase-2 heuristic |
| `DIAGNOSIS_SERVICE_URL` | LLM diagnosis gateway | unset → rule-based diagnosis |
| `DIAGNOSIS_TIMEOUT_MS` | per-call LLM timeout | `6000` |
| `RECONCILE_INTERVAL_MS` | background reconcile sweep | unset/0 → loop off (endpoint still works) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | sandbox execution | unset → **mock executor** (no money moves) |
| `RAZORPAY_BASE_URL` | sandbox base URL | `https://api.razorpay.com` |
| `API_KEY` | merchant API auth | unset → auth disabled (dev) |
| `ADMIN_API_KEY` | admin API auth (kill switch, policy-config) | unset → admin auth disabled (dev) |
| `DECISION_ENGINE_PORT` | listen port | `8080` |

## Model / artifact requirements
- `ml/artifacts/success_model.json` is optional; without it the engine uses the heuristic
  estimator (logged at startup). To (re)train, see `ml/` (`python -m ml.train_success_model`).

## API base URL & health
- Base URL: `http://localhost:8080`
- Health: `curl -s localhost:8080/health` → `{"status":"ok","db":"ok","redis":"ok|down|disabled"}`
- Readiness: `curl -s -o /dev/null -w "%{http_code}\n" localhost:8080/ready` → `200`/`503`
- Metrics: `curl -s localhost:8080/metrics | head`
- Prometheus UI: `http://localhost:9090` · Grafana: `http://localhost:3001` (anon enabled)

## Manual verification (smoke)
```bash
BASE=http://localhost:8080; M=merch_aggressive
# ingest one event
curl -s -X POST $BASE/v1/merchants/$M/events/payment-failed -H 'Content-Type: application/json' \
  -d '{"schema_version":"0.1.0","external_event_id":"evt_smoke_1","merchant_id":"'$M'","payment_id":"pay_smoke_1","customer_id":"c1","event_type":"payment.failed","amount":250000,"currency":"INR","method":"card","failure_reason":"Issuer declined","prior_attempts":0,"occurred_at":"2026-09-05T10:00:00Z"}'
# read decisions + a full trace + metrics (add -H "X-API-Key: $API_KEY" if API_KEY is set)
curl -s $BASE/v1/merchants/$M/decisions | jq '.decisions[0]'
curl -s $BASE/v1/merchants/$M/payments/pay_smoke_1/decisions | jq
curl -s $BASE/v1/merchants/$M/metrics/recovery-summary | jq
```

## Stopping / resetting
```bash
docker compose down          # stop (keep data)
docker compose down -v       # stop + wipe DB/Grafana volumes (fresh migrations next up)
```

## Troubleshooting
- **`db` shows `down`:** Postgres not ready — `docker compose logs postgres`; retry `/health`.
- **`redis` shows `down`:** Redis optional — the engine still works via Postgres fallback.
- **`401/403` on API:** set `X-API-Key` (merchant) / admin key; or unset `API_KEY`/`ADMIN_API_KEY` for dev.
- **`go build` fails on missing go.sum entries:** run `cd decision-engine && go mod tidy` once (network).
- **Migrations didn't apply on compose:** they only run on a *fresh* volume — `docker compose down -v` then up, or `make db-migrate` against the running DB.
- **`pending_confirmation` actions stuck:** run `curl -s -X POST $BASE/internal/reconcile-pending-actions -d '{}'` or set `RECONCILE_INTERVAL_MS`.
