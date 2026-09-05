package executor

import (
	"context"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/domain"
)

// Outcome is the result of a (mocked, in Phase 2) external dispatch. It deliberately keeps
// two distinct facts apart:
//   - Status: did the external CALL succeed (was the action dispatched)? → actions.status
//   - Recovered: did the PAYMENT recover as a result? → drives the recovery state machine
//
// A notify can be delivered successfully (Status=confirmed) without the payment recovering
// (Recovered=false); a retry can both dispatch and recover. Keeping them separate mirrors
// the real world, where the recovery outcome arrives out-of-band (a webhook, Phase 6).
type Outcome struct {
	Status          domain.ActionStatus
	Recovered       bool
	RecoveredAmount int64  // paise; meaningful only when Recovered
	Result          string // human-readable outcome label, persisted to outcomes.result
	ExternalRef     string // mock external reference id
}

// Dispatcher executes a chosen action against an external system. Phase 2 ships only the
// MockDispatcher; Phase 6 adds a real Razorpay-sandbox implementation behind this same
// interface, with retries, external idempotency-key headers, and pending_confirmation.
type Dispatcher interface {
	Dispatch(ctx context.Context, action domain.Action, amount int64, idempotencyKey string) (Outcome, error)
}

// StatusResolver resolves the true outcome of an action that was left in pending_confirmation
// (an ambiguous external response, e.g. a timeout after send). The Phase-6 reconciler calls it
// to settle such actions without ever blindly re-dispatching them (PLAN.md §8/§12). Both the
// MockDispatcher and the Razorpay dispatcher implement it, so reconciliation works in demo and
// sandbox modes alike.
type StatusResolver interface {
	Resolve(ctx context.Context, action domain.Action, amount int64, externalRef string) (Outcome, error)
}

// Resolve settles a pending_confirmation action deterministically for the mock: charge/
// re-presentment actions are treated as recovered, out-of-band actions as dispatched-not-
// recovered. It mirrors Dispatch so a mock timeout reconciles to a consistent final state.
func (m MockDispatcher) Resolve(ctx context.Context, action domain.Action, amount int64, externalRef string) (Outcome, error) {
	return m.Dispatch(ctx, action, amount, externalRef)
}

// MockDispatcher simulates external action execution with NO real network/API call
// (PLAN.md §15). It is deterministic so the vertical slice is reproducible in tests and
// demos: charge/re-presentment actions "recover" the payment; out-of-band actions (notify,
// escalate) dispatch successfully but do not themselves recover it. This is a mock, clearly
// labeled — it makes no claim about real recovery rates.
type MockDispatcher struct{}

// Dispatch returns a deterministic mock Outcome. It never errors — a mock external system is
// always reachable — so the caller's error path is still wired for the real Phase 6
// dispatcher without being exercised here.
func (MockDispatcher) Dispatch(_ context.Context, action domain.Action, amount int64, idempotencyKey string) (Outcome, error) {
	ref := "mock-" + shortRef(idempotencyKey)
	switch action {
	case domain.ActionRetry, domain.ActionDelayedRetry, domain.ActionAltMethod, domain.ActionPaymentLink:
		return Outcome{
			Status:          domain.ActionStatusConfirmed,
			Recovered:       true,
			RecoveredAmount: amount,
			Result:          "mock_recovered",
			ExternalRef:     ref,
		}, nil
	case domain.ActionNotify, domain.ActionEscalate:
		return Outcome{
			Status:      domain.ActionStatusConfirmed,
			Recovered:   false,
			Result:      "mock_dispatched",
			ExternalRef: ref,
		}, nil
	default:
		// no_action is handled by the pipeline without dispatching; reaching here would be a
		// bug, so return a neutral, non-recovering result rather than pretending success.
		return Outcome{Status: domain.ActionStatusConfirmed, Recovered: false, Result: "mock_noop", ExternalRef: ref}, nil
	}
}

// shortRef returns a short, stable prefix of the idempotency key for the mock external ref.
func shortRef(key string) string {
	if len(key) > 12 {
		return key[:12]
	}
	return key
}
