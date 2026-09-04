// Package pipeline orchestrates the Phase 2 end-to-end recovery slice for a single ingested
// failed-payment event (PLAN.md §15): diagnose → estimate P(success) → rank by ERV → apply
// policy → drive the recovery state machine → dispatch idempotently (mocked) → capture the
// outcome, all persisted to Postgres.
//
// It is the composition root for the decision plane: it wires the pure stages
// (internal/diagnosis, successmodel, erv, policy, recovery, executor) together and hands the
// fully-computed result to a Repository for durable, transactional, idempotent persistence.
// The Repository interface is defined here and implemented by internal/store — the pipeline
// itself never touches SQL, so its orchestration logic is unit-testable with a fake repo.
//
// Postgres is the only durable store involved (PLAN.md §15: this slice has no Redis
// dependency); the max-retries budget is derived from attempt counts already in Postgres.
package pipeline

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/diagnosis"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/domain"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/erv"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/executor"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/policy"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/recovery"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/successmodel"
)

// ActionCost is a merchant's configured cost/friction for one action (from
// merchant_action_costs). A zero value (missing config row) means cost 0, friction 0.
type ActionCost struct {
	MonetaryCost   float64
	FrictionWeight float64
}

// MerchantPolicy is the resolved policy configuration for a merchant. Phase 2 consults only
// MaxRetries, MinERVThreshold, and KillSwitch; the other fields are loaded for completeness
// and for the Phase 5 full engine.
type MerchantPolicy struct {
	MaxRetries              int
	CooldownMinutes         int
	MinERVThreshold         float64
	DailyActionCap          int
	AmountCeiling           int64
	ConfidenceFloorOverride *float64
	KillSwitch              bool
}

// Context is everything the pipeline needs to decide, loaded from Postgres for one
// payment_event by Repository.LoadContext.
type Context struct {
	PaymentEventID string
	PaymentID      string
	MerchantID     string
	Amount         int64 // recoverable amount, paise
	Method         string
	EventType      string
	FailureReason  string
	PriorAttempts  int // provider-reported

	// RetryActionsTaken is the count of retry/delayed_retry actions this system has already
	// dispatched for this payment (Postgres-derived). Added to PriorAttempts it gives the
	// effective attempt count the max-retries constraint checks against — no Redis involved.
	RetryActionsTaken int

	Policy      MerchantPolicy
	ActionCosts map[domain.Action]ActionCost
}

// CandidateRecord is one candidate's full ERV breakdown plus its policy verdict — persisted
// per-candidate (erv_scores + success_model_scores) and summarized into the decision's audit
// JSON so the whole ranking is reconstructable (PLAN.md §10/§11).
type CandidateRecord struct {
	Action            domain.Action
	PSuccess          float64
	RecoverableAmount int64
	Cost              float64
	FrictionPenalty   float64
	ERV               float64
	PolicyResult      domain.PolicyResult
}

// DecisionRecord is the fully-computed decision handed to the store for transactional
// persistence (diagnoses + success_model_scores + erv_scores + decisions + audit_log).
type DecisionRecord struct {
	PaymentEventID string
	MerchantID     string

	RootCause             domain.RootCause
	Confidence            float64
	Rationale             string
	DiagnosisModelVersion string
	SuccessModelVersion   string

	Candidates []CandidateRecord

	ChosenAction      domain.Action
	ERVAtDecision     float64
	PolicyVersion     string
	PolicyCheckResult domain.PolicyResult
	PolicyChecksJSON  json.RawMessage

	RecoveryState domain.RecoveryState   // state to stamp on the decisions row at persist time
	StateHistory  []domain.RecoveryState // full visited path so far, for the audit trail
}

// ExecutionRecord is the fully-computed execution result handed to the store for idempotent
// persistence (actions + outcomes + decisions.recovery_state update + audit_log).
type ExecutionRecord struct {
	DecisionID string
	MerchantID string
	PaymentID  string

	Action                 domain.Action
	IdempotencyKey         string
	ExternalIdempotencyKey string
	ActionStatus           domain.ActionStatus

	OutcomeResult   string
	Recovered       bool
	RecoveredAmount *int64 // nil unless Recovered

	FinalState   domain.RecoveryState
	StateHistory []domain.RecoveryState
}

// Repository is the durable persistence boundary the pipeline depends on. internal/store
// implements it against PostgreSQL; the idempotency guarantee lives in FinalizeExecution's
// unique-key insert, not in the pipeline.
type Repository interface {
	// LoadContext assembles the decision context for one payment_event.
	LoadContext(ctx context.Context, paymentEventID string) (Context, error)
	// PersistDecision transactionally writes the diagnosis, per-candidate scores, the
	// decision row (at rec.RecoveryState), and an audit entry; it returns the new decision id.
	PersistDecision(ctx context.Context, rec DecisionRecord) (decisionID string, err error)
	// FinalizeExecution idempotently inserts the action (unique idempotency_key), and on a
	// first insert writes the outcome, advances decisions.recovery_state to rec.FinalState,
	// and appends an audit entry. created reports whether this call inserted the action (true)
	// or found an existing one (false) — the "no duplicate financial action" guarantee.
	FinalizeExecution(ctx context.Context, rec ExecutionRecord) (created bool, err error)
}

// Runner executes the recovery pipeline. It satisfies ingest.Processor via Process.
type Runner struct {
	repo       Repository
	dispatcher executor.Dispatcher
	scorer     successmodel.Scorer
	logger     *slog.Logger
}

// NewRunner builds a Runner. A nil dispatcher defaults to the Phase 2 MockDispatcher; a nil
// scorer defaults to the Phase-2 heuristic (the graceful fallback when no trained model is
// loaded); a nil logger defaults to slog.Default().
func NewRunner(repo Repository, dispatcher executor.Dispatcher, scorer successmodel.Scorer, logger *slog.Logger) *Runner {
	if dispatcher == nil {
		dispatcher = executor.MockDispatcher{}
	}
	if scorer == nil {
		scorer = successmodel.HeuristicScorer{}
	}
	if logger == nil {
		logger = slog.Default()
	}
	return &Runner{repo: repo, dispatcher: dispatcher, scorer: scorer, logger: logger}
}

// Process runs the full recovery slice for one ingested payment_event. It is safe to invoke
// once per newly-created event; the executor's unique idempotency key makes a re-invocation
// for the same decision a no-op rather than a duplicate action.
func (r *Runner) Process(ctx context.Context, paymentEventID string) error {
	c, err := r.repo.LoadContext(ctx, paymentEventID)
	if err != nil {
		return fmt.Errorf("pipeline: load context for %s: %w", paymentEventID, err)
	}
	log := r.logger.With(
		"payment_event_id", paymentEventID,
		"merchant_id", c.MerchantID,
		"payment_id", c.PaymentID,
	)

	m := recovery.NewMachine() // FAILED

	// 1. Diagnose (rule-based; confidence is a gate, never P(success)).
	diag := diagnosis.Diagnose(diagnosis.Input{
		EventType:     c.EventType,
		FailureReason: c.FailureReason,
		Method:        c.Method,
		PriorAttempts: c.PriorAttempts,
	})
	m.MustTo(domain.StateDiagnosed)

	effectiveAttempts := c.PriorAttempts + c.RetryActionsTaken

	// 2. Estimate P(success) per candidate and compute ERV. Guarantee no_action is always a
	//    candidate so there is always a policy-passing fallback to select.
	actions := ensureNoAction(diag.CandidateActions)
	feats := successmodel.Features{Method: c.Method, PriorAttempts: effectiveAttempts, Amount: c.Amount}
	ervInputs := make([]erv.Input, 0, len(actions))
	for _, a := range actions {
		cost := c.ActionCosts[a]
		ervInputs = append(ervInputs, erv.Input{
			Action:            a,
			PSuccess:          r.scorer.Score(a, feats),
			RecoverableAmount: c.Amount,
			Cost:              cost.MonetaryCost,
			FrictionWeight:    cost.FrictionWeight,
		})
	}
	ranked := erv.Rank(ervInputs)

	// 3. Policy-check each candidate in ERV order; the chosen action is the highest-ERV
	//    candidate the policy engine ALLOWs. no_action always survives, so chosen is never nil.
	candRecords := make([]CandidateRecord, 0, len(ranked))
	var chosen *erv.Candidate
	var chosenPolicy policy.Result
	for i := range ranked {
		cand := ranked[i]
		pr := policy.Evaluate(policy.Input{
			Action:            cand.Action,
			ERV:               cand.ERV,
			EffectiveAttempts: effectiveAttempts,
			MaxRetries:        c.Policy.MaxRetries,
			MinERVThreshold:   c.Policy.MinERVThreshold,
			KillSwitch:        c.Policy.KillSwitch,
		})
		candRecords = append(candRecords, CandidateRecord{
			Action:            cand.Action,
			PSuccess:          cand.PSuccess,
			RecoverableAmount: cand.RecoverableAmount,
			Cost:              cand.Cost,
			FrictionPenalty:   cand.FrictionPenalty,
			ERV:               cand.ERV,
			PolicyResult:      pr.Decision,
		})
		if chosen == nil && pr.Decision == domain.PolicyAllow {
			chosen = &ranked[i]
			chosenPolicy = pr
		}
	}
	if chosen == nil {
		// Unreachable given no_action always passes, but never proceed without a decision.
		return fmt.Errorf("pipeline: no policy-allowed candidate for %s (candidates=%d)", paymentEventID, len(ranked))
	}

	chosenAction := chosen.Action
	willDispatch := chosenAction != domain.ActionNoAction

	// 4. Drive the state machine to the decision point (PLAN.md §6a).
	var decisionState domain.RecoveryState
	switch {
	case c.Policy.KillSwitch:
		// Operator hard-stop: the payment is not recovery-eligible. DIAGNOSED → STOPPED.
		m.MustTo(domain.StateStopped)
		decisionState = domain.StateStopped
		willDispatch = false
	default:
		m.MustTo(domain.StateRecoveryEligible)
		m.MustTo(domain.StateActionSelected)
		if willDispatch {
			decisionState = domain.StateActionSelected
		} else {
			// no_action was the economically best choice: nothing to dispatch, stop.
			m.MustTo(domain.StateStopped)
			decisionState = domain.StateStopped
		}
	}

	// 5. Persist the decision (diagnosis, scores, decision row, audit).
	dec := DecisionRecord{
		PaymentEventID:        c.PaymentEventID,
		MerchantID:            c.MerchantID,
		RootCause:             diag.RootCause,
		Confidence:            diag.Confidence,
		Rationale:             diag.Rationale,
		DiagnosisModelVersion: diag.ModelVersion,
		SuccessModelVersion:   r.scorer.Version(),
		Candidates:            candRecords,
		ChosenAction:          chosenAction,
		ERVAtDecision:         chosen.ERV,
		PolicyVersion:         chosenPolicy.PolicyVersion,
		PolicyCheckResult:     chosenPolicy.Decision,
		PolicyChecksJSON:      buildChecksJSON(chosenAction, chosenPolicy, candRecords),
		RecoveryState:         decisionState,
		StateHistory:          m.History(),
	}
	decisionID, err := r.repo.PersistDecision(ctx, dec)
	if err != nil {
		return fmt.Errorf("pipeline: persist decision: %w", err)
	}
	log.Info("decision persisted",
		"decision_id", decisionID,
		"root_cause", diag.RootCause,
		"confidence", diag.Confidence,
		"chosen_action", chosenAction,
		"erv_at_decision", chosen.ERV,
		"policy_result", chosenPolicy.Decision,
		"recovery_state", decisionState,
	)

	if !willDispatch {
		log.Info("recovery pipeline complete (no dispatch)",
			"recovery_state", decisionState, "state_history", m.History())
		return nil
	}

	// 6. Dispatch the chosen action idempotently (mock external call) and drive the outcome
	//    transitions.
	key := executor.IdempotencyKey(c.PaymentID, decisionID, chosenAction)
	m.MustTo(domain.StateActionPending)

	out, err := r.dispatcher.Dispatch(ctx, chosenAction, c.Amount, key)
	if err != nil {
		return fmt.Errorf("pipeline: dispatch %s: %w", chosenAction, err)
	}

	if out.Recovered {
		m.MustTo(domain.StateRecovered)
		m.MustTo(domain.StateDone)
	} else {
		// Action dispatched but the payment did not recover: re-evaluate, then stop (Phase 2
		// takes no automatic next action — that loop is a later phase).
		m.MustTo(domain.StateFailed)
		m.MustTo(domain.StateReEvaluate)
		m.MustTo(domain.StateStopped)
	}

	var recoveredAmount *int64
	if out.Recovered {
		ra := out.RecoveredAmount
		recoveredAmount = &ra
	}

	created, err := r.repo.FinalizeExecution(ctx, ExecutionRecord{
		DecisionID:             decisionID,
		MerchantID:             c.MerchantID,
		PaymentID:              c.PaymentID,
		Action:                 chosenAction,
		IdempotencyKey:         key,
		ExternalIdempotencyKey: out.ExternalRef,
		ActionStatus:           out.Status,
		OutcomeResult:          out.Result,
		Recovered:              out.Recovered,
		RecoveredAmount:        recoveredAmount,
		FinalState:             m.State(),
		StateHistory:           m.History(),
	})
	if err != nil {
		return fmt.Errorf("pipeline: finalize execution: %w", err)
	}

	log.Info("recovery pipeline complete",
		"decision_id", decisionID,
		"action", chosenAction,
		"action_status", out.Status,
		"recovered", out.Recovered,
		"recovery_state", m.State(),
		"idempotent_new_action", created,
		"state_history", m.History(),
	)
	return nil
}

// ensureNoAction returns actions with no_action appended if it is not already present, so
// the pipeline always has a policy-passing fallback candidate.
func ensureNoAction(actions []domain.Action) []domain.Action {
	for _, a := range actions {
		if a == domain.ActionNoAction {
			return actions
		}
	}
	out := make([]domain.Action, len(actions), len(actions)+1)
	copy(out, actions)
	return append(out, domain.ActionNoAction)
}

// checksDoc is the audit-complete shape written to decisions.policy_checks_json: the chosen
// candidate's per-constraint checks plus a compact per-candidate ranking summary, so a
// decision's full policy reasoning is reconstructable from the one column (PLAN.md §11).
type checksDoc struct {
	PolicyVersion string             `json:"policy_version"`
	ChosenAction  string             `json:"chosen_action"`
	ChosenResult  string             `json:"chosen_result"`
	ChosenChecks  []policy.Check     `json:"chosen_checks"`
	Candidates    []candidateSummary `json:"candidates"`
}

type candidateSummary struct {
	Action       string  `json:"action"`
	ERV          float64 `json:"erv"`
	PolicyResult string  `json:"policy_result"`
}

func buildChecksJSON(chosen domain.Action, res policy.Result, cands []CandidateRecord) json.RawMessage {
	summ := make([]candidateSummary, len(cands))
	for i, c := range cands {
		summ[i] = candidateSummary{Action: string(c.Action), ERV: c.ERV, PolicyResult: string(c.PolicyResult)}
	}
	doc := checksDoc{
		PolicyVersion: res.PolicyVersion,
		ChosenAction:  string(chosen),
		ChosenResult:  string(res.Decision),
		ChosenChecks:  res.Checks,
		Candidates:    summ,
	}
	b, err := json.Marshal(doc)
	if err != nil {
		return nil // a marshal failure must not sink the decision; the column is nullable
	}
	return b
}
