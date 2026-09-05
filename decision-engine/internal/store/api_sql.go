package store

// SQL for the Phase 7 public, merchant-scoped API (PLAN.md §9/§10). Every statement filters by
// merchant_id (the MVP tenant boundary). NUMERIC columns are read back as ::float8 for clean Go
// float64 scans; money at rest stays exact integer paise / NUMERIC.
const (
	merchantExistsSQL = `SELECT 1 FROM merchants WHERE id = $1`

	listRecentDecisionsSQL = `
SELECT d.id::text, d.payment_event_id::text, pe.payment_id, d.chosen_action::text,
       coalesce(d.erv_at_decision,0)::float8, d.policy_check_result::text, d.policy_version,
       d.recovery_state::text, d.decided_at
FROM decisions d
JOIN payment_events pe ON pe.id = d.payment_event_id
WHERE d.merchant_id = $1
ORDER BY d.decided_at DESC
LIMIT $2`

	listDecisionsByPaymentSQL = `
SELECT d.id::text, d.payment_event_id::text, pe.payment_id, d.chosen_action::text,
       coalesce(d.erv_at_decision,0)::float8, d.policy_check_result::text, d.policy_version,
       d.recovery_state::text, d.decided_at
FROM decisions d
JOIN payment_events pe ON pe.id = d.payment_event_id
WHERE d.merchant_id = $1 AND pe.payment_id = $2
ORDER BY d.decided_at DESC`

	getDecisionSQL = `
SELECT d.id::text, d.payment_event_id::text, pe.payment_id, d.chosen_action::text,
       coalesce(d.erv_at_decision,0)::float8, d.policy_check_result::text, d.policy_version,
       d.recovery_state::text, d.decided_at, d.merchant_id,
       coalesce(dg.root_cause::text,''), coalesce(dg.confidence,0)::float8,
       coalesce(dg.rationale,''), coalesce(dg.model_version,''),
       coalesce((SELECT string_agg(DISTINCT model_version, ',') FROM success_model_scores
                  WHERE payment_event_id = d.payment_event_id), ''),
       d.policy_checks_json
FROM decisions d
JOIN payment_events pe ON pe.id = d.payment_event_id
LEFT JOIN diagnoses dg ON dg.payment_event_id = d.payment_event_id
WHERE d.id = $1::uuid AND d.merchant_id = $2`

	getDecisionCandidatesSQL = `
SELECT action_type::text, p_success::float8, recoverable_amount, cost::float8,
       friction_penalty::float8, erv::float8
FROM erv_scores
WHERE payment_event_id = $1::uuid
ORDER BY erv DESC`

	// decisionOwnedSQL verifies a decision belongs to the merchant (override authorization).
	decisionOwnedSQL = `SELECT chosen_action::text FROM decisions WHERE id = $1::uuid AND merchant_id = $2`

	setMerchantKillSwitchSQL = `
UPDATE merchant_policy_config SET kill_switch = $2, updated_at = now() WHERE merchant_id = $1`

	ensurePlatformRowSQL = `INSERT INTO platform_policy (id) VALUES ('platform') ON CONFLICT (id) DO NOTHING`

	setGlobalKillSwitchSQL = `
UPDATE platform_policy SET global_kill_switch = $1, updated_at = now() WHERE id = 'platform'`

	recoverySummarySQL = `
SELECT
  (SELECT count(*) FROM decisions WHERE merchant_id = $1),
  (SELECT count(*) FROM actions a JOIN decisions d ON d.id = a.decision_id WHERE d.merchant_id = $1),
  (SELECT count(*) FROM outcomes o
     JOIN actions a ON a.id = o.action_id
     JOIN decisions d ON d.id = a.decision_id
    WHERE d.merchant_id = $1 AND o.recovered_amount IS NOT NULL AND o.recovered_amount > 0),
  (SELECT coalesce(sum(o.recovered_amount),0) FROM outcomes o
     JOIN actions a ON a.id = o.action_id
     JOIN decisions d ON d.id = a.decision_id
    WHERE d.merchant_id = $1),
  (SELECT coalesce(sum(e.cost),0)::float8 FROM erv_scores e
     JOIN decisions d ON d.payment_event_id = e.payment_event_id AND d.chosen_action = e.action_type
    WHERE d.merchant_id = $1 AND d.chosen_action <> 'no_action'),
  (SELECT count(*) FROM decisions WHERE merchant_id = $1 AND policy_check_result = 'HUMAN_REVIEW'),
  (SELECT count(*) FROM decisions WHERE merchant_id = $1 AND chosen_action = 'no_action')`

	auditByPaymentSQL = `
SELECT id, entity_type, entity_id, actor, details_json, at
FROM audit_log
WHERE merchant_id = $1
  AND entity_id IN (
      SELECT d.id::text FROM decisions d
        JOIN payment_events pe ON pe.id = d.payment_event_id
       WHERE pe.payment_id = $2
      UNION
      SELECT a.id::text FROM actions a
        JOIN decisions d ON d.id = a.decision_id
        JOIN payment_events pe ON pe.id = d.payment_event_id
       WHERE pe.payment_id = $2
  )
ORDER BY id ASC`

	getPolicyConfigSQL = `
SELECT max_retries, cooldown_minutes, min_erv_threshold::float8, daily_action_cap,
       amount_ceiling, confidence_floor_override::float8, kill_switch
FROM merchant_policy_config
WHERE merchant_id = $1`

	updatePolicyConfigSQL = `
UPDATE merchant_policy_config
   SET max_retries = $2, cooldown_minutes = $3, min_erv_threshold = $4,
       daily_action_cap = $5, amount_ceiling = $6, confidence_floor_override = $7, updated_at = now()
 WHERE merchant_id = $1`

	loadPlatformSQL = `
SELECT global_kill_switch, confidence_floor::float8, max_retries_ceiling,
       min_cooldown_minutes, max_amount_ceiling, max_daily_action_cap
FROM platform_policy WHERE id = 'platform'`
)
