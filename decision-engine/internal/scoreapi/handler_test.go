package scoreapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/domain"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/pipeline"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/successmodel"
)

// stubScorer returns a fixed p per action so endpoint behavior is deterministic.
type stubScorer struct{ p map[domain.Action]float64 }

func (s stubScorer) Score(a domain.Action, _ successmodel.Features) float64 { return s.p[a] }
func (s stubScorer) Version() string                                        { return "stub-v1" }

// stubCosts implements CostSource.
type stubCosts struct {
	costs map[domain.Action]pipeline.ActionCost
	err   error
}

func (s stubCosts) MerchantActionCosts(_ context.Context, _ string) (map[domain.Action]pipeline.ActionCost, error) {
	return s.costs, s.err
}

func newTestHandlers() *Handlers {
	return NewHandlers(
		stubScorer{p: map[domain.Action]float64{
			domain.ActionAltMethod:   0.45,
			domain.ActionPaymentLink: 0.60, // higher → should rank first in erv/compute
			domain.ActionNotify:      0.20,
		}},
		stubCosts{costs: map[domain.Action]pipeline.ActionCost{
			domain.ActionAltMethod:   {MonetaryCost: 20, FrictionWeight: 0.8},
			domain.ActionPaymentLink: {MonetaryCost: 20, FrictionWeight: 0.8},
			domain.ActionNotify:      {MonetaryCost: 20, FrictionWeight: 0.5},
		}},
	)
}

func post(t *testing.T, h http.HandlerFunc, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
	rec := httptest.NewRecorder()
	h(rec, req)
	return rec
}

func TestScore_ReturnsPerActionProbabilities(t *testing.T) {
	h := newTestHandlers()
	rec := post(t, h.Score, `{"method":"card","prior_attempts":0,"amount":250000,"actions":["alt_method","payment_link"]}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (%s)", rec.Code, rec.Body.String())
	}
	var resp scoreResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.ModelVersion != "stub-v1" {
		t.Errorf("model_version = %q, want stub-v1", resp.ModelVersion)
	}
	got := map[string]float64{}
	for _, s := range resp.Scores {
		got[s.Action] = s.PSuccess
	}
	if got["alt_method"] != 0.45 || got["payment_link"] != 0.60 {
		t.Fatalf("unexpected scores: %+v", got)
	}
}

func TestScore_DefaultsToAllInterventionsAndRejectsBadInput(t *testing.T) {
	h := newTestHandlers()

	rec := post(t, h.Score, `{"method":"upi","amount":1000}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var resp scoreResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	if len(resp.Scores) != len(defaultActions) {
		t.Fatalf("expected %d default actions, got %d", len(defaultActions), len(resp.Scores))
	}

	if rec := post(t, h.Score, `{bad json`); rec.Code != http.StatusBadRequest {
		t.Fatalf("bad json expected 400, got %d", rec.Code)
	}
	if rec := post(t, h.Score, `{"amount":-5}`); rec.Code != http.StatusBadRequest {
		t.Fatalf("negative amount expected 400, got %d", rec.Code)
	}
}

func TestErvCompute_RanksByErvDescending(t *testing.T) {
	h := newTestHandlers()
	rec := post(t, h.ErvCompute, `{"merchant_id":"m1","method":"card","amount":250000,"actions":["alt_method","payment_link","notify"]}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (%s)", rec.Code, rec.Body.String())
	}
	var resp ervResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(resp.Candidates) != 3 {
		t.Fatalf("expected 3 candidates, got %d", len(resp.Candidates))
	}
	// payment_link has the highest p and equal cost/friction to alt_method → ranks first.
	if resp.Candidates[0].Action != "payment_link" {
		t.Fatalf("top candidate = %s, want payment_link", resp.Candidates[0].Action)
	}
	// Sorted strictly descending by ERV, with per-term breakdown present.
	for i := 1; i < len(resp.Candidates); i++ {
		if resp.Candidates[i-1].ERV < resp.Candidates[i].ERV {
			t.Errorf("not ERV-descending at %d", i)
		}
	}
	if resp.Candidates[0].FrictionPenalty == 0 || resp.Candidates[0].RecoverableAmount != 250000 {
		t.Errorf("per-term breakdown missing: %+v", resp.Candidates[0])
	}
}

func TestErvCompute_Validation(t *testing.T) {
	h := newTestHandlers()

	if rec := post(t, h.ErvCompute, `{"method":"card","amount":100}`); rec.Code != http.StatusBadRequest {
		t.Fatalf("missing merchant_id expected 400, got %d", rec.Code)
	}

	// Unknown merchant → empty costs → 404.
	empty := NewHandlers(newTestHandlers().scorer, stubCosts{costs: map[domain.Action]pipeline.ActionCost{}})
	if rec := post(t, empty.ErvCompute, `{"merchant_id":"nope","method":"card","amount":100}`); rec.Code != http.StatusNotFound {
		t.Fatalf("unknown merchant expected 404, got %d", rec.Code)
	}

	// No cost source configured → 503.
	noDB := NewHandlers(newTestHandlers().scorer, nil)
	if rec := post(t, noDB.ErvCompute, `{"merchant_id":"m1","method":"card","amount":100}`); rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("no cost source expected 503, got %d", rec.Code)
	}
}
