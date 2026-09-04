// Package successmodel is the Phase 2 P(success) estimator: a small, transparent heuristic
// lookup — deliberately NOT machine learning. Phase 3 replaces it with an interpretable
// statistical model (logistic regression) trained on clearly-labeled synthetic data; the
// signature here is chosen so that swap is local.
//
// This is a separate code path from diagnosis on purpose (PLAN.md §5/§7): P(success) is the
// probability used inside ERV and must never be the LLM/diagnosis confidence. Nothing in
// this package imports diagnosis, and nothing in diagnosis imports this — the architectural
// separation is enforced by the package boundary, not just by convention.
package successmodel

import (
	"math"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/domain"
)

// ModelVersion labels the heuristic in success_model_scores.model_version. Named "heuristic"
// (not "ml") so provenance is honest: this is a lookup table, not a trained model.
const ModelVersion = "heuristic-v1"

// actionBaseRate is the base probability that an action recovers the payment, before method
// and prior-attempt adjustment. These are hand-set Phase-2 priors, not learned values.
// no_action is 0: doing nothing is credited with no recovery, so its ERV is a clean zero
// baseline that any worthwhile intervention must beat.
var actionBaseRate = map[domain.Action]float64{
	domain.ActionRetry:        0.45,
	domain.ActionDelayedRetry: 0.55, // waiting out a transient issue beats an immediate retry
	domain.ActionAltMethod:    0.50,
	domain.ActionPaymentLink:  0.40,
	domain.ActionNotify:       0.20, // a nudge only sometimes converts
	domain.ActionEscalate:     0.60, // human intervention is effective but expensive (cost lives in ERV)
	domain.ActionNoAction:     0.00,
}

// methodMultiplier tilts the base rate by payment method. Unknown methods fall back to the
// conservative default.
var methodMultiplier = map[string]float64{
	"card":       0.95,
	"upi":        1.05,
	"netbanking": 0.95,
	"wallet":     1.00,
	"emi":        0.90,
	"other":      0.90,
}

const defaultMethodMultiplier = 0.90

// attemptDecay multiplies the estimate by attemptDecay^priorAttempts: each prior failed
// attempt makes recovery less likely. In (0,1), so the estimate is non-increasing in
// priorAttempts — a property the tests assert.
const attemptDecay = 0.80

// PSuccess estimates P(this action recovers this payment | method, prior attempts), always
// in [0,1]. no_action always returns exactly 0 (see actionBaseRate). An unknown action also
// returns 0 — the safe, non-authorizing default.
func PSuccess(action domain.Action, method string, priorAttempts int) float64 {
	base, ok := actionBaseRate[action]
	if !ok || base == 0 {
		return 0
	}
	m, ok := methodMultiplier[method]
	if !ok {
		m = defaultMethodMultiplier
	}
	if priorAttempts < 0 {
		priorAttempts = 0
	}
	p := base * m * math.Pow(attemptDecay, float64(priorAttempts))
	return clamp01(p)
}

func clamp01(x float64) float64 {
	switch {
	case x < 0:
		return 0
	case x > 1:
		return 1
	default:
		return x
	}
}
