-- seed_dev.sql — development seed data.
--
-- Phase 1 DoD (PLAN.md §15): "a seed script creates 2+ merchants with different policy
-- configs." Two merchants with deliberately contrasting configuration so that later phases
-- (§3 Phase 3 DoD) can show the SAME failed payment producing DIFFERENT chosen actions:
--
--   merch_conservative — premium customer base: few retries, long cooldown, high ERV bar,
--                        low daily cap, and HIGH friction weights (values customer trust
--                        over recovery volume).
--   merch_aggressive   — recovery-volume optimizer: more retries, short cooldown, low ERV
--                        bar, high daily cap, and LOW friction weights.
--
-- Money is paise. min_erv_threshold / costs are minor units (may be fractional).
-- Safe to re-run: every INSERT is ON CONFLICT DO NOTHING.

BEGIN;

INSERT INTO merchants (id, name, risk_tolerance_tier) VALUES
    ('merch_conservative', 'Aurora Premium Goods', 'conservative'),
    ('merch_aggressive',   'Volt Direct Retail',   'aggressive')
ON CONFLICT (id) DO NOTHING;

INSERT INTO merchant_policy_config
    (merchant_id, max_retries, cooldown_minutes, min_erv_threshold, daily_action_cap, amount_ceiling, confidence_floor_override)
VALUES
    ('merch_conservative', 2, 60, 5000.0000,  3,  5000000,  NULL),   -- ERV bar ₹50, ceiling ₹50,000
    ('merch_aggressive',   4, 15,  500.0000, 20, 50000000,  NULL)    -- ERV bar ₹5,  ceiling ₹500,000
ON CONFLICT (merchant_id) DO NOTHING;

-- Per-action cost (paise) and friction weight (multiplier). Monetary costs are shared
-- platform-ish defaults; the friction weights differ per merchant (§5: premium merchant
-- weights customer friction higher).
INSERT INTO merchant_action_costs (merchant_id, action_type, monetary_cost, friction_weight) VALUES
    ('merch_conservative', 'retry',         200.0000, 1.0000),
    ('merch_conservative', 'delayed_retry', 200.0000, 0.8000),
    ('merch_conservative', 'alt_method',     20.0000, 2.0000),
    ('merch_conservative', 'payment_link',   20.0000, 2.0000),
    ('merch_conservative', 'notify',         20.0000, 1.5000),
    ('merch_conservative', 'escalate',     5000.0000, 0.5000),
    ('merch_conservative', 'no_action',       0.0000, 0.0000),
    ('merch_aggressive',   'retry',         200.0000, 0.4000),
    ('merch_aggressive',   'delayed_retry', 200.0000, 0.3000),
    ('merch_aggressive',   'alt_method',     20.0000, 0.8000),
    ('merch_aggressive',   'payment_link',   20.0000, 0.8000),
    ('merch_aggressive',   'notify',         20.0000, 0.5000),
    ('merch_aggressive',   'escalate',     5000.0000, 0.3000),
    ('merch_aggressive',   'no_action',       0.0000, 0.0000)
ON CONFLICT (merchant_id, action_type) DO NOTHING;

COMMIT;
