package successmodel

import (
	"math"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/domain"
)

// artifactPath resolves the committed trained artifact relative to this test file, so the test
// is independent of the working directory.
func artifactPath(t *testing.T) string {
	t.Helper()
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("cannot resolve caller path")
	}
	// internal/successmodel/model_test.go -> repo root is three levels up from the package dir.
	root := filepath.Join(filepath.Dir(thisFile), "..", "..", "..")
	return filepath.Join(root, "ml", "artifacts", "success_model.json")
}

func loadModel(t *testing.T) *Model {
	t.Helper()
	m, err := LoadModel(artifactPath(t))
	if err != nil {
		t.Fatalf("LoadModel: %v (was `python -m ml.train_success_model` run?)", err)
	}
	return m
}

// TestModel_ReproducesGoldenVectors is the cross-language consistency proof: the Go scorer must
// reproduce every (input -> p_success) vector the Python trainer exported, within tolerance.
func TestModel_ReproducesGoldenVectors(t *testing.T) {
	m := loadModel(t)
	vecs := m.TestVectors()
	if len(vecs) == 0 {
		t.Fatal("artifact carries no test vectors")
	}
	for _, v := range vecs {
		got := m.Score(domain.Action(v.Action), Features{Method: v.Method, PriorAttempts: v.PriorAttempts, Amount: v.Amount})
		if math.Abs(got-v.PSuccess) > 1e-6 {
			t.Errorf("Go/Python mismatch for %+v: Go=%.8f Python=%.8f", v, got, v.PSuccess)
		}
	}
}

// TestModel_NoActionAndUnknownAreZero: no_action and out-of-vocabulary actions score 0.
func TestModel_NoActionAndUnknownAreZero(t *testing.T) {
	m := loadModel(t)
	if p := m.Score(domain.ActionNoAction, Features{Method: "card", Amount: 100000}); p != 0 {
		t.Errorf("no_action scored %v, want 0", p)
	}
	if p := m.Score(domain.Action("teleport"), Features{Method: "card", Amount: 100000}); p != 0 {
		t.Errorf("unknown action scored %v, want 0", p)
	}
}

// TestModel_RangeAndMonotonic: probabilities stay in [0,1] and are non-increasing in prior
// attempts for every intervention/method — the key learned property.
func TestModel_RangeAndMonotonic(t *testing.T) {
	m := loadModel(t)
	actions := []domain.Action{domain.ActionRetry, domain.ActionDelayedRetry, domain.ActionAltMethod, domain.ActionPaymentLink, domain.ActionNotify, domain.ActionEscalate}
	methods := []string{"card", "upi", "netbanking", "wallet", "emi", "other", "unknown"}
	for _, a := range actions {
		for _, meth := range methods {
			prev := math.Inf(1)
			for pa := 0; pa <= 6; pa++ {
				p := m.Score(a, Features{Method: meth, PriorAttempts: pa, Amount: 250000})
				if p < 0 || p > 1 {
					t.Fatalf("p out of range for %s/%s/%d: %v", a, meth, pa, p)
				}
				if p > prev+1e-9 {
					t.Errorf("not monotonic in prior_attempts for %s/%s: %v > %v", a, meth, p, prev)
				}
				prev = p
			}
		}
	}
}

// TestModel_UnknownMethodFoldsToOther: an unknown method scores identically to "other".
func TestModel_UnknownMethodFoldsToOther(t *testing.T) {
	m := loadModel(t)
	a := domain.ActionAltMethod
	other := m.Score(a, Features{Method: "other", PriorAttempts: 1, Amount: 100000})
	unknown := m.Score(a, Features{Method: "does_not_exist", PriorAttempts: 1, Amount: 100000})
	if math.Abs(other-unknown) > 1e-12 {
		t.Errorf("unknown method %v != other %v", unknown, other)
	}
}

// TestModel_DivergesFromHeuristic proves the statistical model changes the P(success) ordering
// versus the Phase-2 heuristic: for a card payment with no priors, the model ranks payment_link
// above alt_method, while the heuristic ranks alt_method above payment_link. Both are candidate
// actions for an expired-method diagnosis, so this ordering flip changes the pipeline's chosen
// action (asserted end-to-end in the pipeline and store tests).
func TestModel_DivergesFromHeuristic(t *testing.T) {
	m := loadModel(t)
	h := HeuristicScorer{}
	f := Features{Method: "card", PriorAttempts: 0, Amount: 250000}

	modelLink := m.Score(domain.ActionPaymentLink, f)
	modelAlt := m.Score(domain.ActionAltMethod, f)
	if !(modelLink > modelAlt) {
		t.Fatalf("model expected payment_link (%.4f) > alt_method (%.4f)", modelLink, modelAlt)
	}

	heurLink := h.Score(domain.ActionPaymentLink, f)
	heurAlt := h.Score(domain.ActionAltMethod, f)
	if !(heurAlt > heurLink) {
		t.Fatalf("heuristic expected alt_method (%.4f) > payment_link (%.4f)", heurAlt, heurLink)
	}
}

// TestModel_Version exposes the trained model version for provenance.
func TestModel_Version(t *testing.T) {
	m := loadModel(t)
	if m.Version() == "" {
		t.Fatal("model version must be non-empty")
	}
	if (HeuristicScorer{}).Version() != ModelVersion {
		t.Fatalf("heuristic version = %q, want %q", (HeuristicScorer{}).Version(), ModelVersion)
	}
}
