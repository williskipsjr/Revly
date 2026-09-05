package pipeline

import (
	"context"
	"encoding/json"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/diagnosis"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/domain"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/policy"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/successmodel"
)

// fakeRepo records what the pipeline persisted, so orchestration can be asserted without a
// database. It captures the decision and (optionally) the execution record.
type fakeRepo struct {
	ctx         Context
	loadErr     error
	decision    *DecisionRecord
	execution   *ExecutionRecord
	execCreated bool
}

func (f *fakeRepo) LoadContext(_ context.Context, _ string) (Context, error) {
	return f.ctx, f.loadErr
}

func (f *fakeRepo) PersistDecision(_ context.Context, rec DecisionRecord) (string, error) {
	f.decision = &rec
	return "dec_test_1", nil
}

func (f *fakeRepo) FinalizeExecution(_ context.Context, rec ExecutionRecord) (bool, error) {
	f.execution = &rec
	return f.execCreated, nil
}

// baseContext is a healthy merchant/payment with full action-cost config.
func baseContext() Context {
	return Context{
		PaymentEventID: "pe_1",
		PaymentID:      "pay_1",
		MerchantID:     "merch_test",
		Amount:         500000, // ₹5000
		Method:         "card",
		EventType:      "payment.failed",
		FailureReason:  "Issuer declined, please try again",
		PriorAttempts:  0,
		Policy: MerchantPolicy{
			MaxRetries:      3,
			CooldownMinutes: 30,
			MinERVThreshold: 500, // ₹5
			KillSwitch:      false,
		},
		// A realistic platform policy: the 0.4 confidence floor and ceilings wide enough that the
		// base (healthy) case is unaffected. Individual Phase-5 tests tighten what they exercise.
		Platform: policy.Platform{
			ConfidenceFloor:    0.40,
			MaxRetriesCeiling:  5,
			MinCooldownMinutes: 0,
			MaxAmountCeiling:   0, // no platform amount cap in the base case
			MaxDailyActionCap:  0, // no platform daily cap in the base case
		},
		ActionCosts: map[domain.Action]ActionCost{
			domain.ActionRetry:        {MonetaryCost: 200, FrictionWeight: 0.4},
			domain.ActionDelayedRetry: {MonetaryCost: 200, FrictionWeight: 0.3},
			domain.ActionNotify:       {MonetaryCost: 20, FrictionWeight: 0.5},
			domain.ActionEscalate:     {MonetaryCost: 5000, FrictionWeight: 0.3},
			domain.ActionNoAction:     {MonetaryCost: 0, FrictionWeight: 0},
		},
	}
}

func lastState(h []domain.RecoveryState) domain.RecoveryState { return h[len(h)-1] }

// TestProcess_HappyPath: a transient decline on a healthy merchant selects a recovering
// action, dispatches it, and reaches DONE via ACTION_SELECTED→ACTION_PENDING→RECOVERED→DONE.
func TestProcess_HappyPath(t *testing.T) {
	repo := &fakeRepo{ctx: baseContext(), execCreated: true}
	r := NewRunner(repo, nil, nil, nil) // nil dispatcher → MockDispatcher

	if err := r.Process(context.Background(), "pe_1"); err != nil {
		t.Fatalf("Process errored: %v", err)
	}
	if repo.decision == nil {
		t.Fatal("expected a decision to be persisted")
	}
	if repo.decision.ChosenAction == domain.ActionNoAction {
		t.Fatalf("expected a real intervention, got no_action")
	}
	if repo.decision.RecoveryState != domain.StateActionSelected {
		t.Fatalf("decision persisted at %s, want ACTION_SELECTED", repo.decision.RecoveryState)
	}
	if repo.decision.PolicyCheckResult != domain.PolicyAllow {
		t.Fatalf("decision policy result = %s, want ALLOW", repo.decision.PolicyCheckResult)
	}
	if repo.execution == nil {
		t.Fatal("expected an execution to be finalized")
	}
	if !repo.execution.Recovered {
		t.Fatal("mock recovering action should recover")
	}
	if got := lastState(repo.execution.StateHistory); got != domain.StateDone {
		t.Fatalf("final state = %s, want DONE", got)
	}
	// The idempotency key must be derived (non-empty) and the recovered amount set.
	if repo.execution.IdempotencyKey == "" {
		t.Fatal("execution must carry an idempotency key")
	}
	if repo.execution.RecoveredAmount == nil || *repo.execution.RecoveredAmount != 500000 {
		t.Fatalf("recovered amount = %v, want 500000", repo.execution.RecoveredAmount)
	}
}

// TestProcess_KillSwitch: an active kill switch blocks every intervention, so the decision is
// no_action and the journey stops right after diagnosis (no execution).
func TestProcess_KillSwitch(t *testing.T) {
	c := baseContext()
	c.Policy.KillSwitch = true
	repo := &fakeRepo{ctx: c}
	r := NewRunner(repo, nil, nil, nil)

	if err := r.Process(context.Background(), "pe_1"); err != nil {
		t.Fatalf("Process errored: %v", err)
	}
	if repo.decision.ChosenAction != domain.ActionNoAction {
		t.Fatalf("kill switch: chosen = %s, want no_action", repo.decision.ChosenAction)
	}
	if repo.decision.RecoveryState != domain.StateStopped {
		t.Fatalf("kill switch: recovery_state = %s, want STOPPED", repo.decision.RecoveryState)
	}
	if repo.execution != nil {
		t.Fatal("kill switch: no action should be dispatched")
	}
	// State history must not pass through RECOVERY_ELIGIBLE — it was hard-blocked.
	for _, s := range repo.decision.StateHistory {
		if s == domain.StateRecoveryEligible {
			t.Fatalf("kill switch path must skip RECOVERY_ELIGIBLE, got %v", repo.decision.StateHistory)
		}
	}
	// Interventions must show as BLOCKED in the audit JSON.
	assertHasBlockedCandidate(t, repo.decision.PolicyChecksJSON)
}

// TestProcess_BelowMinERV: when every intervention's ERV is under the merchant's floor, the
// pipeline falls back to no_action and STOPPED without dispatching.
func TestProcess_BelowMinERV(t *testing.T) {
	c := baseContext()
	c.Amount = 100                 // tiny amount → tiny P*amount
	c.Policy.MinERVThreshold = 1e9 // impossibly high floor
	repo := &fakeRepo{ctx: c}
	r := NewRunner(repo, nil, nil, nil)

	if err := r.Process(context.Background(), "pe_1"); err != nil {
		t.Fatalf("Process errored: %v", err)
	}
	if repo.decision.ChosenAction != domain.ActionNoAction {
		t.Fatalf("below-floor: chosen = %s, want no_action", repo.decision.ChosenAction)
	}
	if repo.decision.RecoveryState != domain.StateStopped {
		t.Fatalf("below-floor: recovery_state = %s, want STOPPED", repo.decision.RecoveryState)
	}
	// Not hard-blocked, so it WAS recovery-eligible before choosing to stop.
	if !containsState(repo.decision.StateHistory, domain.StateRecoveryEligible) {
		t.Fatalf("below-floor path should pass RECOVERY_ELIGIBLE, got %v", repo.decision.StateHistory)
	}
	if repo.execution != nil {
		t.Fatal("below-floor: nothing should be dispatched")
	}
}

// TestProcess_MaxRetriesBlocksRetry: with the retry budget exhausted, retry-type actions are
// blocked; a non-retry action (or no_action) is chosen instead — never a retry.
func TestProcess_MaxRetriesBlocksRetry(t *testing.T) {
	c := baseContext()
	c.PriorAttempts = 2
	c.RetryActionsTaken = 1 // effective attempts = 3 == MaxRetries → retries blocked
	repo := &fakeRepo{ctx: c, execCreated: true}
	r := NewRunner(repo, nil, nil, nil)

	if err := r.Process(context.Background(), "pe_1"); err != nil {
		t.Fatalf("Process errored: %v", err)
	}
	if domain.IsRetry(repo.decision.ChosenAction) {
		t.Fatalf("retry budget exhausted but chose a retry: %s", repo.decision.ChosenAction)
	}
	// Every retry-type candidate must be recorded as BLOCKED.
	for _, cand := range repo.decision.Candidates {
		if domain.IsRetry(cand.Action) && cand.PolicyResult != domain.PolicyBlock {
			t.Errorf("retry candidate %s should be BLOCKED, got %s", cand.Action, cand.PolicyResult)
		}
	}
}

// TestProcess_LoadError: a context-load failure surfaces as an error and persists nothing.
func TestProcess_LoadError(t *testing.T) {
	repo := &fakeRepo{loadErr: context.DeadlineExceeded}
	r := NewRunner(repo, nil, nil, nil)
	if err := r.Process(context.Background(), "pe_1"); err == nil {
		t.Fatal("expected an error when LoadContext fails")
	}
	if repo.decision != nil || repo.execution != nil {
		t.Fatal("nothing should be persisted when load fails")
	}
}

// expiredCardContext is a healthy merchant with an expired-card failure, whose diagnosis
// (expired_method) yields alt_method and payment_link as competing candidates — the pair on
// which the trained model and the Phase-2 heuristic disagree.
func expiredCardContext() Context {
	c := baseContext()
	c.FailureReason = "Card expired"
	c.Amount = 250000
	c.ActionCosts[domain.ActionAltMethod] = ActionCost{MonetaryCost: 20, FrictionWeight: 0.8}
	c.ActionCosts[domain.ActionPaymentLink] = ActionCost{MonetaryCost: 20, FrictionWeight: 0.8}
	return c
}

func loadTrainedModel(t *testing.T) successmodel.Scorer {
	t.Helper()
	_, thisFile, _, _ := runtime.Caller(0)
	root := filepath.Join(filepath.Dir(thisFile), "..", "..", "..")
	m, err := successmodel.LoadModel(filepath.Join(root, "ml", "artifacts", "success_model.json"))
	if err != nil {
		t.Fatalf("load trained model: %v (run `python -m ml.train_success_model`)", err)
	}
	return m
}

// TestProcess_ModelChangesChosenAction is the Phase 3 headline proof: on the identical event,
// the statistical model selects a different action than the Phase-2 heuristic. For an
// expired-card failure the heuristic picks alt_method (it guessed alt_method > payment_link),
// while the trained model picks payment_link (the synthetic data says payment_link recovers
// more). Same diagnosis, same merchant economics — only the P(success) source differs.
func TestProcess_ModelChangesChosenAction(t *testing.T) {
	heuristicRepo := &fakeRepo{ctx: expiredCardContext(), execCreated: true}
	if err := NewRunner(heuristicRepo, nil, successmodel.HeuristicScorer{}, nil).Process(context.Background(), "pe_1"); err != nil {
		t.Fatalf("heuristic run: %v", err)
	}

	modelRepo := &fakeRepo{ctx: expiredCardContext(), execCreated: true}
	if err := NewRunner(modelRepo, nil, loadTrainedModel(t), nil).Process(context.Background(), "pe_1"); err != nil {
		t.Fatalf("model run: %v", err)
	}

	if heuristicRepo.decision.ChosenAction != domain.ActionAltMethod {
		t.Fatalf("heuristic chose %s, expected alt_method", heuristicRepo.decision.ChosenAction)
	}
	if modelRepo.decision.ChosenAction != domain.ActionPaymentLink {
		t.Fatalf("model chose %s, expected payment_link", modelRepo.decision.ChosenAction)
	}
	if heuristicRepo.decision.ChosenAction == modelRepo.decision.ChosenAction {
		t.Fatal("the statistical model did not change the chosen action")
	}
	// The persisted model provenance must reflect the statistical model, not the heuristic.
	if modelRepo.decision.SuccessModelVersion == successmodel.ModelVersion {
		t.Fatalf("model run recorded heuristic version %q", modelRepo.decision.SuccessModelVersion)
	}
}

// stubDiagnoser is an injectable Diagnoser (Phase 4 seam) that returns a fixed diagnosis and
// records what it was asked, so the pipeline's use of the pluggable diagnoser is assertable
// without any network or LLM.
type stubDiagnoser struct {
	out      diagnosis.Diagnosis
	gotInput diagnosis.Input
	called   bool
}

func (s *stubDiagnoser) Diagnose(_ context.Context, in diagnosis.Input) diagnosis.Diagnosis {
	s.called = true
	s.gotInput = in
	return s.out
}

// TestProcess_WithInjectedDiagnoser: WithDiagnoser routes diagnosis through the injected
// diagnoser (the Phase-4 LLM seam), and its result — not the rule table's — is what the
// pipeline persists and reasons over. Economics/policy still rank and authorise the action.
func TestProcess_WithInjectedDiagnoser(t *testing.T) {
	stub := &stubDiagnoser{out: diagnosis.Diagnosis{
		RootCause:        domain.RootExpiredMethod, // rule table would say temporary_bank_decline here
		Confidence:       0.9,
		Rationale:        "injected llm diagnosis",
		CandidateActions: []domain.Action{domain.ActionAltMethod, domain.ActionPaymentLink, domain.ActionNoAction},
		ModelVersion:     "claude-sonnet-5",
		Source:           diagnosis.SourceLLM,
	}}
	c := baseContext() // FailureReason "Issuer declined, please try again"
	c.ActionCosts[domain.ActionAltMethod] = ActionCost{MonetaryCost: 20, FrictionWeight: 0.8}
	c.ActionCosts[domain.ActionPaymentLink] = ActionCost{MonetaryCost: 20, FrictionWeight: 0.8}
	repo := &fakeRepo{ctx: c, execCreated: true}
	r := NewRunner(repo, nil, nil, nil, WithDiagnoser(stub))

	if err := r.Process(context.Background(), "pe_1"); err != nil {
		t.Fatalf("Process errored: %v", err)
	}
	if !stub.called {
		t.Fatal("injected diagnoser was not used")
	}
	if stub.gotInput.EventType != c.EventType || stub.gotInput.FailureReason != c.FailureReason {
		t.Fatalf("diagnoser received %+v, want event/reason from context", stub.gotInput)
	}
	// The persisted diagnosis must be the INJECTED one, proving the rule table was bypassed.
	if repo.decision.RootCause != domain.RootExpiredMethod {
		t.Fatalf("persisted root cause = %q, want expired_method (injected)", repo.decision.RootCause)
	}
	if repo.decision.DiagnosisModelVersion != "claude-sonnet-5" {
		t.Fatalf("persisted diagnosis model version = %q, want claude-sonnet-5", repo.decision.DiagnosisModelVersion)
	}
	// Economics/policy still choose from the injected candidate set (+ the always-added no_action).
	switch repo.decision.ChosenAction {
	case domain.ActionAltMethod, domain.ActionPaymentLink, domain.ActionNoAction:
	default:
		t.Fatalf("chosen action %q is not among the injected candidates", repo.decision.ChosenAction)
	}
}

// TestNewRunner_NilDiagnoserKeepsRuleBased: WithDiagnoser(nil) is a no-op, leaving the
// deterministic rule table in place — the same default an unconfigured deployment uses.
func TestNewRunner_NilDiagnoserKeepsRuleBased(t *testing.T) {
	repo := &fakeRepo{ctx: baseContext(), execCreated: true}
	r := NewRunner(repo, nil, nil, nil, WithDiagnoser(nil))

	if err := r.Process(context.Background(), "pe_1"); err != nil {
		t.Fatalf("Process errored: %v", err)
	}
	// Rule table for "Issuer declined, please try again" → temporary_bank_decline / rules-v1.
	if repo.decision.RootCause != domain.RootTemporaryBankDecline {
		t.Fatalf("nil diagnoser should keep rule-based; got root cause %q", repo.decision.RootCause)
	}
	if repo.decision.DiagnosisModelVersion != diagnosis.ModelVersion {
		t.Fatalf("nil diagnoser model version = %q, want %q", repo.decision.DiagnosisModelVersion, diagnosis.ModelVersion)
	}
}

// TestProcess_FraudRoutesToHumanReview: a fraud_suspected diagnosis blocks every autonomous
// intervention and routes to a human — the decision is HUMAN_REVIEW with chosen escalate, the
// journey hard-stops at STOPPED (skipping RECOVERY_ELIGIBLE), and nothing is dispatched.
func TestProcess_FraudRoutesToHumanReview(t *testing.T) {
	c := baseContext()
	c.FailureReason = "transaction flagged as suspected fraud" // rule table → fraud_suspected
	repo := &fakeRepo{ctx: c}
	r := NewRunner(repo, nil, nil, nil)

	if err := r.Process(context.Background(), "pe_1"); err != nil {
		t.Fatalf("Process errored: %v", err)
	}
	if repo.decision.RootCause != domain.RootFraudSuspected {
		t.Fatalf("root cause = %s, want fraud_suspected", repo.decision.RootCause)
	}
	if repo.decision.PolicyCheckResult != domain.PolicyHumanReview {
		t.Fatalf("policy result = %s, want HUMAN_REVIEW", repo.decision.PolicyCheckResult)
	}
	if repo.decision.ChosenAction != domain.ActionEscalate {
		t.Fatalf("chosen = %s, want escalate", repo.decision.ChosenAction)
	}
	if repo.decision.RecoveryState != domain.StateStopped {
		t.Fatalf("recovery_state = %s, want STOPPED", repo.decision.RecoveryState)
	}
	if repo.execution != nil {
		t.Fatal("HUMAN_REVIEW must not dispatch an action")
	}
	for _, s := range repo.decision.StateHistory {
		if s == domain.StateRecoveryEligible {
			t.Fatalf("fraud hard-stop must skip RECOVERY_ELIGIBLE, got %v", repo.decision.StateHistory)
		}
	}
}

// TestProcess_ConfidenceFloorLimitsToNotify: a diagnosis below the confidence floor disallows
// autonomous retries; only notify/no_action survive, so a retry is never chosen.
func TestProcess_ConfidenceFloorLimitsToNotify(t *testing.T) {
	stub := &stubDiagnoser{out: diagnosis.Diagnosis{
		RootCause:        domain.RootTemporaryBankDecline,
		Confidence:       0.20, // below the 0.40 floor
		Rationale:        "low-confidence transient guess",
		CandidateActions: []domain.Action{domain.ActionRetry, domain.ActionDelayedRetry, domain.ActionNotify, domain.ActionNoAction},
		ModelVersion:     "test",
		Source:           diagnosis.SourceLLM,
	}}
	repo := &fakeRepo{ctx: baseContext(), execCreated: true}
	r := NewRunner(repo, nil, nil, nil, WithDiagnoser(stub))

	if err := r.Process(context.Background(), "pe_1"); err != nil {
		t.Fatalf("Process errored: %v", err)
	}
	if domain.IsRetry(repo.decision.ChosenAction) {
		t.Fatalf("below confidence floor but chose a retry: %s", repo.decision.ChosenAction)
	}
	for _, cand := range repo.decision.Candidates {
		if domain.IsRetry(cand.Action) && cand.PolicyResult != domain.PolicyBlock {
			t.Errorf("retry candidate %s should be BLOCKED below the floor, got %s", cand.Action, cand.PolicyResult)
		}
	}
}

// TestProcess_AmountCeilingBlocksMoneyMovement: above the merchant's amount ceiling, automated
// money-movement actions (retry/delayed_retry) are blocked; a harmless notify is chosen instead.
func TestProcess_AmountCeilingBlocksMoneyMovement(t *testing.T) {
	c := baseContext()
	c.Amount = 10_000_000              // ₹100,000
	c.Policy.AmountCeiling = 5_000_000 // ₹50,000
	c.Platform.MaxAmountCeiling = 100_000_000
	repo := &fakeRepo{ctx: c, execCreated: true}
	r := NewRunner(repo, nil, nil, nil)

	if err := r.Process(context.Background(), "pe_1"); err != nil {
		t.Fatalf("Process errored: %v", err)
	}
	if domain.IsRetry(repo.decision.ChosenAction) {
		t.Fatalf("amount over ceiling but chose a money-movement retry: %s", repo.decision.ChosenAction)
	}
	for _, cand := range repo.decision.Candidates {
		if domain.IsRetry(cand.Action) && cand.PolicyResult != domain.PolicyBlock {
			t.Errorf("retry candidate %s should be BLOCKED over the ceiling, got %s", cand.Action, cand.PolicyResult)
		}
	}
}

// TestProcess_CooldownBlocksRetry: with a recent prior retry inside the cooldown window, retry
// actions are blocked and a non-retry action is chosen.
func TestProcess_CooldownBlocksRetry(t *testing.T) {
	c := baseContext()
	c.Policy.CooldownMinutes = 30
	c.HasPriorRetry = true
	c.MinutesSinceLastRetry = 5 // inside the 30-minute window
	repo := &fakeRepo{ctx: c, execCreated: true}
	r := NewRunner(repo, nil, nil, nil)

	if err := r.Process(context.Background(), "pe_1"); err != nil {
		t.Fatalf("Process errored: %v", err)
	}
	if domain.IsRetry(repo.decision.ChosenAction) {
		t.Fatalf("inside cooldown but chose a retry: %s", repo.decision.ChosenAction)
	}
	for _, cand := range repo.decision.Candidates {
		if domain.IsRetry(cand.Action) && cand.PolicyResult != domain.PolicyBlock {
			t.Errorf("retry candidate %s should be BLOCKED inside cooldown, got %s", cand.Action, cand.PolicyResult)
		}
	}
}

// TestProcess_DailyCapStopsAllInterventions: once the customer hits the daily action cap, every
// intervention is blocked, so the pipeline falls back to no_action and STOPPED.
func TestProcess_DailyCapStopsAllInterventions(t *testing.T) {
	c := baseContext()
	c.Policy.DailyActionCap = 2
	c.Platform.MaxDailyActionCap = 50
	c.CustomerActionsToday = 2 // at the cap
	repo := &fakeRepo{ctx: c}
	r := NewRunner(repo, nil, nil, nil)

	if err := r.Process(context.Background(), "pe_1"); err != nil {
		t.Fatalf("Process errored: %v", err)
	}
	if repo.decision.ChosenAction != domain.ActionNoAction {
		t.Fatalf("daily cap reached: chosen = %s, want no_action", repo.decision.ChosenAction)
	}
	if repo.decision.RecoveryState != domain.StateStopped {
		t.Fatalf("daily cap reached: recovery_state = %s, want STOPPED", repo.decision.RecoveryState)
	}
	if repo.execution != nil {
		t.Fatal("daily cap reached: nothing should be dispatched")
	}
	assertHasBlockedCandidate(t, repo.decision.PolicyChecksJSON)
}

// TestProcess_MerchantOverrideChangesBehavior is the Phase 5 DoD: on the IDENTICAL event, a
// merchant-specific confidence-floor override changes the outcome. Merchant A (floor 0.40)
// allows a retry at diagnosis confidence 0.50; Merchant B raises its floor to 0.60, which blocks
// the retry — so the same event yields a different chosen action purely from merchant policy.
func TestProcess_MerchantOverrideChangesBehavior(t *testing.T) {
	newStub := func() *stubDiagnoser {
		return &stubDiagnoser{out: diagnosis.Diagnosis{
			RootCause:        domain.RootTemporaryBankDecline,
			Confidence:       0.50,
			Rationale:        "borderline-confidence transient decline",
			CandidateActions: []domain.Action{domain.ActionRetry, domain.ActionDelayedRetry, domain.ActionNotify, domain.ActionNoAction},
			ModelVersion:     "test",
			Source:           diagnosis.SourceLLM,
		}}
	}

	// Merchant A: no override — platform floor 0.40 applies, 0.50 clears it → a retry is allowed.
	repoA := &fakeRepo{ctx: baseContext(), execCreated: true}
	if err := NewRunner(repoA, nil, nil, nil, WithDiagnoser(newStub())).Process(context.Background(), "pe_1"); err != nil {
		t.Fatalf("merchant A Process: %v", err)
	}

	// Merchant B: identical event, but raises its confidence floor to 0.60 → 0.50 fails it, so
	// retries are blocked and a non-retry action is chosen.
	cB := baseContext()
	floor := 0.60
	cB.Policy.ConfidenceFloorOverride = &floor
	repoB := &fakeRepo{ctx: cB, execCreated: true}
	if err := NewRunner(repoB, nil, nil, nil, WithDiagnoser(newStub())).Process(context.Background(), "pe_1"); err != nil {
		t.Fatalf("merchant B Process: %v", err)
	}

	if !domain.IsRetry(repoA.decision.ChosenAction) {
		t.Fatalf("merchant A (floor 0.40) should allow a retry, chose %s", repoA.decision.ChosenAction)
	}
	if domain.IsRetry(repoB.decision.ChosenAction) {
		t.Fatalf("merchant B (floor 0.60) should block the retry, chose %s", repoB.decision.ChosenAction)
	}
	if repoA.decision.ChosenAction == repoB.decision.ChosenAction {
		t.Fatal("merchant override did not change behavior on the identical event")
	}
}

func containsState(h []domain.RecoveryState, want domain.RecoveryState) bool {
	for _, s := range h {
		if s == want {
			return true
		}
	}
	return false
}

func assertHasBlockedCandidate(t *testing.T, raw json.RawMessage) {
	t.Helper()
	var doc struct {
		Candidates []struct {
			Action       string `json:"action"`
			PolicyResult string `json:"policy_result"`
		} `json:"candidates"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil {
		t.Fatalf("policy_checks_json is not valid JSON: %v", err)
	}
	for _, c := range doc.Candidates {
		if c.PolicyResult == string(domain.PolicyBlock) {
			return
		}
	}
	t.Fatalf("expected at least one BLOCKED candidate in audit JSON, got %s", raw)
}
