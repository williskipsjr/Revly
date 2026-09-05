.PHONY: help up down logs ps build health \
        go-build go-vet go-test go-fmt go-run \
        db-migrate db-seed test-integration \
        py-setup py-run \
        web-setup web-dev web-build \
        fmt

# Host-facing connection string (compose maps postgres to localhost:5432).
# Override for a different target DB: `make db-migrate PSQL_URL=...`
PSQL_URL ?= postgres://revrec:revrec_dev_pw@localhost:5432/revrecovery?sslmode=disable

help:
	@echo "Revenue Recovery Platform - make targets"
	@echo "  up / down / logs / ps        docker compose lifecycle"
	@echo "  build                        docker compose build"
	@echo "  health                       curl service /health endpoints"
	@echo "  go-build/go-vet/go-test/go-fmt/go-run   decision-engine (Go)"
	@echo "  db-migrate / db-seed         apply schema / seed dev data (psql)"
	@echo "  test-integration             decision-engine DB integration tests"
	@echo "  py-setup / py-run            diagnosis-service (Python)"
	@echo "  web-setup / web-dev / web-build   dashboard (Next.js)"
	@echo "  fmt                          format everything"

# ---- Docker Compose ----
up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f

ps:
	docker compose ps

build:
	docker compose build

health:
	@echo "decision-engine:"  && curl -fsS http://localhost:8080/health  && echo
	@echo "diagnosis-service:" && curl -fsS http://localhost:8000/health && echo
	@echo "dashboard:"        && curl -fsS http://localhost:3000/api/health && echo

# ---- decision-engine (Go) ----
go-build:
	cd decision-engine && go build ./...

go-vet:
	cd decision-engine && go vet ./...

go-test:
	cd decision-engine && go test ./...

go-fmt:
	cd decision-engine && gofmt -l -w .

go-run:
	cd decision-engine && DECISION_ENGINE_PORT=8080 go run ./cmd/server

# ---- Database (PostgreSQL) ----
# The compose stack auto-applies these on a fresh volume; these targets re-apply
# to an already-running DB. Both scripts are safe to re-run (IF NOT EXISTS / ON CONFLICT).
db-migrate:
	psql "$(PSQL_URL)" -v ON_ERROR_STOP=1 -f migrations/001_init.sql
	psql "$(PSQL_URL)" -v ON_ERROR_STOP=1 -f migrations/002_phase2_kill_switch.sql
	psql "$(PSQL_URL)" -v ON_ERROR_STOP=1 -f migrations/003_phase5_policy.sql

db-seed:
	psql "$(PSQL_URL)" -v ON_ERROR_STOP=1 -f scripts/seed_dev.sql

# DB-backed idempotency/concurrency/rollback proofs; needs a running, migrated Postgres.
test-integration:
	cd decision-engine && TEST_DATABASE_URL="$(PSQL_URL)" go test -tags=integration ./...

# ---- diagnosis-service (Python) ----
py-setup:
	cd diagnosis-service && python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt

py-run:
	cd diagnosis-service && . .venv/bin/activate && uvicorn main:app --reload --port 8000

# ---- dashboard (Next.js) ----
web-setup:
	cd dashboard && npm install

web-dev:
	cd dashboard && npm run dev

web-build:
	cd dashboard && npm run build

fmt: go-fmt
	@echo "formatted"
