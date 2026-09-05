package store

// SQL for the Phase 6 reconciliation path (pending_confirmation settlement). It reuses the
// shared inserts in pipeline_sql.go (insertActionSQL, insertOutcomeSQL, updateDecisionStateSQL,
// insertAuditSQL) and adds only the two statements unique to reconciliation.
const (
	// loadPendingConfirmationsSQL lists actions still awaiting reconciliation, oldest first,
	// joined to their payment for the recoverable amount the resolver needs.
	loadPendingConfirmationsSQL = `
SELECT
    a.id::text,
    a.decision_id::text,
    d.merchant_id,
    p.id,
    a.action_type::text,
    coalesce(a.external_idempotency_key, ''),
    p.amount
FROM actions a
JOIN decisions d       ON d.id = a.decision_id
JOIN payment_events pe ON pe.id = d.payment_event_id
JOIN payments p        ON p.id = pe.payment_id
WHERE a.status = 'pending_confirmation'
ORDER BY a.executed_at ASC NULLS FIRST
LIMIT $1`

	// settleActionSQL flips a pending action to its resolved status ONLY while it is still
	// pending_confirmation. RowsAffected==0 means it was already settled — the idempotency guard
	// that makes reconciliation safe under concurrent sweeps.
	settleActionSQL = `
UPDATE actions
   SET status = $2::action_status
 WHERE id = $1::uuid
   AND status = 'pending_confirmation'`
)
