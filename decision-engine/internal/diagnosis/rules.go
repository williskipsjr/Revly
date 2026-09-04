package diagnosis

import (
	"strings"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/domain"
)

// chronicAttemptFloor is the prior-attempt count at or above which a still-failing payment
// is treated as chronic rather than transient — repeated identical failures stop being a
// "temporary" decline. Kept as a small, explicit Phase-2 constant to be revisited when the
// LLM classifier (Phase 4) and the success model (Phase 3) provide richer signal.
const chronicAttemptFloor = 3

// Diagnose maps a failed-payment event to a root cause deterministically.
//
// The rule order encodes specificity: unambiguous signals (an abandoned checkout, an
// explicit "insufficient funds" or "expired card" or fraud string) win over the generic
// "some bank/gateway decline" bucket. A payment that has already failed several times is
// reclassified as chronic — except when the reason is unambiguously fraud, which always
// takes precedence so the safety path (escalate) is never masked by attempt count.
//
// The function never returns an empty CandidateActions list: no_action is always a
// candidate, so the downstream ERV+policy layers always have at least the safe fallback to
// rank and authorize.
func Diagnose(in Input) Diagnosis {
	reason := strings.ToLower(strings.TrimSpace(in.FailureReason))

	// Fraud is a categorical safety signal — matched first and never overridden by attempt
	// count. The economic layers never "outvote" a fraud diagnosis; the policy engine owns
	// the hard stop (Phase 5), diagnosis just surfaces the cause and the conservative set.
	if containsAny(reason, "fraud", "stolen", "blacklist", "risk", "suspicious") {
		return diag(domain.RootFraudSuspected, 0.70,
			"Failure reason indicates suspected fraud/risk; only escalation or no action is safe pending review.",
			domain.ActionEscalate, domain.ActionNoAction)
	}

	// An abandoned checkout is a distinct event type, not a decline: the customer left
	// before paying, so the recovery is to re-present a way to pay, not to retry a charge.
	if in.EventType == "checkout.abandoned" {
		return diag(domain.RootCheckoutAbandonment, 0.80,
			"Checkout was abandoned before payment completed; re-engage the customer with a payment link or reminder.",
			domain.ActionPaymentLink, domain.ActionNotify, domain.ActionNoAction)
	}

	if containsAny(reason, "insufficient", "insufficient_funds", "low balance", "not enough") {
		return diag(domain.RootInsufficientFunds, 0.75,
			"Insufficient funds; a later retry may succeed once the customer has balance, otherwise notify.",
			domain.ActionDelayedRetry, domain.ActionNotify, domain.ActionNoAction)
	}

	if containsAny(reason, "expired", "expiry", "expire") {
		return diag(domain.RootExpiredMethod, 0.80,
			"Payment method appears expired; retrying the same method will keep failing — offer an alternative method or link.",
			domain.ActionAltMethod, domain.ActionPaymentLink, domain.ActionNotify, domain.ActionNoAction)
	}

	// Repeated failures with no more specific cause: stop treating it as transient.
	if in.PriorAttempts >= chronicAttemptFloor {
		return diag(domain.RootChronicFailure, 0.65,
			"Payment has failed repeatedly with no transient cause identified; automated retries are unlikely to help.",
			domain.ActionNotify, domain.ActionEscalate, domain.ActionNoAction)
	}

	// Generic transient decline: issuer/gateway/network hiccup, do-not-honour, timeouts.
	if containsAny(reason,
		"declin", "do not honour", "do not honor", "issuer", "bank", "gateway",
		"timeout", "timed out", "network", "temporar", "try again", "unavailable") {
		return diag(domain.RootTemporaryBankDecline, 0.60,
			"Transient bank/gateway decline; a delayed retry has a reasonable chance of succeeding.",
			domain.ActionDelayedRetry, domain.ActionRetry, domain.ActionNotify, domain.ActionNoAction)
	}

	// No confident signal. Low confidence keeps the conservative set; the confidence gate
	// (Phase 5) will later disallow autonomous retries below its floor.
	return diag(domain.RootUnknown, 0.30,
		"No confident root cause identified from the available signals; stay conservative.",
		domain.ActionNotify, domain.ActionNoAction)
}

// diag builds a Diagnosis with the Phase-2 rule-based provenance filled in.
func diag(cause domain.RootCause, confidence float64, rationale string, actions ...domain.Action) Diagnosis {
	return Diagnosis{
		RootCause:        cause,
		Confidence:       confidence,
		Rationale:        rationale,
		CandidateActions: actions,
		ModelVersion:     ModelVersion,
		Source:           SourceRuleBased,
	}
}

// containsAny reports whether s contains any of the given substrings. s is expected to be
// already lower-cased and trimmed by the caller.
func containsAny(s string, subs ...string) bool {
	for _, sub := range subs {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}
