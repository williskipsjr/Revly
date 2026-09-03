.PHONY: help up down logs ps build health \
        go-build go-vet go-test go-fmt go-run \
        py-setup py-run \
        web-setup web-dev web-build \
        fmt

help:
	@echo "Revenue Recovery Platform - make targets"
	@echo "  up / down / logs / ps        docker compose lifecycle"
	@echo "  build                        docker compose build"
	@echo "  health                       curl service /health endpoints"
	@echo "  go-build/go-vet/go-test/go-fmt/go-run   decision-engine (Go)"
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
