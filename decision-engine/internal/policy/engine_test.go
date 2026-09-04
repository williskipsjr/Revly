package policy

import (
	"testing"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/domain"
)

// TestEvaluate_Table drives every constraint, including exact-threshold edges (ERV equal to
// the floor, effective attempts equal to the cap), and the precedence between constraints.
func TestEvaluate_Table(t *testing.T) {
	tests := []struct {
		name       string
		in         Input
		wantResult domain.PolicyResult
		wantReason string
	}{
		{
			name:       "healthy intervention allowed",
			in:         Input{Action: domain.ActionAltMethod, ERV: 10000, EffectiveAttempts: 0, MaxRetries: 3, MinERVThreshold: 5000},
			wantResult: domain.PolicyAllow,
		},
		{
			name:       "no_action always allowed even below floor",
			in:         Input{Action: domain.ActionNoAction, ERV: 0, EffectiveAttempts: 9, MaxRetries: 3, MinERVThreshold: 5000},
			wantResult: domain.PolicyAllow,
		},
		{
			name:       "kill switch blocks intervention",
			in:         Input{Action: domain.ActionRetry, ERV: 999999, EffectiveAttempts: 0, MaxRetries: 3, MinERVThreshold: 100, KillSwitch: true},
			wantResult: domain.PolicyBlock,
			wantReason: "kill_switch_active",
		},
		{
			name:       "kill switch still allows no_action",
			in:         Input{Action: domain.ActionNoAction, ERV: 0, MaxRetries: 3, KillSwitch: true},
			wantResult: domain.PolicyAllow,
		},
		{
			name:       "max retries: attempts equal to cap is blocked (edge)",
			in:         Input{Action: domain.ActionRetry, ERV: 999999, EffectiveAttempts: 3, MaxRetries: 3, MinERVThreshold: 100},
			wantResult: domain.PolicyBlock,
			wantReason: "max_retries_exceeded",
		},
		{
			name:       "max retries: one below cap is allowed (edge)",
			in:         Input{Action: domain.ActionRetry, ERV: 999999, EffectiveAttempts: 2, MaxRetries: 3, MinERVThreshold: 100},
			wantResult: domain.PolicyAllow,
		},
		{
			name:       "max retries does not apply to non-retry action",
			in:         Input{Action: domain.ActionAltMethod, ERV: 999999, EffectiveAttempts: 99, MaxRetries: 3, MinERVThreshold: 100},
			wantResult: domain.PolicyAllow,
		},
		{
			name:       "min ERV: exactly at threshold is blocked (strict exceed, edge)",
			in:         Input{Action: domain.ActionAltMethod, ERV: 5000, EffectiveAttempts: 0, MaxRetries: 3, MinERVThreshold: 5000},
			wantResult: domain.PolicyBlock,
			wantReason: "below_min_erv",
		},
		{
			name:       "min ERV: just above threshold is allowed (edge)",
			in:         Input{Action: domain.ActionAltMethod, ERV: 5000.0001, EffectiveAttempts: 0, MaxRetries: 3, MinERVThreshold: 5000},
			wantResult: domain.PolicyAllow,
		},
		{
			name:       "min ERV: negative ERV intervention blocked",
			in:         Input{Action: domain.ActionEscalate, ERV: -1, EffectiveAttempts: 0, MaxRetries: 3, MinERVThreshold: 0},
			wantResult: domain.PolicyBlock,
			wantReason: "below_min_erv",
		},
		{
			name:       "precedence: kill switch beats max-retries and ERV",
			in:         Input{Action: domain.ActionRetry, ERV: -5, EffectiveAttempts: 9, MaxRetries: 3, MinERVThreshold: 5000, KillSwitch: true},
			wantResult: domain.PolicyBlock,
			wantReason: "kill_switch_active",
		},
		{
			name:       "precedence: max-retries beats ERV floor",
			in:         Input{Action: domain.ActionRetry, ERV: -5, EffectiveAttempts: 3, MaxRetries: 3, MinERVThreshold: 5000},
			wantResult: domain.PolicyBlock,
			wantReason: "max_retries_exceeded",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Evaluate(tt.in)
			if got.Decision != tt.wantResult {
				t.Errorf("decision = %q, want %q", got.Decision, tt.wantResult)
			}
			if got.Reason != tt.wantReason {
				t.Errorf("reason = %q, want %q", got.Reason, tt.wantReason)
			}
			if got.PolicyVersion != Version {
				t.Errorf("policy version = %q, want %q", got.PolicyVersion, Version)
			}
			if len(got.Checks) == 0 {
				t.Error("expected at least one recorded check")
			}
			// A BLOCK must record exactly one failed check (the constraint that fired).
			if got.Decision == domain.PolicyBlock {
				failed := 0
				for _, c := range got.Checks {
					if !c.Passed {
						failed++
					}
				}
				if failed != 1 {
					t.Errorf("expected exactly 1 failed check on BLOCK, got %d (%+v)", failed, got.Checks)
				}
			}
			// An ALLOW must have every check passed.
			if got.Decision == domain.PolicyAllow {
				for _, c := range got.Checks {
					if !c.Passed {
						t.Errorf("ALLOW must have all checks passed, but %q failed", c.Name)
					}
				}
			}
		})
	}
}
