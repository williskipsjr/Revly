// Package domain holds the small set of enumerated types that cross package boundaries in
// the decision engine — actions, root causes, policy verdicts, recovery states, and action
// statuses. Every value mirrors an enum in migrations/001_init.sql and the frozen JSON
// contracts in schemas/*.json exactly.
//
// It is a pure leaf package (no imports) so diagnosis, successmodel, erv, policy, recovery,
// executor, pipeline, and store can share one type-safe vocabulary without inventing a
// different Action/RootCause type in each.
package domain

// Action is a candidate recovery action. Mirrors the action_type enum.
type Action string

const (
	ActionRetry        Action = "retry"
	ActionDelayedRetry Action = "delayed_retry"
	ActionAltMethod    Action = "alt_method"
	ActionPaymentLink  Action = "payment_link"
	ActionNotify       Action = "notify"
	ActionEscalate     Action = "escalate"
	ActionNoAction     Action = "no_action"
)

// IsRetry reports whether the action re-attempts the original charge and therefore counts
// against the max-retries budget (PLAN.md §6). Re-presentment actions (alt_method,
// payment_link) and out-of-band actions (notify, escalate) are not charge re-attempts.
func IsRetry(a Action) bool {
	return a == ActionRetry || a == ActionDelayedRetry
}

// RootCause is a diagnosable failure cause. Mirrors the root_cause enum.
type RootCause string

const (
	RootTemporaryBankDecline RootCause = "temporary_bank_decline"
	RootInsufficientFunds    RootCause = "insufficient_funds"
	RootExpiredMethod        RootCause = "expired_method"
	RootCheckoutAbandonment  RootCause = "checkout_abandonment"
	RootChronicFailure       RootCause = "chronic_failure"
	RootFraudSuspected       RootCause = "fraud_suspected"
	RootUnknown              RootCause = "unknown"
)

// PolicyResult is the deterministic policy verdict. Mirrors the policy_check_result enum.
// Phase 2's minimal engine emits only ALLOW and BLOCK; HUMAN_REVIEW is reserved for the
// full engine (Phase 5) and kept here so the type is complete.
type PolicyResult string

const (
	PolicyAllow       PolicyResult = "ALLOW"
	PolicyBlock       PolicyResult = "BLOCK"
	PolicyHumanReview PolicyResult = "HUMAN_REVIEW"
)

// RecoveryState is a node in the recovery state machine (PLAN.md §6a). Mirrors the
// recovery_state enum and lives on the decisions row.
type RecoveryState string

const (
	StateFailed           RecoveryState = "FAILED"
	StateDiagnosed        RecoveryState = "DIAGNOSED"
	StateRecoveryEligible RecoveryState = "RECOVERY_ELIGIBLE"
	StateActionSelected   RecoveryState = "ACTION_SELECTED"
	StateActionPending    RecoveryState = "ACTION_PENDING"
	StateRecovered        RecoveryState = "RECOVERED"
	StateReEvaluate       RecoveryState = "RE_EVALUATE"
	StateStopped          RecoveryState = "STOPPED"
	StateDone             RecoveryState = "DONE"
)

// ActionStatus is the execution status of a dispatched action. Mirrors the action_status
// enum. pending_confirmation exists for ambiguous external outcomes (reconciled, never
// blind-retried) and is wired in Phase 6.
type ActionStatus string

const (
	ActionStatusPending             ActionStatus = "pending"
	ActionStatusPendingConfirmation ActionStatus = "pending_confirmation"
	ActionStatusConfirmed           ActionStatus = "confirmed"
	ActionStatusFailed              ActionStatus = "failed"
)
