// Package api is the Phase 7 public, merchant-scoped HTTP surface (PLAN.md §9/§10): the
// endpoints the operator dashboard consumes to read decisions, drill into a decision's full
// explainability trace, see recovery metrics and the audit chain, override a decision (audited),
// toggle the kill switch (admin), and edit merchant policy config within platform bounds (admin).
//
// Every route is merchant-scoped by the {id} path segment (row-level merchant_id filtering —
// PLAN.md §9: no schema-per-tenant, no full RBAC for the MVP). Reads and the override are gated
// by a merchant API key; the kill switch and policy-config edits are admin-gated. The engine
// never lets these endpoints bypass the deterministic policy layer — override is recorded to the
// audit log and does not mutate the immutable decision; policy-config edits are validated against
// the platform ceilings before they are stored.
package api

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/policy"
)

// ErrNotFound is returned by the Repository when a merchant-scoped entity does not exist (mapped
// to HTTP 404). ErrPolicyBounds marks a policy-config edit that violates a platform ceiling
// (mapped to HTTP 400 with detail).
var (
	ErrNotFound     = errors.New("api: not found")
	ErrPolicyBounds = errors.New("api: policy config violates platform bounds")
)

// DecisionSummary is one row of the live decision feed / per-payment decision list.
type DecisionSummary struct {
	DecisionID     string  `json:"decision_id"`
	PaymentEventID string  `json:"payment_event_id"`
	PaymentID      string  `json:"payment_id"`
	ChosenAction   string  `json:"chosen_action"`
	ERVAtDecision  float64 `json:"erv_at_decision"`
	PolicyResult   string  `json:"policy_check_result"`
	PolicyVersion  string  `json:"policy_version"`
	RecoveryState  string  `json:"recovery_state"`
	DecidedAt      string  `json:"decided_at"`
}

// CandidateScore is one candidate's ERV term breakdown, for the per-decision drill-down.
type CandidateScore struct {
	Action            string  `json:"action"`
	PSuccess          float64 `json:"p_success"`
	RecoverableAmount int64   `json:"recoverable_amount"`
	Cost              float64 `json:"cost"`
	FrictionPenalty   float64 `json:"friction_penalty"`
	ERV               float64 `json:"erv"`
}

// DecisionDetail is the full, reconstructable explainability trace for one decision (PLAN.md §11).
type DecisionDetail struct {
	DecisionSummary
	MerchantID            string           `json:"merchant_id"`
	RootCause             string           `json:"root_cause"`
	Confidence            float64          `json:"confidence"`
	Rationale             string           `json:"rationale"`
	DiagnosisModelVersion string           `json:"diagnosis_model_version"`
	SuccessModelVersion   string           `json:"success_model_version"`
	Candidates            []CandidateScore `json:"candidates"`
	PolicyChecks          json.RawMessage  `json:"policy_checks"`
}

// AuditEntry is one append-only audit_log row.
type AuditEntry struct {
	ID         int64           `json:"id"`
	EntityType string          `json:"entity_type"`
	EntityID   string          `json:"entity_id"`
	Actor      string          `json:"actor"`
	Details    json.RawMessage `json:"details"`
	At         string          `json:"at"`
}

// RecoverySummary is the merchant's aggregate recovery metrics (PLAN.md §10).
type RecoverySummary struct {
	MerchantID       string  `json:"merchant_id"`
	TotalDecisions   int     `json:"total_decisions"`
	TotalActions     int     `json:"total_actions"`
	RecoveredCount   int     `json:"recovered_count"`
	RecoveredAmount  int64   `json:"recovered_amount"`   // paise
	InterventionCost float64 `json:"intervention_cost"`  // minor units, chosen-action cost sum
	NetRecovered     float64 `json:"net_recovered"`      // recovered_amount - intervention_cost
	RecoveryRate     float64 `json:"recovery_rate"`      // recovered_count / total_decisions
	HumanReviewCount int     `json:"human_review_count"` // escalations routed to a human
	NoActionCount    int     `json:"no_action_count"`    // decisions that chose no_action
}

// MerchantPolicyConfig is a merchant's raw policy config (as stored; platform bounds are applied
// at decision time, but edits here are validated against them first).
type MerchantPolicyConfig struct {
	MaxRetries              int      `json:"max_retries"`
	CooldownMinutes         int      `json:"cooldown_minutes"`
	MinERVThreshold         float64  `json:"min_erv_threshold"`
	DailyActionCap          int      `json:"daily_action_cap"`
	AmountCeiling           int64    `json:"amount_ceiling"`
	ConfidenceFloorOverride *float64 `json:"confidence_floor_override,omitempty"`
	KillSwitch              bool     `json:"kill_switch"`
}

// Repository is the durable boundary the API handlers depend on, implemented by internal/store.
type Repository interface {
	MerchantExists(ctx context.Context, merchantID string) (bool, error)
	ListRecentDecisions(ctx context.Context, merchantID string, limit int) ([]DecisionSummary, error)
	ListDecisionsByPayment(ctx context.Context, merchantID, paymentID string) ([]DecisionSummary, error)
	GetDecision(ctx context.Context, merchantID, decisionID string) (DecisionDetail, error)
	RecordOverride(ctx context.Context, merchantID, decisionID, actor, reason, newAction string) error
	SetMerchantKillSwitch(ctx context.Context, merchantID string, on bool, actor string) error
	SetGlobalKillSwitch(ctx context.Context, on bool, actor string) error
	RecoverySummary(ctx context.Context, merchantID string) (RecoverySummary, error)
	AuditByPayment(ctx context.Context, merchantID, paymentID string) ([]AuditEntry, error)
	GetPolicyConfig(ctx context.Context, merchantID string) (MerchantPolicyConfig, error)
	UpdatePolicyConfig(ctx context.Context, merchantID string, cfg MerchantPolicyConfig, actor string) error
	LoadPlatform(ctx context.Context) (policy.Platform, error)
}
