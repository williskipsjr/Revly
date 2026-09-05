package reconcile

import (
	"context"
	"testing"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/domain"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/executor"
)

type fakeRepo struct {
	pending  []PendingAction
	settled  []Settlement
	returnOK bool
}

func (f *fakeRepo) LoadPendingConfirmations(_ context.Context, _ int) ([]PendingAction, error) {
	return f.pending, nil
}

func (f *fakeRepo) SettleAction(_ context.Context, s Settlement) (bool, error) {
	f.settled = append(f.settled, s)
	return f.returnOK, nil
}

// TestReconcileOnce_SettlesViaResolver: a charge action resolves to recovered→DONE, an
// out-of-band action to not-recovered→STOPPED, using the same executor as dispatch (the mock).
func TestReconcileOnce_SettlesViaResolver(t *testing.T) {
	repo := &fakeRepo{returnOK: true, pending: []PendingAction{
		{ActionID: "a1", DecisionID: "d1", MerchantID: "m", PaymentID: "p1", Action: domain.ActionRetry, Amount: 500000},
		{ActionID: "a2", DecisionID: "d2", MerchantID: "m", PaymentID: "p2", Action: domain.ActionNotify, Amount: 500000},
	}}
	r := NewReconciler(repo, executor.MockDispatcher{}, nil)

	rep, err := r.ReconcileOnce(context.Background(), 10)
	if err != nil {
		t.Fatalf("ReconcileOnce: %v", err)
	}
	if rep.Scanned != 2 || rep.Settled != 2 {
		t.Fatalf("report = %+v, want scanned=2 settled=2", rep)
	}
	if rep.Recovered != 1 || rep.Failed != 1 {
		t.Fatalf("report = %+v, want recovered=1 failed=1", rep)
	}
	if len(repo.settled) != 2 {
		t.Fatalf("settled %d, want 2", len(repo.settled))
	}
	// The retry settlement must reach DONE with a recovered amount; the notify one STOPPED.
	for _, s := range repo.settled {
		switch s.ActionID {
		case "a1":
			if s.FinalState != domain.StateDone || s.RecoveredAmount == nil {
				t.Errorf("retry settlement = %+v, want DONE + recovered amount", s)
			}
		case "a2":
			if s.FinalState != domain.StateStopped || s.Recovered {
				t.Errorf("notify settlement = %+v, want STOPPED + not recovered", s)
			}
		}
	}
}

// TestReconcileOnce_AlreadySettledNotCounted: SettleAction reporting false (row already settled)
// is not counted as our settlement.
func TestReconcileOnce_AlreadySettledNotCounted(t *testing.T) {
	repo := &fakeRepo{returnOK: false, pending: []PendingAction{
		{ActionID: "a1", DecisionID: "d1", MerchantID: "m", PaymentID: "p1", Action: domain.ActionRetry, Amount: 1},
	}}
	rep, err := NewReconciler(repo, executor.MockDispatcher{}, nil).ReconcileOnce(context.Background(), 10)
	if err != nil {
		t.Fatalf("ReconcileOnce: %v", err)
	}
	if rep.Settled != 0 {
		t.Fatalf("settled = %d, want 0 (already settled elsewhere)", rep.Settled)
	}
}
