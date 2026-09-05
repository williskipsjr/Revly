-- 004_phase6_execution.sql — Phase 6 execution hardening (reconciliation support).
--
-- Phase 6 introduces the pending_confirmation settlement path (PLAN.md §8/§12): an action whose
-- external outcome is ambiguous is persisted at status='pending_confirmation' and settled later
-- by the reconciler. No new columns are required — the action_status enum already includes
-- 'pending_confirmation' (001_init.sql) and actions.external_idempotency_key already exists.
--
-- This migration adds only a partial index so the reconciler's recurring scan
-- (WHERE status='pending_confirmation') stays cheap as the actions table grows. Additive and
-- safe to re-run (IF NOT EXISTS).

BEGIN;

CREATE INDEX IF NOT EXISTS idx_actions_pending_confirmation
    ON actions (executed_at)
    WHERE status = 'pending_confirmation';

COMMIT;
