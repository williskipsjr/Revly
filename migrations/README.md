# migrations

PostgreSQL schema migrations. **`001_init.sql`** implements the full data model from
PLAN.md §8: `merchants`, `merchant_policy_config`, `merchant_action_costs`, `payments`,
`payment_events` (UNIQUE `external_event_id`), `customer_context`, `diagnoses`,
`success_model_scores`, `erv_scores`, `decisions` (with `recovery_state`), `actions`
(UNIQUE `idempotency_key`), `outcomes`, `audit_log`.

Only `payments` and `payment_events` (plus reads of `merchants`) carry application logic in
Phase 1; the remaining tables are schema-only, awaiting later phases.

**`002_phase2_kill_switch.sql`** (Phase 2) is an additive change: it adds the per-merchant
`merchant_policy_config.kill_switch BOOLEAN NOT NULL DEFAULT false` column that the Phase 2
policy engine reads (PLAN.md §6). It is safe to re-run (`ADD COLUMN IF NOT EXISTS`) and the
default keeps every existing config row and the seed working unchanged. Phase 2 also begins
populating the previously schema-only tables (`diagnoses`, `success_model_scores`,
`erv_scores`, `decisions`, `actions`, `outcomes`, `audit_log`) via the recovery pipeline.

## Runner

Plain **`psql -f`** — no migrate tool or ORM (kept minimal by design; the schema is small
and applied wholesale). `001_init.sql` is wrapped in a single transaction and is safe to
re-run: enum types are created idempotently (catching `duplicate_object`), and all tables
and indexes use `IF NOT EXISTS`.

Two ways to apply it:

- **Compose (fresh volume, automatic):** `docker-compose.yml` mounts `001_init.sql` and
  `scripts/seed_dev.sql` into the Postgres container's `/docker-entrypoint-initdb.d/`.
  Postgres runs them, in alphabetical order, **only when the data directory is empty** — i.e.
  on first boot of a new `pgdata` volume. To re-apply after editing, recreate the volume:

  ```
  docker compose down -v && docker compose up
  ```

- **Against a running DB (manual):** from the repo root,

  ```
  make db-migrate   # psql -f 001_init.sql, then 002_phase2_kill_switch.sql
  make db-seed      # psql -f scripts/seed_dev.sql
  ```

  Both targets use `PSQL_URL` (defaults to the host-mapped dev DB); override as needed.

## Conventions

- Money is stored as **integer paise** in `BIGINT` columns (`payments.amount`,
  `outcomes.recovered_amount`). Fractional minor-unit values (costs, friction weights, ERV,
  thresholds) use `NUMERIC` — never floating point. Probabilities use `NUMERIC` with a
  `0..1` CHECK.
- `merchants.id` and `payments.id` are `TEXT` natural keys (business identifiers matching the
  API path `{id}` and the frozen `PaymentEvent` fields). Internally-generated rows
  (`payment_events`, `actions`, `outcomes`) use `gen_random_uuid()` UUID keys.
- New migrations are additive and numbered `NNN_description.sql`.
