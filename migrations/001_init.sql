-- 001_init.sql — initial schema for the AI Revenue Recovery Decision Platform.
--
-- Implements PLAN.md §8 (Data Model) in full. This is the single durable source of
-- truth for the whole system (PLAN.md §2): all financial, event, and merchant state
-- lives here; Redis (added Phase 6) is ephemeral and never authoritative.
--
-- Conventions (see schemas/README.md):
--   * Money is INTEGER minor units (paise): amount, recoverable_amount, amount_ceiling
--     are BIGINT. Cost/friction/ERV values may be fractional minor units → NUMERIC (exact
--     decimal, never floating point for money).
--   * confidence / p_success are 0..1 probabilities → NUMERIC with a range CHECK.
--   * All *_at columns are TIMESTAMPTZ.
--   * Enum sets mirror the frozen JSON contracts in schemas/*.json exactly.
--
-- Idempotency (PLAN.md §8, §12): payment_events.external_event_id is UNIQUE — this DB
-- constraint (not any application check) is what absorbs at-least-once webhook redelivery.
-- actions.idempotency_key is UNIQUE for the same reason on the (future) execution path.
--
-- The migration is wrapped in a transaction and is safe to re-run: types are created
-- guarded, and tables/indexes use IF NOT EXISTS.

BEGIN;

-- ---------------------------------------------------------------------------
-- Enum types (mirror schemas/*.json)
-- ---------------------------------------------------------------------------
-- CREATE TYPE has no IF NOT EXISTS; guard each so re-running the file is safe.
DO $$ BEGIN
    CREATE TYPE risk_tolerance_tier AS ENUM ('conservative', 'balanced', 'aggressive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE action_type AS ENUM (
        'retry', 'delayed_retry', 'alt_method', 'payment_link', 'notify', 'escalate', 'no_action'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM ('card', 'upi', 'netbanking', 'wallet', 'emi', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE payment_event_type AS ENUM (
        'payment.failed', 'payment.authorized_pending', 'checkout.abandoned',
        'subscription.charge_failed', 'invoice.overdue', 'mandate.failed'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE root_cause AS ENUM (
        'temporary_bank_decline', 'insufficient_funds', 'expired_method',
        'checkout_abandonment', 'chronic_failure', 'fraud_suspected', 'unknown'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE policy_check_result AS ENUM ('ALLOW', 'BLOCK', 'HUMAN_REVIEW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE recovery_state AS ENUM (
        'FAILED', 'DIAGNOSED', 'RECOVERY_ELIGIBLE', 'ACTION_SELECTED', 'ACTION_PENDING',
        'RECOVERED', 'RE_EVALUATE', 'STOPPED', 'DONE'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE action_status AS ENUM ('pending', 'pending_confirmation', 'confirmed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Merchant configuration (PLAN.md §8; contract: schemas/merchant.schema.json)
-- ---------------------------------------------------------------------------
-- merchants.id is the merchant's business identifier (the {id} in the public API path
-- and PaymentEvent.merchant_id) — a natural TEXT key, not a surrogate. A single simple
-- merchant_id column is the tenant boundary (PLAN.md §9: no schema-per-tenant).
CREATE TABLE IF NOT EXISTS merchants (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    risk_tolerance_tier risk_tolerance_tier NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One policy config per merchant (1:1). Overrides are bounded by platform ceilings at
-- resolution time (Phase 5); this table just stores the merchant's chosen values.
CREATE TABLE IF NOT EXISTS merchant_policy_config (
    merchant_id               TEXT PRIMARY KEY REFERENCES merchants(id),
    max_retries               INTEGER NOT NULL CHECK (max_retries >= 0),
    cooldown_minutes          INTEGER NOT NULL CHECK (cooldown_minutes >= 0),
    min_erv_threshold         NUMERIC(20, 4) NOT NULL,               -- minor units (may be fractional)
    daily_action_cap          INTEGER NOT NULL CHECK (daily_action_cap >= 0),
    amount_ceiling            BIGINT NOT NULL CHECK (amount_ceiling >= 0),  -- paise
    confidence_floor_override NUMERIC(4, 3) CHECK (confidence_floor_override >= 0 AND confidence_floor_override <= 1),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-action monetary cost and friction weight, per merchant (composite PK).
CREATE TABLE IF NOT EXISTS merchant_action_costs (
    merchant_id     TEXT NOT NULL REFERENCES merchants(id),
    action_type     action_type NOT NULL,
    monetary_cost   NUMERIC(20, 4) NOT NULL CHECK (monetary_cost >= 0),   -- minor units
    friction_weight NUMERIC(12, 4) NOT NULL CHECK (friction_weight >= 0), -- multiplier
    PRIMARY KEY (merchant_id, action_type)
);

-- ---------------------------------------------------------------------------
-- Payments & events (PLAN.md §8; contract: schemas/payment_event.schema.json)
-- ---------------------------------------------------------------------------
-- payments.id is the provider payment identifier (PaymentEvent.payment_id), a natural
-- TEXT key. amount is paise. status is the pipeline/provider disposition — intentionally
-- not contract-frozen yet, so kept as TEXT rather than an invented enum.
CREATE TABLE IF NOT EXISTS payments (
    id          TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL REFERENCES merchants(id),
    amount      BIGINT NOT NULL CHECK (amount >= 0),    -- paise
    currency    TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
    method      payment_method NOT NULL,
    status      TEXT NOT NULL,
    customer_id TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- payment_events is the heart of Phase 1. external_event_id UNIQUE is the idempotency
-- key that makes ingestion safe under at-least-once webhook redelivery.
--
-- §8 lists (id, payment_id, external_event_id, event_type, raw_payload, received_at).
-- occurred_at / failure_reason / prior_attempts are promoted from the frozen PaymentEvent
-- contract to first-class columns (rather than living only inside raw_payload) because
-- later phases (diagnosis, ERV) consume them directly. raw_payload retains the complete
-- original request body for audit/replay (PLAN.md §11: fully reconstructable).
CREATE TABLE IF NOT EXISTS payment_events (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id        TEXT NOT NULL REFERENCES payments(id),
    external_event_id TEXT NOT NULL UNIQUE,             -- idempotency key (at-least-once ingestion)
    event_type        payment_event_type NOT NULL,
    occurred_at       TIMESTAMPTZ NOT NULL,             -- when the failure occurred at the provider
    failure_reason    TEXT,
    prior_attempts    INTEGER NOT NULL DEFAULT 0 CHECK (prior_attempts >= 0),
    raw_payload       JSONB,                            -- full original event body, for audit
    received_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_events_payment_id ON payment_events(payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_merchant_id ON payments(merchant_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);

-- Customer enrichment (Phase 2 Context Builder). Scoped per merchant (composite PK).
CREATE TABLE IF NOT EXISTS customer_context (
    customer_id       TEXT NOT NULL,
    merchant_id       TEXT NOT NULL REFERENCES merchants(id),
    risk_score        NUMERIC(6, 5) CHECK (risk_score >= 0 AND risk_score <= 1),
    past_success_rate NUMERIC(6, 5) CHECK (past_success_rate >= 0 AND past_success_rate <= 1),
    last_contacted_at TIMESTAMPTZ,
    PRIMARY KEY (customer_id, merchant_id)
);

-- ---------------------------------------------------------------------------
-- Intelligence outputs (populated in later phases; schema only here)
-- ---------------------------------------------------------------------------
-- diagnoses: advisory root cause + confidence (contract: schemas/diagnosis.schema.json).
-- confidence is a GATING signal only — never the P(success) used in ERV (PLAN.md §5).
CREATE TABLE IF NOT EXISTS diagnoses (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_event_id UUID NOT NULL REFERENCES payment_events(id),
    root_cause       root_cause NOT NULL,
    confidence       NUMERIC(4, 3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    rationale        TEXT NOT NULL,
    model_version    TEXT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_diagnoses_payment_event_id ON diagnoses(payment_event_id);

-- success_model_scores: P(success | context, action) from the interpretable statistical
-- model (Phase 3), kept strictly separate from LLM confidence (PLAN.md §7).
CREATE TABLE IF NOT EXISTS success_model_scores (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_event_id UUID NOT NULL REFERENCES payment_events(id),
    action_type      action_type NOT NULL,
    p_success        NUMERIC(6, 5) NOT NULL CHECK (p_success >= 0 AND p_success <= 1),
    model_version    TEXT NOT NULL,
    computed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_success_model_scores_payment_event_id ON success_model_scores(payment_event_id);

-- erv_scores: per-candidate ERV term breakdown (PLAN.md §5). erv may be negative.
CREATE TABLE IF NOT EXISTS erv_scores (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_event_id   UUID NOT NULL REFERENCES payment_events(id),
    action_type        action_type NOT NULL,
    p_success          NUMERIC(6, 5) NOT NULL CHECK (p_success >= 0 AND p_success <= 1),
    recoverable_amount BIGINT NOT NULL CHECK (recoverable_amount >= 0),  -- paise
    cost               NUMERIC(20, 4) NOT NULL CHECK (cost >= 0),        -- minor units
    friction_penalty   NUMERIC(20, 4) NOT NULL CHECK (friction_penalty >= 0),
    erv                NUMERIC(20, 4) NOT NULL,                          -- may be negative
    computed_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_erv_scores_payment_event_id ON erv_scores(payment_event_id);

-- ---------------------------------------------------------------------------
-- Decisions, actions, outcomes (PLAN.md §8; contract: schemas/decision.schema.json)
-- ---------------------------------------------------------------------------
-- Immutable, fully reconstructable decision record. recovery_state carries the state
-- machine (PLAN.md §6a) — a status column on this row, not a separate table/service.
CREATE TABLE IF NOT EXISTS decisions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_event_id    UUID NOT NULL REFERENCES payment_events(id),
    merchant_id         TEXT NOT NULL REFERENCES merchants(id),
    chosen_action       action_type NOT NULL,
    erv_at_decision     NUMERIC(20, 4),                  -- minor units, may be negative
    policy_version      TEXT NOT NULL,
    policy_check_result policy_check_result NOT NULL,
    policy_checks_json  JSONB,
    recovery_state      recovery_state NOT NULL,
    decided_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_decisions_payment_event_id ON decisions(payment_event_id);
CREATE INDEX IF NOT EXISTS idx_decisions_merchant_id ON decisions(merchant_id);

-- actions: idempotency_key UNIQUE = hash(payment_id, decision_id, action_type). This DB
-- constraint (PLAN.md §8) is what actually prevents duplicate financial actions.
-- pending_confirmation exists for ambiguous external outcomes (reconcile, never blind-retry).
CREATE TABLE IF NOT EXISTS actions (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id              UUID NOT NULL REFERENCES decisions(id),
    action_type              action_type NOT NULL,
    idempotency_key          TEXT NOT NULL UNIQUE,
    external_idempotency_key TEXT,
    status                   action_status NOT NULL DEFAULT 'pending',
    executed_at              TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_actions_decision_id ON actions(decision_id);

CREATE TABLE IF NOT EXISTS outcomes (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_id        UUID NOT NULL REFERENCES actions(id),
    result           TEXT NOT NULL,
    recovered_amount BIGINT CHECK (recovered_amount >= 0),   -- paise
    observed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_outcomes_action_id ON outcomes(action_id);

-- ---------------------------------------------------------------------------
-- Audit log (PLAN.md §8, §11): append-only, merchant-scoped. BIGSERIAL preserves
-- append order. merchant_id is nullable for platform/global events.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id           BIGSERIAL PRIMARY KEY,
    merchant_id  TEXT REFERENCES merchants(id),
    entity_type  TEXT NOT NULL,
    entity_id    TEXT NOT NULL,
    actor        TEXT NOT NULL,
    details_json JSONB,
    at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_merchant_id ON audit_log(merchant_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);

COMMIT;
