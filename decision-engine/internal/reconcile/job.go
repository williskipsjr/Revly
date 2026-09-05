// Package reconcile is the Phase 6 reconciliation job: it settles actions left in
// pending_confirmation — the ambiguous-outcome case where an external call was sent but its
// result is unknown (a timeout/5xx after send). It resolves each such action's true outcome via
// the executor's StatusResolver and closes it out idempotently, WITHOUT ever re-dispatching a
// financial action (PLAN.md §8/§12).
//
// It is a plain in-process job (a background sweep + an on-demand endpoint), not a new service.
// Postgres remains the source of truth; the settlement update is guarded on the row still being
// pending_confirmation, so concurrent sweeps or a repeated endpoint call settle each action
// exactly once.
package reconcile

import (
	"context"
	"log/slog"
	"time"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/domain"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/executor"
)

// PendingAction is one action awaiting reconciliation, with the facts the resolver needs.
type PendingAction struct {
	ActionID    string
	DecisionID  string
	MerchantID  string
	PaymentID   string
	Action      domain.Action
	ExternalRef string
	Amount      int64 // paise, from the payment
}

// Settlement is the resolved outcome to persist for a pending action.
type Settlement struct {
	ActionID        string
	DecisionID      string
	MerchantID      string
	Action          domain.Action
	Status          domain.ActionStatus // confirmed | failed
	OutcomeResult   string
	Recovered       bool
	RecoveredAmount *int64
	FinalState      domain.RecoveryState
	StateHistory    []domain.RecoveryState
}

// Repository is the durable boundary the reconciler needs, implemented by internal/store.
type Repository interface {
	// LoadPendingConfirmations returns up to limit actions still in pending_confirmation.
	LoadPendingConfirmations(ctx context.Context, limit int) ([]PendingAction, error)
	// SettleAction atomically resolves one pending action: it flips actions.status (only if the
	// row is still pending_confirmation), writes the outcome, advances decisions.recovery_state,
	// and audits it. settled=false means the row was already resolved (idempotent no-op).
	SettleAction(ctx context.Context, s Settlement) (settled bool, err error)
}

// Report summarizes one reconciliation sweep.
type Report struct {
	Scanned      int `json:"scanned"`
	Settled      int `json:"settled"`
	Recovered    int `json:"recovered"`
	Failed       int `json:"failed"`
	StillPending int `json:"still_pending"`
}

// Reconciler settles pending_confirmation actions.
type Reconciler struct {
	repo     Repository
	resolver executor.StatusResolver
	logger   *slog.Logger
}

// NewReconciler builds a Reconciler. resolver is the same executor used for dispatch (the mock
// in demo mode, the Razorpay dispatcher in sandbox mode).
func NewReconciler(repo Repository, resolver executor.StatusResolver, logger *slog.Logger) *Reconciler {
	if logger == nil {
		logger = slog.Default()
	}
	return &Reconciler{repo: repo, resolver: resolver, logger: logger}
}

// defaultBatch bounds one sweep so the job is predictable and never long-running.
const defaultBatch = 100

// ReconcileOnce performs a single sweep of up to limit pending actions (0 → defaultBatch).
func (r *Reconciler) ReconcileOnce(ctx context.Context, limit int) (Report, error) {
	if limit <= 0 {
		limit = defaultBatch
	}
	pending, err := r.repo.LoadPendingConfirmations(ctx, limit)
	if err != nil {
		return Report{}, err
	}
	rep := Report{Scanned: len(pending)}
	for _, p := range pending {
		out, err := r.resolver.Resolve(ctx, p.Action, p.Amount, p.ExternalRef)
		if err != nil {
			r.logger.Warn("reconcile: resolve failed, leaving pending", "action_id", p.ActionID, "err", err)
			rep.StillPending++
			continue
		}
		// Still ambiguous — leave it for a later sweep rather than guessing.
		if out.Status == domain.ActionStatusPendingConfirmation {
			rep.StillPending++
			continue
		}

		st := settlementFor(p, out)
		settled, err := r.repo.SettleAction(ctx, st)
		if err != nil {
			r.logger.Error("reconcile: settle failed", "action_id", p.ActionID, "err", err)
			rep.StillPending++
			continue
		}
		if !settled {
			// Someone else settled it first; not counted as our settlement.
			continue
		}
		rep.Settled++
		if out.Recovered {
			rep.Recovered++
		} else {
			rep.Failed++
		}
		r.logger.Info("reconcile: action settled",
			"action_id", p.ActionID, "status", st.Status, "recovered", out.Recovered, "final_state", st.FinalState)
	}
	return rep, nil
}

// RunLoop sweeps every interval until ctx is cancelled. interval<=0 disables the loop.
func (r *Reconciler) RunLoop(ctx context.Context, interval time.Duration) {
	if interval <= 0 {
		return
	}
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if rep, err := r.ReconcileOnce(ctx, defaultBatch); err != nil {
				r.logger.Warn("reconcile sweep error", "err", err)
			} else if rep.Settled > 0 {
				r.logger.Info("reconcile sweep", "scanned", rep.Scanned, "settled", rep.Settled)
			}
		}
	}
}

// settlementFor maps a resolved Outcome to the durable settlement + recovery-state path.
func settlementFor(p PendingAction, out executor.Outcome) Settlement {
	s := Settlement{
		ActionID:      p.ActionID,
		DecisionID:    p.DecisionID,
		MerchantID:    p.MerchantID,
		Action:        p.Action,
		Status:        out.Status,
		OutcomeResult: out.Result,
		Recovered:     out.Recovered,
	}
	if out.Recovered {
		amt := out.RecoveredAmount
		s.RecoveredAmount = &amt
		s.FinalState = domain.StateDone
		s.StateHistory = []domain.RecoveryState{domain.StateActionPending, domain.StateRecovered, domain.StateDone}
	} else {
		s.FinalState = domain.StateStopped
		s.StateHistory = []domain.RecoveryState{domain.StateActionPending, domain.StateFailed, domain.StateReEvaluate, domain.StateStopped}
	}
	return s
}
