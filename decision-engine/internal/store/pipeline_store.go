package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/domain"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/pipeline"
)

// ErrContextNotFound is returned by LoadContext when the payment_event does not exist or its
// merchant has no policy config. It lets the pipeline distinguish "nothing to process" from a
// transient DB error.
var ErrContextNotFound = errors.New("store: payment-event decision context not found")

// Store implements pipeline.Repository in addition to ingest.Ingestor. The compile-time
// assertion documents that contract.
var _ pipeline.Repository = (*Store)(nil)

// LoadContext assembles the decision context for one payment_event: the event/payment facts,
// the merchant's policy config (including the Phase 2 kill_switch), the Postgres-derived
// count of retry-type actions already taken on the payment, and the merchant's action costs.
func (s *Store) LoadContext(ctx context.Context, paymentEventID string) (pipeline.Context, error) {
	var (
		c         pipeline.Context
		confFloor sql.NullFloat64
	)
	err := s.db.QueryRowContext(ctx, loadContextSQL, paymentEventID).Scan(
		&c.PaymentEventID,
		&c.PaymentID,
		&c.MerchantID,
		&c.Amount,
		&c.Method,
		&c.EventType,
		&c.FailureReason,
		&c.PriorAttempts,
		&c.Policy.MaxRetries,
		&c.Policy.CooldownMinutes,
		&c.Policy.MinERVThreshold,
		&c.Policy.DailyActionCap,
		&c.Policy.AmountCeiling,
		&confFloor,
		&c.Policy.KillSwitch,
		&c.RetryActionsTaken,
	)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return pipeline.Context{}, ErrContextNotFound
	case err != nil:
		return pipeline.Context{}, fmt.Errorf("store: load context: %w", err)
	}
	if confFloor.Valid {
		v := confFloor.Float64
		c.Policy.ConfidenceFloorOverride = &v
	}

	costs, err := s.loadActionCosts(ctx, c.MerchantID)
	if err != nil {
		return pipeline.Context{}, err
	}
	c.ActionCosts = costs
	return c, nil
}

func (s *Store) loadActionCosts(ctx context.Context, merchantID string) (map[domain.Action]pipeline.ActionCost, error) {
	rows, err := s.db.QueryContext(ctx, loadActionCostsSQL, merchantID)
	if err != nil {
		return nil, fmt.Errorf("store: load action costs: %w", err)
	}
	defer func() { _ = rows.Close() }()

	costs := make(map[domain.Action]pipeline.ActionCost)
	for rows.Next() {
		var (
			action string
			cost   pipeline.ActionCost
		)
		if err := rows.Scan(&action, &cost.MonetaryCost, &cost.FrictionWeight); err != nil {
			return nil, fmt.Errorf("store: scan action cost: %w", err)
		}
		costs[domain.Action(action)] = cost
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("store: iterate action costs: %w", err)
	}
	return costs, nil
}

// PersistDecision transactionally writes the diagnosis, every candidate's success/ERV score
// rows, the decision row (stamped at rec.RecoveryState), and a decision audit entry. All or
// nothing: a failure leaves no partial decision behind.
func (s *Store) PersistDecision(ctx context.Context, rec pipeline.DecisionRecord) (string, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return "", err
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.ExecContext(ctx, insertDiagnosisSQL,
		rec.PaymentEventID, string(rec.RootCause), rec.Confidence, rec.Rationale, rec.DiagnosisModelVersion,
	); err != nil {
		return "", fmt.Errorf("store: insert diagnosis: %w", err)
	}

	for _, cand := range rec.Candidates {
		if _, err := tx.ExecContext(ctx, insertSuccessScoreSQL,
			rec.PaymentEventID, string(cand.Action), cand.PSuccess, rec.SuccessModelVersion,
		); err != nil {
			return "", fmt.Errorf("store: insert success score (%s): %w", cand.Action, err)
		}
		if _, err := tx.ExecContext(ctx, insertErvScoreSQL,
			rec.PaymentEventID, string(cand.Action), cand.PSuccess, cand.RecoverableAmount,
			cand.Cost, cand.FrictionPenalty, cand.ERV,
		); err != nil {
			return "", fmt.Errorf("store: insert erv score (%s): %w", cand.Action, err)
		}
	}

	var decisionID string
	if err := tx.QueryRowContext(ctx, insertDecisionSQL,
		rec.PaymentEventID, rec.MerchantID, string(rec.ChosenAction), rec.ERVAtDecision,
		rec.PolicyVersion, string(rec.PolicyCheckResult), nullableJSON(rec.PolicyChecksJSON), string(rec.RecoveryState),
	).Scan(&decisionID); err != nil {
		return "", fmt.Errorf("store: insert decision: %w", err)
	}

	details := decisionAuditDetails(rec, decisionID)
	if _, err := tx.ExecContext(ctx, insertAuditSQL,
		rec.MerchantID, "decision", decisionID, "pipeline", details,
	); err != nil {
		return "", fmt.Errorf("store: insert decision audit: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return "", err
	}
	return decisionID, nil
}

// FinalizeExecution idempotently records the dispatched action and, only on a first insert,
// its outcome, the decision's terminal recovery_state, and an execution audit entry.
//
// The unique idempotency_key insert is the correctness point: a duplicate fire inserts no
// action row (created=false) and this method then makes NO further writes — no second
// outcome, no double state change — so "no duplicate financial action" holds even under
// concurrent execution (proved by the store integration tests).
func (s *Store) FinalizeExecution(ctx context.Context, rec pipeline.ExecutionRecord) (bool, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback() }()

	var actionID string
	err = tx.QueryRowContext(ctx, insertActionSQL,
		rec.DecisionID, string(rec.Action), rec.IdempotencyKey,
		nullableStringVal(rec.ExternalIdempotencyKey), string(rec.ActionStatus),
	).Scan(&actionID)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		// Duplicate dispatch: the action already exists. Do nothing else and report it.
		if err := tx.Commit(); err != nil {
			return false, err
		}
		return false, nil
	case err != nil:
		return false, fmt.Errorf("store: insert action: %w", err)
	}

	if _, err := tx.ExecContext(ctx, insertOutcomeSQL,
		actionID, rec.OutcomeResult, nullableInt64(rec.RecoveredAmount),
	); err != nil {
		return false, fmt.Errorf("store: insert outcome: %w", err)
	}

	if _, err := tx.ExecContext(ctx, updateDecisionStateSQL,
		rec.DecisionID, string(rec.FinalState),
	); err != nil {
		return false, fmt.Errorf("store: update decision state: %w", err)
	}

	details := executionAuditDetails(rec, actionID)
	if _, err := tx.ExecContext(ctx, insertAuditSQL,
		rec.MerchantID, "action", actionID, "executor", details,
	); err != nil {
		return false, fmt.Errorf("store: insert execution audit: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return false, err
	}
	return true, nil
}

// decisionAuditDetails builds the append-only audit payload for a persisted decision, so the
// full causal chain (root cause, chosen action, economics, policy verdict, visited states)
// is reconstructable from audit_log alone (PLAN.md §11).
func decisionAuditDetails(rec pipeline.DecisionRecord, decisionID string) string {
	payload := map[string]any{
		"stage":               "decision",
		"decision_id":         decisionID,
		"root_cause":          string(rec.RootCause),
		"confidence":          rec.Confidence,
		"chosen_action":       string(rec.ChosenAction),
		"erv_at_decision":     rec.ERVAtDecision,
		"policy_version":      rec.PolicyVersion,
		"policy_check_result": string(rec.PolicyCheckResult),
		"recovery_state":      string(rec.RecoveryState),
		"state_history":       statesToStrings(rec.StateHistory),
	}
	return mustJSON(payload)
}

func executionAuditDetails(rec pipeline.ExecutionRecord, actionID string) string {
	payload := map[string]any{
		"stage":          "execution",
		"action_id":      actionID,
		"action":         string(rec.Action),
		"action_status":  string(rec.ActionStatus),
		"outcome_result": rec.OutcomeResult,
		"recovered":      rec.Recovered,
		"final_state":    string(rec.FinalState),
		"state_history":  statesToStrings(rec.StateHistory),
	}
	if rec.RecoveredAmount != nil {
		payload["recovered_amount"] = *rec.RecoveredAmount
	}
	return mustJSON(payload)
}

func statesToStrings(states []domain.RecoveryState) []string {
	out := make([]string, len(states))
	for i, s := range states {
		out[i] = string(s)
	}
	return out
}

// mustJSON marshals an audit payload we fully control; a failure is a programming error, so
// fall back to an empty JSON object rather than failing the transaction over telemetry.
func mustJSON(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(b)
}

// nullableStringVal returns nil for an empty string so an absent external key stores as NULL.
func nullableStringVal(s string) any {
	if s == "" {
		return nil
	}
	return s
}

// nullableInt64 returns nil for a nil pointer so an absent recovered amount stores as NULL.
func nullableInt64(p *int64) any {
	if p == nil {
		return nil
	}
	return *p
}
