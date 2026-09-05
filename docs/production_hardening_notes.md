# Production Hardening Notes (Phase 10)

These are the things we would build to run this system on real Razorpay traffic. Per PLAN.md
§10/§16 we deliberately **document rather than build** them for the buildathon — stating the plan
honestly signals maturity without over-investing in engineering that a demo does not need.

## Model quality & drift (the biggest real-world gap)
- The P(success) model is logistic regression on **synthetic** data (clearly labeled). For
  production: train on real historical failure→outcome data, with a proper train/validation/
  held-out split and time-based splits to avoid leakage.
- **Calibration monitoring:** track reliability curves (predicted vs. observed recovery) per
  method/root-cause segment; a miscalibrated P(success) silently distorts every ERV ranking.
- **Drift detection:** monitor feature and outcome distributions; alert on population shift and
  trigger retraining. Keep a champion/challenger setup so a new model is shadow-scored before it
  can influence decisions.
- Version every model artifact (already: `model_version` is persisted per score) so any decision
  stays reconstructable after a model change.

## Execution & money-movement safety
- Replace the mock/sandbox executor with the real Razorpay integration behind the same
  `Dispatcher`/`StatusResolver` interfaces. Keep the external idempotency-key header on every
  call and the `pending_confirmation` → reconciler path (already built) as the duplicate-charge
  guard — no distributed transactions needed (PLAN.md §14).
- Add an outcome webhook from the PSP to settle `pending_confirmation` faster than the periodic
  reconcile sweep; the reconciler remains the backstop.
- Rate-limit real dispatch per merchant and globally; the Redis counters already model this.

## Resilience (already demonstrated, would formalize)
- AI plane down → deterministic rule-based diagnosis fallback (built; `diagnoses_total{source}`
  metric shows it live).
- Redis down → Postgres-derived cooldown/daily-cap checks (built; correctness never depends on
  Redis). Formalize with alerting on `decision_engine_redis_up == 0`.
- DB is the single source of truth; add PITR backups and a read replica for the dashboard.

## Security & multi-tenancy
- Replace the shared API key with per-merchant credentials + real RBAC and scoped tokens; today
  the tenant boundary is row-level `merchant_id` filtering (sufficient for the MVP, stated as
  deferred).
- Rotate the webhook HMAC secret; enforce signature verification in every environment.
- Secrets via a real secret manager, not env files.

## Observability
- The Prometheus metrics here are intentionally minimal (service/DB/Redis health, request
  rate/latency, decisions by result, AI availability). Production would add per-merchant SLOs,
  alerting rules, and tracing. The **product** dashboard (Next.js, Section 10) — not Grafana — is
  the primary surface by design.
