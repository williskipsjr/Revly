# migrations

PostgreSQL schema migrations. **Populated in Phase 1** with `001_init.sql` implementing the
data model from PLAN.md §8: `merchants`, `merchant_policy_config`, `merchant_action_costs`,
`payments`, `payment_events` (UNIQUE `external_event_id`), `customer_context`, `diagnoses`,
`success_model_scores`, `erv_scores`, `decisions` (with `recovery_state`), `actions`
(UNIQUE `idempotency_key`), `outcomes`, `audit_log`.

Migration runner/tooling is chosen in Phase 1 (plain `psql -f`, or a lightweight migrate tool).
