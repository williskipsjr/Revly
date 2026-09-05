package execapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/executor"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/pipeline"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/reconcile"
)

type fakeExecRepo struct {
	finalized *pipeline.ExecutionRecord
	pending   *pipeline.PendingActionRecord
}

func (f *fakeExecRepo) FinalizeExecution(_ context.Context, rec pipeline.ExecutionRecord) (bool, error) {
	f.finalized = &rec
	return true, nil
}
func (f *fakeExecRepo) RecordPendingAction(_ context.Context, rec pipeline.PendingActionRecord) (bool, error) {
	f.pending = &rec
	return true, nil
}

type emptyReconcileRepo struct{}

func (emptyReconcileRepo) LoadPendingConfirmations(context.Context, int) ([]reconcile.PendingAction, error) {
	return nil, nil
}
func (emptyReconcileRepo) SettleAction(context.Context, reconcile.Settlement) (bool, error) {
	return true, nil
}

func newServer(repo Repo) *httptest.Server {
	r := reconcile.NewReconciler(emptyReconcileRepo{}, executor.MockDispatcher{}, nil)
	mux := http.NewServeMux()
	NewHandlers(executor.MockDispatcher{}, repo, r, nil).Register(mux)
	return httptest.NewServer(mux)
}

// TestExecuteAction_RetryRecoversAndFinalizes: a retry via the mock dispatcher confirms and
// recovers, finalizing at DONE idempotently.
func TestExecuteAction_RetryRecoversAndFinalizes(t *testing.T) {
	repo := &fakeExecRepo{}
	srv := newServer(repo)
	defer srv.Close()

	body := `{"decision_id":"d1","payment_id":"p1","merchant_id":"m","action":"retry","amount":500000}`
	resp, err := http.Post(srv.URL+"/internal/execute-action", "application/json", strings.NewReader(body))
	if err != nil {
		t.Fatalf("post: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("got %d, want 200", resp.StatusCode)
	}
	var out executeResponse
	_ = json.NewDecoder(resp.Body).Decode(&out)
	if !out.Created || !out.Recovered || out.RecoveryState != "DONE" {
		t.Fatalf("response = %+v, want created+recovered+DONE", out)
	}
	if repo.finalized == nil || repo.finalized.IdempotencyKey == "" {
		t.Fatal("expected a finalized execution with an idempotency key")
	}
}

// TestExecuteAction_RejectsNoAction: no_action is not an executable action.
func TestExecuteAction_RejectsNoAction(t *testing.T) {
	srv := newServer(&fakeExecRepo{})
	defer srv.Close()
	body := `{"decision_id":"d1","payment_id":"p1","merchant_id":"m","action":"no_action","amount":1}`
	resp, _ := http.Post(srv.URL+"/internal/execute-action", "application/json", strings.NewReader(body))
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("got %d, want 400", resp.StatusCode)
	}
}

// TestReconcileEndpoint_ReturnsReport: the reconcile endpoint runs a sweep and returns a report.
func TestReconcileEndpoint_ReturnsReport(t *testing.T) {
	srv := newServer(&fakeExecRepo{})
	defer srv.Close()
	resp, err := http.Post(srv.URL+"/internal/reconcile-pending-actions", "application/json", strings.NewReader(`{"limit":10}`))
	if err != nil {
		t.Fatalf("post: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("got %d, want 200", resp.StatusCode)
	}
	var rep reconcile.Report
	if err := json.NewDecoder(resp.Body).Decode(&rep); err != nil {
		t.Fatalf("decode report: %v", err)
	}
	if rep.Scanned != 0 {
		t.Fatalf("scanned = %d, want 0 (no pending)", rep.Scanned)
	}
}
