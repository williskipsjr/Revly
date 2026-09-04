-- 002_phase2_kill_switch.sql — Phase 2 additive schema change.
--
-- PLAN.md §6 lists a per-merchant "kill switch" as one of the three constraints the Phase 2
-- minimal policy engine enforces (max retries + min ERV + kill switch). The §8 data-model
-- sketch of merchant_policy_config did not include it, so this migration adds it as the
-- durable, per-merchant source of truth (Postgres remains authoritative — PLAN.md §2).
--
-- It is deliberately minimal and additive:
--   * a single BOOLEAN column, defaulting to false, so every existing merchant_policy_config
--     row (and the Phase 1 seed) keeps working unchanged;
--   * ADD COLUMN IF NOT EXISTS makes the migration safe to re-run, matching 001_init.sql's
--     re-runnable convention.
--
-- A global (platform-wide) kill switch is deferred to the full policy engine / admin API
-- (Phase 5/7); the per-merchant flag is all the Phase 2 vertical slice requires.

BEGIN;

ALTER TABLE merchant_policy_config
    ADD COLUMN IF NOT EXISTS kill_switch BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN merchant_policy_config.kill_switch IS
    'Per-merchant operator halt (PLAN.md §6): when true, the policy engine forces no_action.';

COMMIT;
