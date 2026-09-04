package store

// SQL for the Phase 2 recovery pipeline persistence (PLAN.md §8 tables: diagnoses,
// success_model_scores, erv_scores, decisions, actions, outcomes, audit_log).
//
// Conventions:
//   - UUID parameters are bound as text and cast (::uuid); enum parameters bind Go strings
//     and cast (::action_type, ::root_cause, ::policy_check_result, ::recovery_state,
//     ::action_status), exactly as the Phase 1 ingestion SQL does.
//   - NUMERIC columns are read back as ::float8 so they scan cleanly into Go float64 rather
//     than the driver's decimal type. Money at rest stays exact (integer paise / NUMERIC);
//     the float8 cast is only for the read path of merchant config, which is display/como-
//     putation config, never a stored ledger amount.
//   - Idempotency is the database's job: the actions insert is ON CONFLICT (idempotency_key)
//     DO NOTHING, so a duplicate fire inserts nothing and RETURNs no row.
const (
	loadContextSQL = `
SELECT
    pe.id,
    pe.payment_id,
    p.merchant_id,
    p.amount,
    p.method::text,
    pe.event_type::text,
    coalesce(pe.failure_reason, ''),
    pe.prior_attempts,
    mpc.max_retries,
    mpc.cooldown_minutes,
    mpc.min_erv_threshold::float8,
    mpc.daily_action_cap,
    mpc.amount_ceiling,
    mpc.confidence_floor_override::float8,
    mpc.kill_switch,
    coalesce((
        SELECT count(*)
        FROM actions a
        JOIN decisions d       ON d.id = a.decision_id
        JOIN payment_events pe2 ON pe2.id = d.payment_event_id
        WHERE pe2.payment_id = pe.payment_id
          AND a.action_type IN ('retry', 'delayed_retry')
          AND a.status IN ('pending', 'pending_confirmation', 'confirmed')
    ), 0) AS retry_actions_taken
FROM payment_events pe
JOIN payments p                 ON p.id = pe.payment_id
JOIN merchant_policy_config mpc ON mpc.merchant_id = p.merchant_id
WHERE pe.id = $1::uuid`

	loadActionCostsSQL = `
SELECT action_type::text, monetary_cost::float8, friction_weight::float8
FROM merchant_action_costs
WHERE merchant_id = $1`

	insertDiagnosisSQL = `
INSERT INTO diagnoses (payment_event_id, root_cause, confidence, rationale, model_version)
VALUES ($1::uuid, $2::root_cause, $3, $4, $5)`

	insertSuccessScoreSQL = `
INSERT INTO success_model_scores (payment_event_id, action_type, p_success, model_version)
VALUES ($1::uuid, $2::action_type, $3, $4)`

	insertErvScoreSQL = `
INSERT INTO erv_scores
    (payment_event_id, action_type, p_success, recoverable_amount, cost, friction_penalty, erv)
VALUES ($1::uuid, $2::action_type, $3, $4, $5, $6, $7)`

	insertDecisionSQL = `
INSERT INTO decisions
    (payment_event_id, merchant_id, chosen_action, erv_at_decision, policy_version,
     policy_check_result, policy_checks_json, recovery_state)
VALUES ($1::uuid, $2, $3::action_type, $4, $5, $6::policy_check_result, $7::jsonb, $8::recovery_state)
RETURNING id`

	// insertActionSQL is the idempotency point: the UNIQUE(idempotency_key) constraint plus
	// ON CONFLICT DO NOTHING means a duplicate dispatch inserts nothing and RETURNs no row —
	// this, not any application check, prevents duplicate financial actions (PLAN.md §8).
	insertActionSQL = `
INSERT INTO actions
    (decision_id, action_type, idempotency_key, external_idempotency_key, status, executed_at)
VALUES ($1::uuid, $2::action_type, $3, $4, $5::action_status, now())
ON CONFLICT (idempotency_key) DO NOTHING
RETURNING id`

	insertOutcomeSQL = `
INSERT INTO outcomes (action_id, result, recovered_amount)
VALUES ($1::uuid, $2, $3)`

	updateDecisionStateSQL = `
UPDATE decisions SET recovery_state = $2::recovery_state WHERE id = $1::uuid`

	insertAuditSQL = `
INSERT INTO audit_log (merchant_id, entity_type, entity_id, actor, details_json)
VALUES ($1, $2, $3, $4, $5::jsonb)`
)
