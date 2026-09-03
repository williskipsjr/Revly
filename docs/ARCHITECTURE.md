# Architecture (summary)

This is a navigational summary. The authoritative documents are
[`../PS and Solution/PROBLEM_STATEMENT.md`](../PS%20and%20Solution/PROBLEM_STATEMENT.md) (what/why)
and [`../PS and Solution/PLAN.md`](../PS%20and%20Solution/PLAN.md) (how).

## The invariant

```
LLM proposes  →  ML estimates P(success)  →  ERV ranks  →  Policy/Safety approves
             →  idempotent Go executor acts  →  PostgreSQL records
```

No layer skips the next. The LLM never touches money, never computes the ERV probability,
never sets an amount. **Economics ranks actions; safety constrains actions.**

## Three planes

- **Intelligence (Python/FastAPI)** — `diagnosis-service/` + `ml/`. LLM diagnosis (advisory,
  schema-validated) and the statistical `P(success)` model. Isolated; no payment credentials.
- **Decision (Go)** — `decision-engine/internal/{erv,policy}`. ERV computation and the
  deterministic policy/safety engine. Must never be bypassed.
- **Execution (Go)** — `decision-engine/internal/{executor,reconcile}`. Idempotent dispatch,
  ledger writes, ambiguous-outcome reconciliation. No duplicate financial side-effects.

## Durability

- **PostgreSQL** — single source of truth for all financial and merchant state.
- **Redis** — ephemeral only (cooldown TTLs, rate-limit counters, job queue). Fully
  reconstructable from Postgres; the system stays correct if Redis is lost. The first
  end-to-end vertical slice (Phase 2) runs on Postgres alone.

## Key safety mechanisms

- **Idempotency** via a DB unique constraint on `actions.idempotency_key =
  hash(payment_id, decision_id, action_type)`. Guarantee is "no duplicate financial action,"
  not "exactly-once."
- **ACTION_FAILED vs OUTCOME_UNKNOWN**: ambiguous external results become
  `pending_confirmation` and are reconciled against the gateway's status — never blindly retried.
- **Recovery state machine** lives on the `decisions.recovery_state` column (not a new service).
- **Auditability**: given a `decision_id`, replay exactly which diagnosis, success-model score,
  merchant config, policy version, and ERV inputs produced it.

See the root [`README.md`](../README.md) for the phase status table.
