// Package policy is the Phase 2 deterministic policy/safety engine — a pure function,
// versioned, with zero ML inside (PLAN.md §6). It is the ONLY layer that may authorize or
// forbid a candidate: economics ranks, safety constrains.
//
// Phase 2 is deliberately the *minimal* engine: only the three constraints PLAN.md §15
// names for the vertical slice — kill switch, max retries, and minimum ERV — returning
// ALLOW or BLOCK. The full constraint set (cooldown, daily cap, amount ceiling, confidence
// floor, fraud hard-stop, HUMAN_REVIEW verdicts, per-merchant override resolution) is
// Phase 5, which grows this same pure function; the struct fields and result type are
// shaped so that growth is additive.
//
// No I/O, no network, no LLM — trivially unit-testable and fully auditable. The per-check
// results are returned so the decision's policy_checks_json is a complete audit trail.
package policy

import (
	"fmt"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/domain"
)

// Version identifies the policy ruleset that produced a verdict. Written to
// decisions.policy_version so a decision is reproducible (PLAN.md §11). Phase 5 bumps it.
const Version = "policy-v1"

// Input is the full context for evaluating one candidate. In Phase 2 only MaxRetries,
// MinERVThreshold, and KillSwitch are consulted; the remaining merchant fields are absent
// here by design (added in Phase 5) rather than accepted-and-ignored.
type Input struct {
	Action domain.Action
	ERV    float64

	// EffectiveAttempts is the payment's charge-attempt count already made — the provider's
	// reported prior_attempts plus retry/delayed_retry actions this system has already
	// dispatched (derived from Postgres timestamps, never Redis — PLAN.md §15). Only
	// consulted for retry-type actions.
	EffectiveAttempts int

	// Merchant policy (already resolved; Phase 5 adds platform-ceiling bounding).
	MaxRetries      int
	MinERVThreshold float64 // minor units; an intervention's ERV must strictly exceed this
	KillSwitch      bool
}

// Check is one constraint's outcome, recorded whether it passed or failed so the decision
// carries a complete, auditable policy trace.
type Check struct {
	Name   string `json:"name"`
	Passed bool   `json:"passed"`
	Detail string `json:"detail,omitempty"`
}

// Result is the verdict for one candidate plus the per-constraint checks that produced it.
type Result struct {
	Decision      domain.PolicyResult // ALLOW or BLOCK (Phase 2 emits no HUMAN_REVIEW)
	Reason        string              // machine-readable block reason; empty when ALLOW
	Checks        []Check
	PolicyVersion string
}

// Evaluate applies the Phase-2 minimal constraint set to one candidate.
//
// Order matters and is safety-first: the kill switch (an operator halt) is checked before
// anything else, then max-retries (a hard per-payment budget), then the economic floor.
// no_action is always permitted — it is the safe fallback the pipeline falls back to when
// every intervention is blocked, so nothing here can block it.
func Evaluate(in Input) Result {
	checks := make([]Check, 0, 3)

	// 1. Kill switch: a global/merchant halt forcing no_action (PLAN.md §6). It blocks every
	//    action except no_action itself.
	if in.KillSwitch && in.Action != domain.ActionNoAction {
		checks = append(checks, Check{Name: "kill_switch", Passed: false, Detail: "kill switch active: only no_action permitted"})
		return block(checks, "kill_switch_active")
	}
	checks = append(checks, Check{Name: "kill_switch", Passed: true})

	// 2. Max retries: retry-type actions are capped per payment (PLAN.md §6). Non-retry
	//    actions (notify, escalate, alt_method, payment_link, no_action) are unaffected.
	if domain.IsRetry(in.Action) && in.EffectiveAttempts >= in.MaxRetries {
		detail := fmt.Sprintf("effective attempts %d >= max_retries %d", in.EffectiveAttempts, in.MaxRetries)
		checks = append(checks, Check{Name: "max_retries", Passed: false, Detail: detail})
		return block(checks, "max_retries_exceeded")
	}
	checks = append(checks, Check{Name: "max_retries", Passed: true})

	// 3. Minimum ERV: an *intervention* must be worth more than the merchant's floor, else
	//    the economically correct choice is to do nothing. no_action is exempt — it is the
	//    floor itself. "Exceed" is strict (PLAN.md §6), so ERV == threshold does not pass.
	if in.Action != domain.ActionNoAction && !(in.ERV > in.MinERVThreshold) {
		detail := fmt.Sprintf("ERV %.4f does not exceed min_erv_threshold %.4f", in.ERV, in.MinERVThreshold)
		checks = append(checks, Check{Name: "min_erv", Passed: false, Detail: detail})
		return block(checks, "below_min_erv")
	}
	checks = append(checks, Check{Name: "min_erv", Passed: true})

	return Result{Decision: domain.PolicyAllow, Checks: checks, PolicyVersion: Version}
}

func block(checks []Check, reason string) Result {
	return Result{Decision: domain.PolicyBlock, Reason: reason, Checks: checks, PolicyVersion: Version}
}
