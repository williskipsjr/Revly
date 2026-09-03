# AI Revenue Recovery Decision Platform

**Razorpay AI Buildathon — Track 03 (AI Revenue Recovery)**

An AI-assisted, *bounded* revenue-recovery platform: it detects revenue at risk, diagnoses
the likely cause, predicts how effective each recovery action would be, selects the
economically best **permitted** intervention, executes it safely and idempotently, observes
the outcome, and stops (or adapts) according to explicit policy — while measuring the actual
revenue recovered.

> **The governing invariant:**
> **LLM proposes → ML estimates `P(success)` → ERV ranks → deterministic Policy/Safety approves → idempotent Go executor acts → PostgreSQL records.**
> No layer skips the next. The LLM never touches money, never computes the probability used in ERV, and never sets an amount.

The source-of-truth documents are [`PS and Solution/PROBLEM_STATEMENT.md`](PS%20and%20Solution/PROBLEM_STATEMENT.md)
(what/why) and [`PS and Solution/PLAN.md`](PS%20and%20Solution/PLAN.md) (how). If code conflicts
with those, the code is reconsidered — not the product definition.

---

## Architecture at a glance

| Plane | Runtime | Responsibility | Worst case if compromised |
|---|---|---|---|
| **Intelligence** | Python / FastAPI | LLM diagnosis (advisory), statistical `P(success)` model | A bad *suggestion*, ignored |
| **Decision** | Go | ERV computation, policy/safety checks, merchant-config resolution | Must never be bypassed |
| **Execution** | Go | Idempotent action dispatch, ledger writes, reconciliation | No duplicate financial side-effects |

**PostgreSQL** is the single durable source of truth. **Redis** is ephemeral coordination only
(cooldown TTLs, counters, queue) and can be lost entirely without losing correctness. The
Decision plane keeps working (in a conservative default mode) even if the Intelligence plane
is fully down.

## Repository layout

```
.
├── PS and Solution/        # PROBLEM_STATEMENT.md + PLAN.md  (contract)
├── schemas/                # Frozen cross-service JSON contracts (PaymentEvent, Diagnosis, Decision, Merchant)
├── decision-engine/        # Go — Decision + Execution planes (API, ERV, policy, executor, state machine)
├── diagnosis-service/      # Python/FastAPI — Intelligence plane (LLM diagnosis, isolated, no payment creds)
├── ml/                     # Python — synthetic data + P(success) model training (Phase 3)
├── sim/                    # Python — evaluation/simulation harness vs. baselines (Phase 9)
├── dashboard/              # Next.js — primary product surface (Phase 8)
├── migrations/             # PostgreSQL schema migrations (Phase 1)
├── scripts/                # seed + chaos-demo scripts (Phase 11)
├── docs/                   # architecture + production-hardening notes
├── docker-compose.yml      # one-command demo stack
└── Makefile                # dev/build/test shortcuts
```

## Phase status

| Phase | Scope | Status |
|---|---|---|
| 0 | Foundation: skeleton, frozen contracts, compose skeleton | 🚧 in progress |
| 1 | Data model + idempotent event ingestion | ⬜ |
| 2 | Vertical slice: end-to-end recovery (Postgres-only, no Redis) | ⬜ |
| 3 | Statistical `P(success)` model + full ERV | ⬜ |
| 4 | LLM diagnosis layer (isolated, schema-validated, fallback) | ⬜ |
| 5 | Full deterministic policy/safety engine | ⬜ |
| 6 | Idempotent execution hardening + Razorpay sandbox + Redis | ⬜ |
| 7 | Public merchant-scoped APIs | ⬜ |
| 8 | Merchant/operator dashboard | ⬜ |
| 9 | Evaluation/simulation harness (held-out, 4 systems) | ⬜ |
| 10 | Lightweight observability + hardening notes | ⬜ |
| 11 | Deployment/demo prep (seed + chaos) | ⬜ |

## Quickstart (target — needs the full toolchain)

Prerequisites: Docker + Docker Compose, Go 1.23+, Python 3.12+, Node 20+.

```bash
cp .env.example .env
docker compose up -d --build
make health          # curl the three service /health endpoints
```

Local dev without Docker (per service):

```bash
make go-run          # decision-engine on :8080  (stdlib only in Phase 0)
make py-setup py-run # diagnosis-service on :8000
make web-setup web-dev # dashboard on :3000
```

## Honest limitations

This is a buildathon MVP. The `P(success)` model is trained on **synthetic / simulated** data,
clearly labeled as such. All evaluation results carry the disclaimer:

> *These results demonstrate performance in a simulated environment and do not represent real
> Razorpay customer behaviour.*

The correctness guarantee for execution is **idempotent, at-least-once, no duplicate financial
actions** — not "exactly-once."
