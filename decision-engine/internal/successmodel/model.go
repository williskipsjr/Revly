package successmodel

import (
	"encoding/json"
	"fmt"
	"math"
	"os"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/domain"
)

// Features are the context inputs to the P(success) estimator. They mirror the training
// feature spec in ml/features.py exactly. Amount is paise; PriorAttempts is the effective
// attempt count (provider prior_attempts + retries this system already dispatched).
type Features struct {
	Method        string
	PriorAttempts int
	Amount        int64
}

// Scorer estimates P(success | context, action). Two implementations exist: the statistical
// Model (Phase 3, loaded from the trained artifact) and HeuristicScorer (the Phase-2 lookup,
// kept as a graceful fallback when no artifact is available). Both are a SEPARATE code path
// from diagnosis (PLAN.md §7): nothing here consumes diagnosis output or LLM text.
type Scorer interface {
	Score(action domain.Action, f Features) float64
	Version() string
}

// HeuristicScorer adapts the Phase-2 hand-set heuristic (PSuccess) to the Scorer interface.
// It ignores Amount (the heuristic does not use it) and remains the fallback estimator.
type HeuristicScorer struct{}

func (HeuristicScorer) Score(action domain.Action, f Features) float64 {
	return PSuccess(action, f.Method, f.PriorAttempts)
}

func (HeuristicScorer) Version() string { return ModelVersion }

// numericSpec is a standardized numeric feature: value is z-scored as (raw-Mean)/Std.
type numericSpec struct {
	Name string  `json:"name"`
	Mean float64 `json:"mean"`
	Std  float64 `json:"std"`
}

// TestVector is a golden (input -> p_success) case exported by training; the Go tests assert
// the loaded Model reproduces each one, guaranteeing Go/Python featurization agree.
type TestVector struct {
	Method        string  `json:"method"`
	Action        string  `json:"action"`
	PriorAttempts int     `json:"prior_attempts"`
	Amount        int64   `json:"amount"`
	PSuccess      float64 `json:"p_success"`
}

// artifactJSON is the on-disk shape written by ml/train_success_model.py.
type artifactJSON struct {
	ModelType    string             `json:"model_type"`
	ModelVersion string             `json:"model_version"`
	Intercept    float64            `json:"intercept"`
	Coefficients map[string]float64 `json:"coefficients"`
	FeatureSpec  struct {
		Numeric []numericSpec `json:"numeric"`
		Methods []string      `json:"methods"`
		Actions []string      `json:"actions"`
	} `json:"feature_spec"`
	TestVectors []TestVector `json:"test_vectors"`
}

// Model is the interpretable logistic-regression P(success) estimator, loaded from the
// exported artifact and evaluated in-process (no ONNX, no network hop). It is a linear model:
// z = intercept + Σ coef·feature; p = sigmoid(z) — fully auditable from its coefficients.
type Model struct {
	version     string
	intercept   float64
	coef        map[string]float64
	numeric     []numericSpec
	methods     map[string]bool
	actions     map[string]bool
	testVectors []TestVector
}

// LoadModel reads and validates a trained artifact from path.
func LoadModel(path string) (*Model, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("successmodel: read artifact: %w", err)
	}
	var a artifactJSON
	if err := json.Unmarshal(b, &a); err != nil {
		return nil, fmt.Errorf("successmodel: parse artifact: %w", err)
	}
	if a.ModelVersion == "" || len(a.Coefficients) == 0 || len(a.FeatureSpec.Actions) == 0 {
		return nil, fmt.Errorf("successmodel: artifact %s is missing required fields", path)
	}
	for _, ns := range a.FeatureSpec.Numeric {
		if ns.Std == 0 {
			return nil, fmt.Errorf("successmodel: numeric feature %q has zero std", ns.Name)
		}
	}
	m := &Model{
		version:     a.ModelVersion,
		intercept:   a.Intercept,
		coef:        a.Coefficients,
		numeric:     a.FeatureSpec.Numeric,
		methods:     toSet(a.FeatureSpec.Methods),
		actions:     toSet(a.FeatureSpec.Actions),
		testVectors: a.TestVectors,
	}
	return m, nil
}

// Score returns P(success | context, action) in [0,1].
//
// no_action always returns 0 (it recovers nothing by definition — the ERV baseline). An action
// the model was not trained on also returns 0: the model never invents a probability for an
// action outside its training vocabulary.
func (m *Model) Score(action domain.Action, f Features) float64 {
	if action == domain.ActionNoAction || !m.actions[string(action)] {
		return 0
	}
	z := m.intercept

	// Numeric features, standardized exactly as in training.
	for _, ns := range m.numeric {
		var raw float64
		switch ns.Name {
		case "prior_attempts":
			pa := f.PriorAttempts
			if pa < 0 {
				pa = 0
			}
			raw = float64(pa)
		case "amount_tier":
			raw = amountTier(f.Amount)
		default:
			continue // unknown numeric feature contributes nothing
		}
		z += m.coef[ns.Name] * ((raw - ns.Mean) / ns.Std)
	}

	// Method one-hot (unknown method folds to "other", matching ml/features.py).
	method := f.Method
	if !m.methods[method] {
		method = "other"
	}
	z += m.coef["method_"+method]

	// Action one-hot.
	z += m.coef["action_"+string(action)]

	return sigmoid(z)
}

func (m *Model) Version() string { return m.version }

// TestVectors returns the golden vectors embedded in the artifact (used by tests).
func (m *Model) TestVectors() []TestVector { return m.testVectors }

// amountTier mirrors ml/features.amount_tier: floor(log10(amount+1)) clamped to [0,8].
func amountTier(amount int64) float64 {
	if amount < 0 {
		amount = 0
	}
	tier := math.Floor(math.Log10(float64(amount) + 1))
	if tier < 0 {
		tier = 0
	}
	if tier > 8 {
		tier = 8
	}
	return tier
}

func sigmoid(z float64) float64 {
	if z < -35 {
		z = -35
	}
	if z > 35 {
		z = 35
	}
	return 1.0 / (1.0 + math.Exp(-z))
}

func toSet(items []string) map[string]bool {
	s := make(map[string]bool, len(items))
	for _, it := range items {
		s[it] = true
	}
	return s
}
