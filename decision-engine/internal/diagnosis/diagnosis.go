// Package diagnosis is the Phase 2 root-cause layer: a deterministic, rule-based table
// that maps a failed-payment event to a root cause, a confidence gate, a human-readable
// rationale, and a ranked list of candidate recovery actions.
//
// It is deliberately the simplest *real* implementation (PLAN.md §15, Phase 2): no LLM
// yet. Phase 4 replaces Diagnose with an LLM-backed classifier that falls back to exactly
// this table on timeout/schema failure — so the output shape mirrors
// schemas/diagnosis.schema.json precisely.
//
// Two invariants from PLAN.md §5/§7 are enforced by construction here:
//   - confidence is a GATING signal only; nothing in this package ever computes or exposes
//     the P(success) probability used in ERV. That lives in a separate code path
//     (internal/successmodel).
//   - the package has no database, network, or LLM dependency — it is a pure function of
//     its input, and therefore trivially unit-testable.
package diagnosis

// RootCause enumerates the diagnosable failure causes. The set mirrors the frozen contract
// (schemas/diagnosis.schema.json) and the root_cause enum in migrations/001_init.sql.
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

// Action enumerates candidate recovery actions. Mirrors the action_type enum in the schema
// and migration. Defined here (rather than imported) to keep this package dependency-free.
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

// Source records whether a diagnosis came from the LLM or the rule-based path. In Phase 2
// there is no LLM, so every diagnosis is rule-based. The value mirrors the schema's source
// enum; note the diagnoses table (§8) has no source column, so it is not persisted — it is
// carried for API/response fidelity and for the Phase 4 fallback banner.
type Source string

const (
	SourceLLM       Source = "llm"
	SourceRuleBased Source = "rule_based_fallback"
)

// ModelVersion identifies this rule table. It is written to diagnoses.model_version so any
// decision is fully reconstructable (PLAN.md §11) — a later table bumps this string.
const ModelVersion = "rules-v1"

// Input is the minimal slice of a payment event the rule table reasons over. It is a
// deliberately small, self-contained struct (no import of internal/ingest) so the package
// stays a pure leaf. The pipeline maps a loaded payment_events row onto this.
type Input struct {
	EventType     string // payment_event_type, e.g. "payment.failed", "checkout.abandoned"
	FailureReason string // provider failure_reason free text; may be empty
	Method        string // payment_method, e.g. "card", "upi"
	PriorAttempts int    // provider-reported prior attempts on this payment
}

// Diagnosis is the structured output of the rule table. It mirrors the required fields of
// schemas/diagnosis.schema.json. CandidateActions is non-empty and ranked by rule
// preference (most-preferred first); the ERV layer re-ranks by economic value, so this
// order is only a hint, never an authorization.
type Diagnosis struct {
	RootCause        RootCause
	Confidence       float64 // 0..1, GATE ONLY — never the ERV probability
	Rationale        string
	CandidateActions []Action
	ModelVersion     string
	Source           Source
}
