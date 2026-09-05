-- 003_phase5_policy.sql — Phase 5 platform policy + global kill switch.
--
-- Phase 5 (PLAN.md §6, §15) grows the policy engine from the Phase-2 minimal set into the
-- full Section-6 constraint set with per-merchant overrides bounded by platform ceilings.
-- The per-merchant knobs already live on merchant_policy_config (001_init.sql) plus the
-- per-merchant kill_switch (002). What is still missing is the PLATFORM layer:
--
--   * a global (platform-wide) kill switch — PLAN.md §6 "Kill switch: Global or per-merchant
--     flag forcing no_action" — which 002 explicitly deferred to Phase 5;
--   * the platform confidence floor — PLAN.md §6 marks the confidence floor NOT
--     merchant-overridable downward ("platform safety floor"): a merchant may only RAISE it;
--   * the platform ceilings that BOUND every merchant override so a merchant can only make
--     policy safer, never weaker (max retries ceiling, minimum cooldown, maximum amount
--     ceiling, maximum daily action cap).
--
-- These are platform-wide, not per-merchant, so they live in a single-row (singleton) table.
-- Postgres remains the durable source of truth (PLAN.md §2); the Go engine reads these values
-- and resolves them against each merchant's config (internal/policy/merchant_override.go).
-- No Redis is introduced here — cooldown/daily-cap facts stay Postgres-derived (PLAN.md §15;
-- Redis is a Phase 6 accelerator, never authoritative).
--
-- Additive and safe to re-run: CREATE TABLE IF NOT EXISTS + an idempotent singleton INSERT.

BEGIN;

-- platform_policy is a singleton: the id column is pinned to the literal 'platform' by a CHECK,
-- so there can only ever be one row. Column DEFAULTs double as the in-schema platform defaults
-- (mirrored in Go by policy.DefaultPlatform for the belt-and-suspenders no-row fallback).
CREATE TABLE IF NOT EXISTS platform_policy (
    id                   TEXT PRIMARY KEY DEFAULT 'platform' CHECK (id = 'platform'),

    -- Global operator halt. When true the policy engine forces no_action for EVERY merchant,
    -- outranking every other rule (PLAN.md §6). Admin/operator-controlled.
    global_kill_switch   BOOLEAN NOT NULL DEFAULT false,

    -- Platform confidence floor (PLAN.md §6, example 0.4): below it, only notify/no_action are
    -- permitted. A merchant's confidence_floor_override may RAISE this, never lower it.
    confidence_floor     NUMERIC(4, 3) NOT NULL DEFAULT 0.400
                             CHECK (confidence_floor >= 0 AND confidence_floor <= 1),

    -- Ceilings that bound merchant overrides so a merchant can only tighten safety, never loosen
    -- it. A merchant max_retries is clamped to <= this; cooldown is raised to >= min_cooldown;
    -- amount_ceiling and daily_action_cap are clamped to <= these platform maxima (a merchant
    -- "0 = unlimited" is treated as the platform maximum, never truly unbounded).
    max_retries_ceiling  INTEGER NOT NULL DEFAULT 5   CHECK (max_retries_ceiling >= 0),
    min_cooldown_minutes INTEGER NOT NULL DEFAULT 5   CHECK (min_cooldown_minutes >= 0),
    max_amount_ceiling   BIGINT  NOT NULL DEFAULT 100000000 CHECK (max_amount_ceiling >= 0), -- paise (₹1,000,000)
    max_daily_action_cap INTEGER NOT NULL DEFAULT 50  CHECK (max_daily_action_cap >= 0),

    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE platform_policy IS
    'Singleton platform-wide policy (PLAN.md §6): global kill switch, confidence safety floor, and the ceilings that bound per-merchant overrides.';

-- Seed the singleton with the schema defaults. ON CONFLICT keeps an operator-tuned row intact
-- across re-runs.
INSERT INTO platform_policy (id) VALUES ('platform')
ON CONFLICT (id) DO NOTHING;

COMMIT;
