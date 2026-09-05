// Package policy is the deterministic policy/safety engine — a pure function, versioned,
// with zero ML inside (PLAN.md §6). It is the ONLY layer that may authorize or forbid a
// candidate action: economics (internal/erv) ranks, safety constrains here. The ML/LLM
// planes propose and estimate; they can never bypass or loosen these rules.
//
// Phase 5 grows the Phase-2 minimal engine (kill switch + max retries + min ERV) into the
// full Section-6 constraint set, additively — the struct fields and result type were shaped
// in Phase 2 so this growth added fields without breaking callers. The full ordered rule set:
//
//  1. Global / per-merchant kill switch  → BLOCK all but no_action        (operator halt)
//  2. Fraud hard-stop (fraud_suspected)  → BLOCK autonomous; escalate ⇒ HUMAN_REVIEW
//  3. Confidence floor (conf < floor)    → allow only notify / no_action  (platform safety floor)
//  4. Amount ceiling (amount > ceiling)  → BLOCK money movement; escalate ⇒ HUMAN_REVIEW
//  5. Cooldown (min minutes between retries, retry-type only)             → BLOCK
//  6. Max retries (per-payment budget, retry-type only)                   → BLOCK
//  7. Daily action cap (per customer / 24h, interventions)               → BLOCK
//  8. Min economic value (ERV must exceed the merchant floor)            → BLOCK
//
// Precedence is safety-first: an operator halt outranks a categorical fraud stop, which
// outranks the confidence floor, which outranks the money-movement ceiling, then the
// retry-budget rules, then throughput, then pure economics. The first rule that fires
// decides; every rule records a Check (passed or failed) so decisions.policy_checks_json is
// a complete, replayable audit trail (PLAN.md §11).
//
// no_action is the safe fallback and is never blocked by any rule — it is the disposition the
// pipeline falls back to when every intervention is blocked. HUMAN_REVIEW is emitted only for
// the escalate action under the fraud and amount-ceiling gates ("force/require escalation" —
// PLAN.md §6): the autonomous journey stops and a human takes over.
//
// Merchant overrides are resolved (bounded by platform ceilings) in merchant_override.go and
// fed in already-resolved; confidence floor and cooldown values here are the resolved values.
// No I/O, no network, no LLM — trivially unit-testable and fully auditable. Cooldown and
// daily-cap facts are Postgres-derived and passed in (PLAN.md §15: no Redis in this path).
package policy

import (
	"fmt"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/domain"
)

// Version identifies the policy ruleset that produced a verdict. Written to
// decisions.policy_version so a decision is reproducible (PLAN.md §11). Phase 5 → policy-v2.
const Version = "policy-v2"

// Input is the full context for evaluating one candidate. Every field is a pre-computed,
// deterministic value: merchant config is already resolved against platform ceilings
// (merchant_override.go), and cooldown / daily-cap facts are Postgres-derived (never Redis).
// Keeping I/O out means Evaluate is a pure function of Input.
type Input struct {
	Action domain.Action
	ERV    float64

	// EffectiveAttempts is the payment's charge-attempt count already made — the provider's
	// reported prior_attempts plus retry/delayed_retry actions this system has already
	// dispatched (derived from Postgres, never Redis). Only consulted for retry-type actions.
	EffectiveAttempts int

	// RootCause is the diagnosed cause. fraud_suspected triggers the categorical hard stop
	// (PLAN.md §6). The diagnosis plane surfaces the cause; this engine owns the hard stop.
	RootCause domain.RootCause

	// Confidence is the diagnosis confidence — a GATE, never the ERV P(success) (PLAN.md §5/§7).
	// Below ConfidenceFloor, autonomous recovery is disallowed (only notify / no_action pass).
	Confidence      float64
	ConfidenceFloor float64 // resolved platform floor (>= PlatformConfidenceFloor); merchant may raise, never lower

	// Amount is the recoverable amount (paise); AmountCeiling is the merchant's resolved
	// ceiling. AmountCeiling <= 0 means "no ceiling configured" (the rule is disabled).
	Amount        int64
	AmountCeiling int64

	// Cooldown between retries (PLAN.md §6). MinutesSinceLastRetry is Postgres-derived from the
	// most recent retry/delayed_retry action's executed_at and is meaningful only when
	// HasPriorRetry is true. Only consulted for retry-type actions.
	CooldownMinutes       int
	HasPriorRetry         bool
	MinutesSinceLastRetry float64

	// MaxRetries is the resolved per-payment retry budget (bounded by the platform ceiling).
	MaxRetries int

	// DailyActionCap is the resolved per-customer/24h cap; CustomerActionsToday is the
	// Postgres-derived count of interventions already dispatched for this customer in the
	// window. DailyActionCap <= 0 means "no cap configured" (the rule is disabled).
	DailyActionCap       int
	CustomerActionsToday int

	// MinERVThreshold: an intervention's ERV must strictly exceed this (minor units).
	MinERVThreshold float64

	// KillSwitch is the per-merchant operator halt; GlobalKillSwitch is the platform-wide one
	// (platform_policy singleton). Either forces no_action (PLAN.md §6). Operator/admin only.
	KillSwitch       bool
	GlobalKillSwitch bool
}

// Check is one constraint's outcome, recorded whether it passed or failed so the decision
// carries a complete, auditable policy trace. A failed check on a HUMAN_REVIEW result marks
// the gate that routed the candidate to a human (not a hard block).
type Check struct {
	Name   string `json:"name"`
	Passed bool   `json:"passed"`
	Detail string `json:"detail,omitempty"`
}

// Result is the verdict for one candidate plus the per-constraint checks that produced it.
type Result struct {
	Decision      domain.PolicyResult // ALLOW, BLOCK, or HUMAN_REVIEW
	Reason        string              // machine-readable reason; empty when ALLOW
	Checks        []Check
	PolicyVersion string
}

// Check names and machine-readable reasons — stable identifiers surfaced in the audit JSON
// and (via the pipeline) the dashboard, so they are defined once rather than as loose strings.
const (
	checkKillSwitch     = "kill_switch"
	checkFraudHardStop  = "fraud_hard_stop"
	checkConfidence     = "confidence_floor"
	checkAmountCeiling  = "amount_ceiling"
	checkCooldown       = "cooldown"
	checkMaxRetries     = "max_retries"
	checkDailyActionCap = "daily_action_cap"
	checkMinERV         = "min_erv"

	reasonKillSwitch     = "kill_switch_active"
	reasonFraudBlock     = "fraud_hard_stop"
	reasonFraudReview    = "fraud_requires_human_review"
	reasonConfidence     = "below_confidence_floor"
	reasonAmountBlock    = "amount_ceiling_exceeded"
	reasonAmountReview   = "amount_ceiling_requires_human_review"
	reasonCooldown       = "cooldown_active"
	reasonMaxRetries     = "max_retries_exceeded"
	reasonDailyActionCap = "daily_cap_reached"
	reasonMinERV         = "below_min_erv"
)

// Evaluate applies the full Section-6 constraint set to one candidate, in safety-first order.
//
// The first rule that fires decides. no_action is exempt from every constraint — it flows
// through all checks as passing and always ALLOWs, so the pipeline always has a policy-passing
// fallback. escalate under the fraud or amount-ceiling gate yields HUMAN_REVIEW ("force/require
// escalation"); every other blocked action yields BLOCK. Each rule appends exactly one Check,
// so an ALLOW has all checks passed and a BLOCK has exactly one failed check (the one that fired).
func Evaluate(in Input) Result {
	checks := make([]Check, 0, 8)

	// 1. Kill switch: a global or per-merchant operator halt forcing no_action (PLAN.md §6).
	//    It is absolute — it outranks every other rule and blocks every action but no_action.
	if (in.GlobalKillSwitch || in.KillSwitch) && in.Action != domain.ActionNoAction {
		scope := "merchant"
		if in.GlobalKillSwitch {
			scope = "global"
		}
		checks = append(checks, failed(checkKillSwitch, fmt.Sprintf("%s kill switch active: only no_action permitted", scope)))
		return block(checks, reasonKillSwitch)
	}
	checks = append(checks, passed(checkKillSwitch))

	// 2. Fraud hard-stop: a fraud_suspected diagnosis categorically blocks autonomous recovery
	//    and forces escalation (PLAN.md §6) — NOT merchant-overridable. escalate → HUMAN_REVIEW
	//    (a human takes over); every other intervention → BLOCK; no_action stays safe.
	if in.RootCause == domain.RootFraudSuspected && in.Action != domain.ActionNoAction {
		if in.Action == domain.ActionEscalate {
			checks = append(checks, failed(checkFraudHardStop, "fraud suspected: escalate to a human for review"))
			return humanReview(checks, reasonFraudReview)
		}
		checks = append(checks, failed(checkFraudHardStop, "fraud suspected: autonomous recovery blocked, escalation required"))
		return block(checks, reasonFraudBlock)
	}
	checks = append(checks, passed(checkFraudHardStop))

	// 3. Confidence floor: below the floor, only notify / no_action are permitted — no
	//    autonomous retry, re-presentment, or escalate (PLAN.md §6). A platform safety floor:
	//    a merchant may RAISE it (resolved upstream) but never lower it below the platform value.
	if in.Confidence < in.ConfidenceFloor && in.Action != domain.ActionNotify && in.Action != domain.ActionNoAction {
		detail := fmt.Sprintf("confidence %.3f < floor %.3f: only notify/no_action permitted", in.Confidence, in.ConfidenceFloor)
		checks = append(checks, failed(checkConfidence, detail))
		return block(checks, reasonConfidence)
	}
	checks = append(checks, passed(checkConfidence))

	// 4. Amount ceiling: above the merchant's ceiling, no autonomous money movement — retry,
	//    delayed_retry, alt_method, payment_link are blocked; escalation is required for a human
	//    to handle the large payment (PLAN.md §6). notify (a harmless nudge) and no_action stay
	//    allowed; escalate → HUMAN_REVIEW. A ceiling of 0 means "unconfigured" (rule disabled).
	if in.AmountCeiling > 0 && in.Amount > in.AmountCeiling {
		if in.Action == domain.ActionEscalate {
			checks = append(checks, failed(checkAmountCeiling, fmt.Sprintf("amount %d > ceiling %d: escalate to a human", in.Amount, in.AmountCeiling)))
			return humanReview(checks, reasonAmountReview)
		}
		if in.Action != domain.ActionNoAction && in.Action != domain.ActionNotify {
			detail := fmt.Sprintf("amount %d > ceiling %d: automated money movement not permitted", in.Amount, in.AmountCeiling)
			checks = append(checks, failed(checkAmountCeiling, detail))
			return block(checks, reasonAmountBlock)
		}
	}
	checks = append(checks, passed(checkAmountCeiling))

	// 5. Cooldown: at least CooldownMinutes must elapse between retry-type actions (PLAN.md §6).
	//    Postgres-derived (MinutesSinceLastRetry from the last retry's executed_at); only a
	//    retry/delayed_retry with a prior retry inside the window is blocked.
	if domain.IsRetry(in.Action) && in.HasPriorRetry && in.MinutesSinceLastRetry < float64(in.CooldownMinutes) {
		detail := fmt.Sprintf("last retry %.1f min ago < cooldown %d min", in.MinutesSinceLastRetry, in.CooldownMinutes)
		checks = append(checks, failed(checkCooldown, detail))
		return block(checks, reasonCooldown)
	}
	checks = append(checks, passed(checkCooldown))

	// 6. Max retries: retry-type actions are capped per payment (PLAN.md §6). Non-retry actions
	//    are unaffected. The cap is the resolved value (bounded by the platform ceiling).
	if domain.IsRetry(in.Action) && in.EffectiveAttempts >= in.MaxRetries {
		detail := fmt.Sprintf("effective attempts %d >= max_retries %d", in.EffectiveAttempts, in.MaxRetries)
		checks = append(checks, failed(checkMaxRetries, detail))
		return block(checks, reasonMaxRetries)
	}
	checks = append(checks, passed(checkMaxRetries))

	// 7. Daily action cap: at most N interventions per customer per 24h (PLAN.md §6).
	//    Postgres-derived count; no_action is exempt. A cap of 0 means "unconfigured" (disabled).
	if in.Action != domain.ActionNoAction && in.DailyActionCap > 0 && in.CustomerActionsToday >= in.DailyActionCap {
		detail := fmt.Sprintf("customer actions today %d >= daily_action_cap %d", in.CustomerActionsToday, in.DailyActionCap)
		checks = append(checks, failed(checkDailyActionCap, detail))
		return block(checks, reasonDailyActionCap)
	}
	checks = append(checks, passed(checkDailyActionCap))

	// 8. Minimum ERV: an intervention must be worth more than the merchant's floor, else the
	//    economically correct choice is to do nothing. no_action is exempt. "Exceed" is strict
	//    (PLAN.md §6), so ERV == threshold does not pass.
	if in.Action != domain.ActionNoAction && !(in.ERV > in.MinERVThreshold) {
		detail := fmt.Sprintf("ERV %.4f does not exceed min_erv_threshold %.4f", in.ERV, in.MinERVThreshold)
		checks = append(checks, failed(checkMinERV, detail))
		return block(checks, reasonMinERV)
	}
	checks = append(checks, passed(checkMinERV))

	return Result{Decision: domain.PolicyAllow, Checks: checks, PolicyVersion: Version}
}

func passed(name string) Check { return Check{Name: name, Passed: true} }

func failed(name, detail string) Check { return Check{Name: name, Passed: false, Detail: detail} }

func block(checks []Check, reason string) Result {
	return Result{Decision: domain.PolicyBlock, Reason: reason, Checks: checks, PolicyVersion: Version}
}

func humanReview(checks []Check, reason string) Result {
	return Result{Decision: domain.PolicyHumanReview, Reason: reason, Checks: checks, PolicyVersion: Version}
}
