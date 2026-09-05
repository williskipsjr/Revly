package policy

import (
	"testing"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/domain"
)

// base returns an Input on which EVERY Phase-5 rule passes for a retry action (ALLOW). Each
// table case flips exactly the fields under test, so a single failing check is unambiguous.
func base() Input {
	return Input{
		Action:                domain.ActionRetry,
		ERV:                   10000,
		EffectiveAttempts:     0,
		RootCause:             domain.RootTemporaryBankDecline,
		Confidence:            0.90,
		ConfidenceFloor:       0.40,
		Amount:                100000,
		AmountCeiling:         5000000,
		CooldownMinutes:       30,
		HasPriorRetry:         false,
		MinutesSinceLastRetry: 0,
		MaxRetries:            3,
		DailyActionCap:        20,
		CustomerActionsToday:  0,
		MinERVThreshold:       500,
		KillSwitch:            false,
		GlobalKillSwitch:      false,
	}
}

// with applies a mutation to a fresh base Input.
func with(mut func(*Input)) Input {
	in := base()
	mut(&in)
	return in
}

// TestEvaluate_Phase5Rules drives every Section-6 constraint, each hard-stop verdict, the
// exact-threshold boundaries, and the full precedence chain. The base Input passes everything;
// each case flips only what it tests.
func TestEvaluate_Phase5Rules(t *testing.T) {
	tests := []struct {
		name       string
		in         Input
		wantResult domain.PolicyResult
		wantReason string
	}{
		// ---- Global kill switch ----
		{"global kill switch blocks intervention",
			with(func(i *Input) { i.GlobalKillSwitch = true }),
			domain.PolicyBlock, reasonKillSwitch},
		{"global kill switch still allows no_action",
			with(func(i *Input) { i.GlobalKillSwitch = true; i.Action = domain.ActionNoAction }),
			domain.PolicyAllow, ""},
		{"merchant kill switch blocks intervention",
			with(func(i *Input) { i.KillSwitch = true }),
			domain.PolicyBlock, reasonKillSwitch},

		// ---- Fraud hard-stop ----
		{"fraud blocks autonomous retry",
			with(func(i *Input) { i.RootCause = domain.RootFraudSuspected }),
			domain.PolicyBlock, reasonFraudBlock},
		{"fraud blocks alt_method",
			with(func(i *Input) { i.RootCause = domain.RootFraudSuspected; i.Action = domain.ActionAltMethod }),
			domain.PolicyBlock, reasonFraudBlock},
		{"fraud blocks even notify (safety over nudge)",
			with(func(i *Input) { i.RootCause = domain.RootFraudSuspected; i.Action = domain.ActionNotify }),
			domain.PolicyBlock, reasonFraudBlock},
		{"fraud + escalate → HUMAN_REVIEW",
			with(func(i *Input) { i.RootCause = domain.RootFraudSuspected; i.Action = domain.ActionEscalate }),
			domain.PolicyHumanReview, reasonFraudReview},
		{"fraud never blocks no_action",
			with(func(i *Input) { i.RootCause = domain.RootFraudSuspected; i.Action = domain.ActionNoAction }),
			domain.PolicyAllow, ""},

		// ---- Confidence floor ----
		{"below confidence floor blocks retry",
			with(func(i *Input) { i.Confidence = 0.39 }),
			domain.PolicyBlock, reasonConfidence},
		{"below floor still allows notify",
			with(func(i *Input) { i.Confidence = 0.10; i.Action = domain.ActionNotify }),
			domain.PolicyAllow, ""},
		{"below floor still allows no_action",
			with(func(i *Input) { i.Confidence = 0.10; i.Action = domain.ActionNoAction }),
			domain.PolicyAllow, ""},
		{"confidence exactly at floor passes (edge, strict <)",
			with(func(i *Input) { i.Confidence = 0.40; i.ConfidenceFloor = 0.40 }),
			domain.PolicyAllow, ""},
		{"confidence a hair below floor blocks (edge)",
			with(func(i *Input) { i.Confidence = 0.3999; i.ConfidenceFloor = 0.40 }),
			domain.PolicyBlock, reasonConfidence},

		// ---- Amount ceiling ----
		{"amount over ceiling blocks money movement",
			with(func(i *Input) { i.Amount = 5000001; i.AmountCeiling = 5000000 }),
			domain.PolicyBlock, reasonAmountBlock},
		{"amount over ceiling + escalate → HUMAN_REVIEW",
			with(func(i *Input) {
				i.Amount = 5000001
				i.AmountCeiling = 5000000
				i.RootCause = domain.RootChronicFailure
				i.Action = domain.ActionEscalate
			}),
			domain.PolicyHumanReview, reasonAmountReview},
		{"amount over ceiling still allows notify",
			with(func(i *Input) { i.Amount = 5000001; i.AmountCeiling = 5000000; i.Action = domain.ActionNotify }),
			domain.PolicyAllow, ""},
		{"amount exactly at ceiling passes (edge, strict >)",
			with(func(i *Input) { i.Amount = 5000000; i.AmountCeiling = 5000000 }),
			domain.PolicyAllow, ""},
		{"ceiling of 0 means disabled (no block on huge amount)",
			with(func(i *Input) { i.Amount = 999999999; i.AmountCeiling = 0 }),
			domain.PolicyAllow, ""},

		// ---- Cooldown ----
		{"retry inside cooldown window blocked",
			with(func(i *Input) { i.HasPriorRetry = true; i.MinutesSinceLastRetry = 5; i.CooldownMinutes = 30 }),
			domain.PolicyBlock, reasonCooldown},
		{"retry exactly at cooldown passes (edge, strict <)",
			with(func(i *Input) { i.HasPriorRetry = true; i.MinutesSinceLastRetry = 30; i.CooldownMinutes = 30 }),
			domain.PolicyAllow, ""},
		{"no prior retry → cooldown does not apply",
			with(func(i *Input) { i.HasPriorRetry = false; i.MinutesSinceLastRetry = 0; i.CooldownMinutes = 30 }),
			domain.PolicyAllow, ""},
		{"cooldown does not apply to non-retry action",
			with(func(i *Input) {
				i.Action = domain.ActionAltMethod
				i.HasPriorRetry = true
				i.MinutesSinceLastRetry = 1
				i.CooldownMinutes = 30
			}),
			domain.PolicyAllow, ""},

		// ---- Max retries ----
		{"max retries: attempts equal to cap is blocked (edge)",
			with(func(i *Input) { i.EffectiveAttempts = 3; i.MaxRetries = 3 }),
			domain.PolicyBlock, reasonMaxRetries},
		{"max retries: one below cap allowed (edge)",
			with(func(i *Input) { i.EffectiveAttempts = 2; i.MaxRetries = 3 }),
			domain.PolicyAllow, ""},
		{"max retries does not apply to non-retry action",
			with(func(i *Input) { i.Action = domain.ActionAltMethod; i.EffectiveAttempts = 99; i.MaxRetries = 3 }),
			domain.PolicyAllow, ""},

		// ---- Daily action cap ----
		{"daily cap: actions equal to cap blocked (edge)",
			with(func(i *Input) { i.Action = domain.ActionAltMethod; i.CustomerActionsToday = 20; i.DailyActionCap = 20 }),
			domain.PolicyBlock, reasonDailyActionCap},
		{"daily cap: one below cap allowed (edge)",
			with(func(i *Input) { i.Action = domain.ActionAltMethod; i.CustomerActionsToday = 19; i.DailyActionCap = 20 }),
			domain.PolicyAllow, ""},
		{"daily cap of 0 means disabled",
			with(func(i *Input) { i.Action = domain.ActionAltMethod; i.CustomerActionsToday = 999; i.DailyActionCap = 0 }),
			domain.PolicyAllow, ""},
		{"daily cap never blocks no_action",
			with(func(i *Input) { i.Action = domain.ActionNoAction; i.CustomerActionsToday = 999; i.DailyActionCap = 20 }),
			domain.PolicyAllow, ""},

		// ---- Min ERV ----
		{"min ERV: exactly at threshold blocked (strict exceed, edge)",
			with(func(i *Input) { i.Action = domain.ActionAltMethod; i.ERV = 500; i.MinERVThreshold = 500 }),
			domain.PolicyBlock, reasonMinERV},
		{"min ERV: just above threshold allowed (edge)",
			with(func(i *Input) { i.Action = domain.ActionAltMethod; i.ERV = 500.0001; i.MinERVThreshold = 500 }),
			domain.PolicyAllow, ""},
		{"min ERV never blocks no_action",
			with(func(i *Input) { i.Action = domain.ActionNoAction; i.ERV = -999; i.MinERVThreshold = 500 }),
			domain.PolicyAllow, ""},

		// ---- Precedence (safety-first order) ----
		{"precedence: kill switch beats fraud",
			with(func(i *Input) {
				i.GlobalKillSwitch = true
				i.RootCause = domain.RootFraudSuspected
				i.Action = domain.ActionEscalate
			}),
			domain.PolicyBlock, reasonKillSwitch},
		{"precedence: fraud beats confidence floor",
			with(func(i *Input) { i.RootCause = domain.RootFraudSuspected; i.Confidence = 0.10 }),
			domain.PolicyBlock, reasonFraudBlock},
		{"precedence: confidence floor beats amount ceiling",
			with(func(i *Input) { i.Confidence = 0.10; i.Amount = 999999999; i.AmountCeiling = 5000000 }),
			domain.PolicyBlock, reasonConfidence},
		{"precedence: amount ceiling beats cooldown",
			with(func(i *Input) {
				i.Amount = 5000001
				i.AmountCeiling = 5000000
				i.HasPriorRetry = true
				i.MinutesSinceLastRetry = 1
			}),
			domain.PolicyBlock, reasonAmountBlock},
		{"precedence: cooldown beats max retries",
			with(func(i *Input) {
				i.HasPriorRetry = true
				i.MinutesSinceLastRetry = 1
				i.EffectiveAttempts = 3
				i.MaxRetries = 3
			}),
			domain.PolicyBlock, reasonCooldown},
		{"precedence: max retries beats daily cap",
			with(func(i *Input) {
				i.EffectiveAttempts = 3
				i.MaxRetries = 3
				i.CustomerActionsToday = 20
				i.DailyActionCap = 20
			}),
			domain.PolicyBlock, reasonMaxRetries},
		{"precedence: daily cap beats min ERV",
			with(func(i *Input) {
				i.Action = domain.ActionAltMethod
				i.CustomerActionsToday = 20
				i.DailyActionCap = 20
				i.ERV = 0
			}),
			domain.PolicyBlock, reasonDailyActionCap},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Evaluate(tt.in)
			if got.Decision != tt.wantResult {
				t.Errorf("decision = %q, want %q (checks: %+v)", got.Decision, tt.wantResult, got.Checks)
			}
			if got.Reason != tt.wantReason {
				t.Errorf("reason = %q, want %q", got.Reason, tt.wantReason)
			}
			if got.PolicyVersion != Version {
				t.Errorf("policy version = %q, want %q", got.PolicyVersion, Version)
			}
			assertCheckShape(t, got)
		})
	}
}

// assertCheckShape enforces the audit invariant: an ALLOW has every check passed; a BLOCK or a
// HUMAN_REVIEW records exactly one failed check (the gate that fired).
func assertCheckShape(t *testing.T, r Result) {
	t.Helper()
	if len(r.Checks) == 0 {
		t.Fatal("expected at least one recorded check")
	}
	failed := 0
	for _, c := range r.Checks {
		if !c.Passed {
			failed++
		}
	}
	switch r.Decision {
	case domain.PolicyAllow:
		if failed != 0 {
			t.Errorf("ALLOW must have all checks passed, got %d failed (%+v)", failed, r.Checks)
		}
	case domain.PolicyBlock, domain.PolicyHumanReview:
		if failed != 1 {
			t.Errorf("%s must record exactly 1 failed check, got %d (%+v)", r.Decision, failed, r.Checks)
		}
	}
}

// TestVersionIsV2 pins the Phase-5 policy version so a decision's policy_version is stable and a
// change is deliberate.
func TestVersionIsV2(t *testing.T) {
	if Version != "policy-v2" {
		t.Fatalf("policy Version = %q, want policy-v2", Version)
	}
}
