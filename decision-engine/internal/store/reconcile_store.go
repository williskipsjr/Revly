package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/domain"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/pipeline"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/reconcile"
)

// Compile-time assertion that Store satisfies the reconciler's persistence boundary.
var _ reconcile.Repository = (*Store)(nil)

// RecordPendingAction idempotently inserts an action at status pending_confirmation and, only on
// a first insert, advances the decision to ACTION_PENDING and audits it. It writes NO outcome —
// the ambiguous result is settled later by the reconciler. The unique idempotency_key makes a
// duplicate dispatch a no-op (created=false), preserving "no duplicate financial action".
func (s *Store) RecordPendingAction(ctx context.Context, rec pipeline.PendingActionRecord) (bool, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback() }()

	var actionID string
	err = tx.QueryRowContext(ctx, insertActionSQL,
		rec.DecisionID, string(rec.Action), rec.IdempotencyKey,
		nullableStringVal(rec.ExternalIdempotencyKey), string(domain.ActionStatusPendingConfirmation),
	).Scan(&actionID)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		if err := tx.Commit(); err != nil {
			return false, err
		}
		return false, nil // duplicate dispatch
	case err != nil:
		return false, fmt.Errorf("store: insert pending action: %w", err)
	}

	if _, err := tx.ExecContext(ctx, updateDecisionStateSQL, rec.DecisionID, string(rec.PendingState)); err != nil {
		return false, fmt.Errorf("store: set pending recovery_state: %w", err)
	}

	details := mustJSON(map[string]any{
		"stage":          "execution_pending",
		"action_id":      actionID,
		"action":         string(rec.Action),
		"action_status":  string(domain.ActionStatusPendingConfirmation),
		"recovery_state": string(rec.PendingState),
		"state_history":  statesToStrings(rec.StateHistory),
	})
	if _, err := tx.ExecContext(ctx, insertAuditSQL, rec.MerchantID, "action", actionID, "executor", details); err != nil {
		return false, fmt.Errorf("store: insert pending audit: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return false, err
	}
	return true, nil
}

// LoadPendingConfirmations returns up to limit actions still awaiting reconciliation.
func (s *Store) LoadPendingConfirmations(ctx context.Context, limit int) ([]reconcile.PendingAction, error) {
	rows, err := s.db.QueryContext(ctx, loadPendingConfirmationsSQL, limit)
	if err != nil {
		return nil, fmt.Errorf("store: load pending confirmations: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var out []reconcile.PendingAction
	for rows.Next() {
		var p reconcile.PendingAction
		var action, extRef string
		if err := rows.Scan(&p.ActionID, &p.DecisionID, &p.MerchantID, &p.PaymentID, &action, &extRef, &p.Amount); err != nil {
			return nil, fmt.Errorf("store: scan pending confirmation: %w", err)
		}
		p.Action = domain.Action(action)
		p.ExternalRef = extRef
		out = append(out, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("store: iterate pending confirmations: %w", err)
	}
	return out, nil
}

// SettleAction resolves one pending_confirmation action atomically and idempotently. The status
// UPDATE is guarded on the row still being pending_confirmation; if it changed nothing, the
// action was already settled and this call is a no-op (settled=false), so concurrent sweeps or a
// repeated endpoint call never double-write an outcome.
func (s *Store) SettleAction(ctx context.Context, st reconcile.Settlement) (bool, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback() }()

	res, err := tx.ExecContext(ctx, settleActionSQL, st.ActionID, string(st.Status))
	if err != nil {
		return false, fmt.Errorf("store: settle action update: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return false, err
	}
	if n == 0 {
		// Already settled by someone else.
		if err := tx.Commit(); err != nil {
			return false, err
		}
		return false, nil
	}

	if _, err := tx.ExecContext(ctx, insertOutcomeSQL, st.ActionID, st.OutcomeResult, nullableInt64(st.RecoveredAmount)); err != nil {
		return false, fmt.Errorf("store: settle insert outcome: %w", err)
	}
	if _, err := tx.ExecContext(ctx, updateDecisionStateSQL, st.DecisionID, string(st.FinalState)); err != nil {
		return false, fmt.Errorf("store: settle update decision state: %w", err)
	}
	details := mustJSON(map[string]any{
		"stage":          "reconciliation",
		"action_id":      st.ActionID,
		"action":         string(st.Action),
		"action_status":  string(st.Status),
		"outcome_result": st.OutcomeResult,
		"recovered":      st.Recovered,
		"final_state":    string(st.FinalState),
		"state_history":  statesToStrings(st.StateHistory),
	})
	if _, err := tx.ExecContext(ctx, insertAuditSQL, st.MerchantID, "action", st.ActionID, "reconciler", details); err != nil {
		return false, fmt.Errorf("store: settle insert audit: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return false, err
	}
	return true, nil
}
