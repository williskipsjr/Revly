package executor

import (
	"context"
	"testing"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/domain"
)

// TestIdempotencyKey_Deterministic: the same tuple always yields the same key.
func TestIdempotencyKey_Deterministic(t *testing.T) {
	a := IdempotencyKey("pay_1", "dec_1", domain.ActionRetry)
	b := IdempotencyKey("pay_1", "dec_1", domain.ActionRetry)
	if a != b {
		t.Fatalf("key not deterministic: %s != %s", a, b)
	}
	if len(a) != 64 { // sha256 hex
		t.Fatalf("expected 64-hex-char key, got %d chars", len(a))
	}
}

// TestIdempotencyKey_DistinctInputs: changing any field changes the key, and the field
// separator prevents aliasing between different tuples that concatenate to the same string.
func TestIdempotencyKey_DistinctInputs(t *testing.T) {
	base := IdempotencyKey("pay_1", "dec_1", domain.ActionRetry)
	variants := []string{
		IdempotencyKey("pay_2", "dec_1", domain.ActionRetry),
		IdempotencyKey("pay_1", "dec_2", domain.ActionRetry),
		IdempotencyKey("pay_1", "dec_1", domain.ActionAltMethod),
		// Aliasing probe: without a separator, ("pay_1a","b") and ("pay_1","ab") could collide.
		IdempotencyKey("pay_1a", "dec_1", domain.ActionRetry),
	}
	seen := map[string]bool{base: true}
	for i, v := range variants {
		if seen[v] {
			t.Errorf("variant %d collided with an earlier key: %s", i, v)
		}
		seen[v] = true
	}
}

// TestMockDispatch_RecoveringActions: charge/re-presentment actions recover the full amount.
func TestMockDispatch_RecoveringActions(t *testing.T) {
	d := MockDispatcher{}
	for _, a := range []domain.Action{domain.ActionRetry, domain.ActionDelayedRetry, domain.ActionAltMethod, domain.ActionPaymentLink} {
		out, err := d.Dispatch(context.Background(), a, 50000, IdempotencyKey("p", "d", a))
		if err != nil {
			t.Fatalf("mock dispatch %s errored: %v", a, err)
		}
		if !out.Recovered || out.RecoveredAmount != 50000 {
			t.Errorf("%s: expected recovered 50000, got recovered=%v amount=%d", a, out.Recovered, out.RecoveredAmount)
		}
		if out.Status != domain.ActionStatusConfirmed {
			t.Errorf("%s: expected confirmed status, got %s", a, out.Status)
		}
	}
}

// TestMockDispatch_OutOfBandActions: notify/escalate dispatch but do not themselves recover.
func TestMockDispatch_OutOfBandActions(t *testing.T) {
	d := MockDispatcher{}
	for _, a := range []domain.Action{domain.ActionNotify, domain.ActionEscalate} {
		out, _ := d.Dispatch(context.Background(), a, 50000, IdempotencyKey("p", "d", a))
		if out.Recovered {
			t.Errorf("%s should not recover the payment directly", a)
		}
		if out.Status != domain.ActionStatusConfirmed {
			t.Errorf("%s: expected confirmed dispatch, got %s", a, out.Status)
		}
		if out.RecoveredAmount != 0 {
			t.Errorf("%s: expected 0 recovered amount, got %d", a, out.RecoveredAmount)
		}
	}
}
