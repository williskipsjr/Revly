package erv

import (
	"math"
	"testing"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/domain"
)

// TestCompute_Formula checks the ERV arithmetic and the friction_penalty derivation on a
// worked example: p=0.5, amount=₹1000 (100000 paise), cost=200, weight=2, retry base
// friction 500 → friction_penalty 1000 → ERV = 0.5*100000 - 200 - 1000 = 48800.
func TestCompute_Formula(t *testing.T) {
	c := Compute(Input{
		Action: domain.ActionRetry, PSuccess: 0.5, RecoverableAmount: 100000,
		Cost: 200, FrictionWeight: 2,
	})
	if c.FrictionPenalty != 1000 {
		t.Errorf("friction_penalty = %v, want 1000", c.FrictionPenalty)
	}
	if c.ERV != 48800 {
		t.Errorf("ERV = %v, want 48800", c.ERV)
	}
}

// TestCompute_NoActionZeroBaseline: with p=0, cost=0, weight=0 (the no_action config),
// ERV is exactly 0 — the clean baseline interventions must beat.
func TestCompute_NoActionZeroBaseline(t *testing.T) {
	c := Compute(Input{Action: domain.ActionNoAction, PSuccess: 0, RecoverableAmount: 500000})
	if c.ERV != 0 || c.FrictionPenalty != 0 {
		t.Errorf("no_action ERV=%v friction=%v, want 0/0", c.ERV, c.FrictionPenalty)
	}
}

// TestCompute_NeverNaNOrInf: property — ERV and friction are always finite across a wide
// input grid (never NaN/±Inf), so a decision number is always well-defined.
func TestCompute_NeverNaNOrInf(t *testing.T) {
	actions := []domain.Action{domain.ActionRetry, domain.ActionAltMethod, domain.ActionEscalate, domain.ActionNoAction}
	for _, a := range actions {
		for _, p := range []float64{0, 0.25, 0.5, 0.75, 1} {
			for _, amt := range []int64{0, 1, 100000, 9_999_999_999} {
				for _, w := range []float64{0, 0.5, 1, 2, 10} {
					c := Compute(Input{Action: a, PSuccess: p, RecoverableAmount: amt, Cost: 200, FrictionWeight: w})
					if math.IsNaN(c.ERV) || math.IsInf(c.ERV, 0) {
						t.Errorf("ERV not finite for %+v: %v", a, c.ERV)
					}
					if c.FrictionPenalty < 0 {
						t.Errorf("friction_penalty negative for %s: %v", a, c.FrictionPenalty)
					}
				}
			}
		}
	}
}

// TestCompute_MonotonicInPSuccess: property — for fixed other terms, ERV is non-decreasing
// in P(success). Higher success probability is never economically worse.
func TestCompute_MonotonicInPSuccess(t *testing.T) {
	prev := math.Inf(-1)
	for _, p := range []float64{0, 0.1, 0.2, 0.5, 0.9, 1} {
		c := Compute(Input{Action: domain.ActionAltMethod, PSuccess: p, RecoverableAmount: 100000, Cost: 20, FrictionWeight: 1})
		if c.ERV < prev {
			t.Errorf("ERV decreased as P(success) rose: p=%v erv=%v prev=%v", p, c.ERV, prev)
		}
		prev = c.ERV
	}
}

// TestRank_SortsDescendingStable: candidates come back highest-ERV first, and equal-ERV
// candidates keep input order (stable).
func TestRank_SortsDescendingStable(t *testing.T) {
	inputs := []Input{
		{Action: domain.ActionNotify, PSuccess: 0.2, RecoverableAmount: 100000, Cost: 20, FrictionWeight: 1},    // lower
		{Action: domain.ActionAltMethod, PSuccess: 0.5, RecoverableAmount: 100000, Cost: 20, FrictionWeight: 1}, // higher
		{Action: domain.ActionNoAction, PSuccess: 0, RecoverableAmount: 100000, Cost: 0, FrictionWeight: 0},     // zero
	}
	ranked := Rank(inputs)
	if len(ranked) != 3 {
		t.Fatalf("expected 3 candidates, got %d", len(ranked))
	}
	for i := 1; i < len(ranked); i++ {
		if ranked[i-1].ERV < ranked[i].ERV {
			t.Errorf("not sorted descending at %d: %v < %v", i, ranked[i-1].ERV, ranked[i].ERV)
		}
	}
	if ranked[0].Action != domain.ActionAltMethod {
		t.Errorf("top candidate = %s, want alt_method", ranked[0].Action)
	}
}
