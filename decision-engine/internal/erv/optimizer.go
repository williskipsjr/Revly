// Package erv is the Phase 2 economic layer: it computes each candidate action's Expected
// Recoverable Value and ranks candidates by it. Per PLAN.md §5, economics *ranks* actions;
// it never encodes risk or safety — that is the policy engine's job alone. This package
// therefore takes no fraud/confidence input and applies no ALLOW/BLOCK judgment.
//
// Core formula (PLAN.md §5), merchant-aware and deliberately small:
//
//	ERV(a | context, merchant) =
//	      P(success | context, a) × recoverable_amount
//	    − cost(a, merchant)
//	    − friction_penalty(a, merchant)
//
// where friction_penalty(a, merchant) = merchant friction_weight × a fixed per-action
// friction score (a platform constant). LLM confidence and risk signals are explicitly NOT
// terms here.
//
// The package is pure (no I/O), so it is property-testable: ERV is never NaN and is
// monotonic non-decreasing in P(success).
package erv

import (
	"sort"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/domain"
)

// baseFrictionScore is the platform's fixed per-action friction score, in minor units
// (paise-scale, so it is directly subtractable from P(success)×amount). The merchant's
// friction_weight multiplies it to yield the friction penalty (PLAN.md §5): a premium
// merchant sets a higher weight, so the same action annoys its customers "more".
// Charge re-attempts are near-invisible to the customer (low score); actions that demand
// customer effort (alt_method, payment_link) or human contact (escalate) score higher.
var baseFrictionScore = map[domain.Action]float64{
	domain.ActionRetry:        500,
	domain.ActionDelayedRetry: 300,
	domain.ActionAltMethod:    3000,
	domain.ActionPaymentLink:  3000,
	domain.ActionNotify:       1500,
	domain.ActionEscalate:     8000,
	domain.ActionNoAction:     0,
}

// BaseFrictionScore exposes the platform friction score for an action (0 for unknowns), so
// callers/tests can reason about the friction term without duplicating the table.
func BaseFrictionScore(a domain.Action) float64 { return baseFrictionScore[a] }

// Input is one candidate's ERV inputs. PSuccess comes from internal/successmodel;
// RecoverableAmount is read from the payment (paise); Cost and FrictionWeight come from the
// merchant's action-cost config.
type Input struct {
	Action            domain.Action
	PSuccess          float64
	RecoverableAmount int64   // paise
	Cost              float64 // merchant monetary cost, minor units
	FrictionWeight    float64 // merchant friction weight (multiplier)
}

// Candidate is one candidate's full ERV term breakdown — persisted per-term to erv_scores
// (PLAN.md §8) so a decision's economics are fully reconstructable and the dashboard can
// show P(success)×amount, cost, and friction_penalty separately (PLAN.md §10).
type Candidate struct {
	Action            domain.Action
	PSuccess          float64
	RecoverableAmount int64
	Cost              float64
	FrictionPenalty   float64
	ERV               float64
}

// Compute evaluates the ERV formula for a single candidate.
func Compute(in Input) Candidate {
	friction := in.FrictionWeight * baseFrictionScore[in.Action]
	erv := in.PSuccess*float64(in.RecoverableAmount) - in.Cost - friction
	return Candidate{
		Action:            in.Action,
		PSuccess:          in.PSuccess,
		RecoverableAmount: in.RecoverableAmount,
		Cost:              in.Cost,
		FrictionPenalty:   friction,
		ERV:               erv,
	}
}

// Rank computes ERV for every input and returns the candidates sorted by ERV descending.
// The sort is stable, so candidates with equal ERV keep their input order (the diagnosis's
// rule-preference order). Ranking alone authorizes nothing — the ranked slice is handed to
// the policy engine, which is the only layer that may allow or block a candidate.
func Rank(inputs []Input) []Candidate {
	out := make([]Candidate, len(inputs))
	for i, in := range inputs {
		out[i] = Compute(in)
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].ERV > out[j].ERV })
	return out
}
