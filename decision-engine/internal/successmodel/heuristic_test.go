package successmodel

import (
	"testing"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/domain"
)

var allActions = []domain.Action{
	domain.ActionRetry, domain.ActionDelayedRetry, domain.ActionAltMethod,
	domain.ActionPaymentLink, domain.ActionNotify, domain.ActionEscalate, domain.ActionNoAction,
}

var methods = []string{"card", "upi", "netbanking", "wallet", "emi", "other", "unknown_method"}

// TestPSuccess_Range: every estimate is a valid probability in [0,1].
func TestPSuccess_Range(t *testing.T) {
	for _, a := range allActions {
		for _, m := range methods {
			for _, pa := range []int{-1, 0, 1, 2, 5, 20} {
				p := PSuccess(a, m, pa)
				if p < 0 || p > 1 {
					t.Errorf("PSuccess(%s,%s,%d)=%v out of [0,1]", a, m, pa, p)
				}
			}
		}
	}
}

// TestPSuccess_NoActionAlwaysZero: no_action is never credited with recovery.
func TestPSuccess_NoActionAlwaysZero(t *testing.T) {
	for _, m := range methods {
		for _, pa := range []int{0, 1, 5} {
			if p := PSuccess(domain.ActionNoAction, m, pa); p != 0 {
				t.Errorf("PSuccess(no_action,%s,%d)=%v, want 0", m, pa, p)
			}
		}
	}
}

// TestPSuccess_MonotonicInPriorAttempts: more prior failures never increase the estimate.
func TestPSuccess_MonotonicInPriorAttempts(t *testing.T) {
	for _, a := range allActions {
		for _, m := range methods {
			prev := PSuccess(a, m, 0)
			for pa := 1; pa <= 10; pa++ {
				cur := PSuccess(a, m, pa)
				if cur > prev {
					t.Errorf("PSuccess(%s,%s,%d)=%v > previous %v — not monotonic non-increasing", a, m, pa, cur, prev)
				}
				prev = cur
			}
		}
	}
}

// TestPSuccess_UnknownMethodUsesDefault: an unknown method resolves to the default
// multiplier rather than panicking or returning zero.
func TestPSuccess_UnknownMethodUsesDefault(t *testing.T) {
	want := actionBaseRate[domain.ActionRetry] * defaultMethodMultiplier
	got := PSuccess(domain.ActionRetry, "does_not_exist", 0)
	if got != want {
		t.Errorf("unknown method: got %v, want %v (base*default)", got, want)
	}
}

// TestPSuccess_NegativeAttemptsClampToZero: a negative prior-attempt count is treated as 0.
func TestPSuccess_NegativeAttemptsClampToZero(t *testing.T) {
	if a, b := PSuccess(domain.ActionRetry, "card", -3), PSuccess(domain.ActionRetry, "card", 0); a != b {
		t.Errorf("negative attempts %v != zero attempts %v", a, b)
	}
}
