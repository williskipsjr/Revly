package pipeline

import (
	"context"
	"encoding/json"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/domain"
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
			MinERVThreshold: 500, // ₹5
			KillSwitch:      false,
		},
		ActionCosts: map[domain.Action]ActionCost{
			domain.ActionRetry:        {MonetaryCost: 200, FrictionWeight: 0.4},
			domain.ActionDelayedRetry: {MonetaryCost: 200, FrictionWeight: 0.3},
			domain.ActionNotify:       {MonetaryCost: 20, FrictionWeight: 0.5},
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
