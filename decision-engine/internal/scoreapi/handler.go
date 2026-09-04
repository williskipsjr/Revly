// Package scoreapi exposes the Phase 3 internal, service-to-service endpoints (PLAN.md §9,
// "never public"):
//
//	POST /internal/success-model/score  — P(success) per candidate action for a context
//	POST /internal/erv/compute          — the per-term ERV breakdown for a merchant + context
//
// Both are thin, read-only wrappers over the exact same pure functions the recovery pipeline
// uses in-process (internal/successmodel + internal/erv), so what they report always matches
// what the pipeline decides. Neither persists anything. They exist for explainability and for
// the merchant/operator dashboard (Phase 8): "why did this action win, per ERV term?"
//
// Economics only: these endpoints never apply policy/safety (ALLOW/BLOCK) — that is the policy
// engine's job alone (PLAN.md §5). They rank; they do not authorize.
package scoreapi

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/domain"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/erv"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/pipeline"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/successmodel"
)

// defaultActions is the intervention set scored when a request omits an explicit action list.
// no_action is excluded: it is the P=0 baseline, not something to score.
var defaultActions = []domain.Action{
	domain.ActionRetry, domain.ActionDelayedRetry, domain.ActionAltMethod,
	domain.ActionPaymentLink, domain.ActionNotify, domain.ActionEscalate,
}

// CostSource supplies a merchant's per-action cost/friction config for /internal/erv/compute.
// Implemented by internal/store.
type CostSource interface {
	MerchantActionCosts(ctx context.Context, merchantID string) (map[domain.Action]pipeline.ActionCost, error)
}

// Handlers bundles the dependencies the internal endpoints need.
type Handlers struct {
	scorer successmodel.Scorer
	costs  CostSource
}

// NewHandlers builds the internal-API handlers. costs may be nil (then /internal/erv/compute
// returns 503), which lets the endpoint set degrade cleanly when the DB is not configured.
func NewHandlers(scorer successmodel.Scorer, costs CostSource) *Handlers {
	return &Handlers{scorer: scorer, costs: costs}
}

type scoreRequest struct {
	Method        string   `json:"method"`
	PriorAttempts int      `json:"prior_attempts"`
	Amount        int64    `json:"amount"`
	Actions       []string `json:"actions,omitempty"`
}

type scoreItem struct {
	Action   string  `json:"action"`
	PSuccess float64 `json:"p_success"`
}

type scoreResponse struct {
	ModelVersion string      `json:"model_version"`
	Scores       []scoreItem `json:"scores"`
}

// Score handles POST /internal/success-model/score.
func (h *Handlers) Score(w http.ResponseWriter, r *http.Request) {
	var req scoreRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if req.Amount < 0 {
		writeError(w, http.StatusBadRequest, "invalid_amount")
		return
	}
	feats := successmodel.Features{Method: req.Method, PriorAttempts: req.PriorAttempts, Amount: req.Amount}
	actions := resolveActions(req.Actions)

	scores := make([]scoreItem, 0, len(actions))
	for _, a := range actions {
		scores = append(scores, scoreItem{Action: string(a), PSuccess: h.scorer.Score(a, feats)})
	}
	writeJSON(w, http.StatusOK, scoreResponse{ModelVersion: h.scorer.Version(), Scores: scores})
}

type ervRequest struct {
	MerchantID    string   `json:"merchant_id"`
	Method        string   `json:"method"`
	PriorAttempts int      `json:"prior_attempts"`
	Amount        int64    `json:"amount"`
	Actions       []string `json:"actions,omitempty"`
}

type ervCandidate struct {
	Action            string  `json:"action"`
	PSuccess          float64 `json:"p_success"`
	RecoverableAmount int64   `json:"recoverable_amount"`
	Cost              float64 `json:"cost"`
	FrictionPenalty   float64 `json:"friction_penalty"`
	ERV               float64 `json:"erv"`
}

type ervResponse struct {
	MerchantID   string         `json:"merchant_id"`
	ModelVersion string         `json:"model_version"`
	Candidates   []ervCandidate `json:"candidates"` // ranked by ERV descending
}

// ErvCompute handles POST /internal/erv/compute.
func (h *Handlers) ErvCompute(w http.ResponseWriter, r *http.Request) {
	if h.costs == nil {
		writeError(w, http.StatusServiceUnavailable, "erv_compute_unavailable")
		return
	}
	var req ervRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if req.MerchantID == "" {
		writeError(w, http.StatusBadRequest, "missing_merchant_id")
		return
	}
	if req.Amount < 0 {
		writeError(w, http.StatusBadRequest, "invalid_amount")
		return
	}

	costs, err := h.costs.MerchantActionCosts(r.Context(), req.MerchantID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "cost_lookup_failed")
		return
	}
	if len(costs) == 0 {
		writeError(w, http.StatusNotFound, "merchant_not_found")
		return
	}

	feats := successmodel.Features{Method: req.Method, PriorAttempts: req.PriorAttempts, Amount: req.Amount}
	actions := resolveActions(req.Actions)

	inputs := make([]erv.Input, 0, len(actions))
	for _, a := range actions {
		c := costs[a]
		inputs = append(inputs, erv.Input{
			Action:            a,
			PSuccess:          h.scorer.Score(a, feats),
			RecoverableAmount: req.Amount,
			Cost:              c.MonetaryCost,
			FrictionWeight:    c.FrictionWeight,
		})
	}
	ranked := erv.Rank(inputs)

	out := make([]ervCandidate, len(ranked))
	for i, c := range ranked {
		out[i] = ervCandidate{
			Action:            string(c.Action),
			PSuccess:          c.PSuccess,
			RecoverableAmount: c.RecoverableAmount,
			Cost:              c.Cost,
			FrictionPenalty:   c.FrictionPenalty,
			ERV:               c.ERV,
		}
	}
	writeJSON(w, http.StatusOK, ervResponse{MerchantID: req.MerchantID, ModelVersion: h.scorer.Version(), Candidates: out})
}

// resolveActions maps requested action strings to domain actions, ignoring unknown/no_action
// values; an empty request scores the default intervention set.
func resolveActions(requested []string) []domain.Action {
	if len(requested) == 0 {
		return defaultActions
	}
	valid := map[domain.Action]bool{}
	for _, a := range defaultActions {
		valid[a] = true
	}
	out := make([]domain.Action, 0, len(requested))
	for _, s := range requested {
		a := domain.Action(s)
		if valid[a] {
			out = append(out, a)
		}
	}
	if len(out) == 0 {
		return defaultActions
	}
	return out
}

func decodeJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code string) {
	writeJSON(w, status, map[string]string{"error": code})
}
