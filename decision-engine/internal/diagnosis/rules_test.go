package diagnosis

import (
	"testing"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/domain"
)

// TestDiagnose_RuleTable exercises every branch of the rule table, including the
// specificity ordering (fraud beats attempt count; specific reasons beat the generic
// decline bucket; abandonment is matched by event type, not reason text).
func TestDiagnose_RuleTable(t *testing.T) {
	tests := []struct {
		name      string
		in        Input
		wantCause domain.RootCause
		wantFirst domain.Action // most-preferred candidate
	}{
		{
			name:      "fraud reason wins over everything",
			in:        Input{EventType: "payment.failed", FailureReason: "Suspected fraud on card", PriorAttempts: 9},
			wantCause: domain.RootFraudSuspected,
			wantFirst: domain.ActionEscalate,
		},
		{
			name:      "checkout abandonment by event type",
			in:        Input{EventType: "checkout.abandoned", FailureReason: ""},
			wantCause: domain.RootCheckoutAbandonment,
			wantFirst: domain.ActionPaymentLink,
		},
		{
			name:      "insufficient funds",
			in:        Input{EventType: "payment.failed", FailureReason: "Insufficient funds in account"},
			wantCause: domain.RootInsufficientFunds,
			wantFirst: domain.ActionDelayedRetry,
		},
		{
			name:      "expired method",
			in:        Input{EventType: "payment.failed", FailureReason: "Card expired"},
			wantCause: domain.RootExpiredMethod,
			wantFirst: domain.ActionAltMethod,
		},
		{
			name:      "chronic after repeated attempts",
			in:        Input{EventType: "payment.failed", FailureReason: "declined", PriorAttempts: 3},
			wantCause: domain.RootChronicFailure,
			wantFirst: domain.ActionNotify,
		},
		{
			name:      "transient bank decline",
			in:        Input{EventType: "payment.failed", FailureReason: "Issuer declined, please try again", PriorAttempts: 0},
			wantCause: domain.RootTemporaryBankDecline,
			wantFirst: domain.ActionDelayedRetry,
		},
		{
			name:      "gateway timeout is transient",
			in:        Input{EventType: "subscription.charge_failed", FailureReason: "Gateway timeout", PriorAttempts: 1},
			wantCause: domain.RootTemporaryBankDecline,
			wantFirst: domain.ActionDelayedRetry,
		},
		{
			name:      "unknown when no signal",
			in:        Input{EventType: "payment.failed", FailureReason: "", PriorAttempts: 0},
			wantCause: domain.RootUnknown,
			wantFirst: domain.ActionNotify,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Diagnose(tt.in)
			if got.RootCause != tt.wantCause {
				t.Errorf("root cause = %q, want %q", got.RootCause, tt.wantCause)
			}
			if len(got.CandidateActions) == 0 {
				t.Fatal("candidate actions must never be empty")
			}
			if got.CandidateActions[0] != tt.wantFirst {
				t.Errorf("first candidate = %q, want %q", got.CandidateActions[0], tt.wantFirst)
			}
		})
	}
}

// TestDiagnose_Invariants asserts the structural guarantees every diagnosis must hold,
// independent of which rule fired.
func TestDiagnose_Invariants(t *testing.T) {
	inputs := []Input{
		{EventType: "payment.failed", FailureReason: "fraud"},
		{EventType: "checkout.abandoned"},
		{EventType: "payment.failed", FailureReason: "insufficient funds"},
		{EventType: "payment.failed", FailureReason: "card expired"},
		{EventType: "payment.failed", FailureReason: "declined", PriorAttempts: 5},
		{EventType: "payment.failed", FailureReason: "issuer declined"},
		{EventType: "payment.failed"},
	}
	for _, in := range inputs {
		d := Diagnose(in)

		if d.Confidence < 0 || d.Confidence > 1 {
			t.Errorf("confidence out of [0,1]: %v (input %+v)", d.Confidence, in)
		}
		if d.Rationale == "" {
			t.Errorf("rationale must be non-empty (input %+v)", in)
		}
		if d.ModelVersion != ModelVersion {
			t.Errorf("model version = %q, want %q", d.ModelVersion, ModelVersion)
		}
		if d.Source != SourceRuleBased {
			t.Errorf("Phase 2 diagnosis source = %q, want %q", d.Source, SourceRuleBased)
		}
		// no_action must always be an available candidate — the safe fallback the
		// downstream layers can always fall back to.
		if !hasAction(d.CandidateActions, domain.ActionNoAction) {
			t.Errorf("no_action must always be a candidate; got %v (input %+v)", d.CandidateActions, in)
		}
		// candidate list must not contain duplicates.
		seen := map[domain.Action]bool{}
		for _, a := range d.CandidateActions {
			if seen[a] {
				t.Errorf("duplicate candidate %q (input %+v)", a, in)
			}
			seen[a] = true
		}
	}
}

func hasAction(as []domain.Action, want domain.Action) bool {
	for _, a := range as {
		if a == want {
			return true
		}
	}
	return false
}
