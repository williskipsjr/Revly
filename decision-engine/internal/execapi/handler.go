// Package execapi exposes the Phase 6 internal, service-to-service execution endpoints
// (PLAN.md §9, never public):
//
//	POST /internal/execute-action            — idempotently dispatch one policy-authorized action
//	POST /internal/reconcile-pending-actions — settle pending_confirmation actions
//
// These never run policy — they execute an action the decision plane already authorized. The
// unique idempotency_key makes execute-action safe to call repeatedly (no duplicate financial
// action), and reconcile is the ambiguous-outcome settlement path (PLAN.md §8/§12).
package execapi

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/domain"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/executor"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/pipeline"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/reconcile"
)

// Repo is the persistence subset execute-action needs (implemented by internal/store).
type Repo interface {
	FinalizeExecution(ctx context.Context, rec pipeline.ExecutionRecord) (bool, error)
	RecordPendingAction(ctx context.Context, rec pipeline.PendingActionRecord) (bool, error)
}

// Handlers serves the internal execution endpoints.
type Handlers struct {
	dispatcher executor.Dispatcher
	repo       Repo
	reconciler *reconcile.Reconciler
	logger     *slog.Logger
}

func NewHandlers(dispatcher executor.Dispatcher, repo Repo, reconciler *reconcile.Reconciler, logger *slog.Logger) *Handlers {
	if logger == nil {
		logger = slog.Default()
	}
	return &Handlers{dispatcher: dispatcher, repo: repo, reconciler: reconciler, logger: logger}
}

// Register mounts the internal endpoints on mux.
func (h *Handlers) Register(mux *http.ServeMux) {
	mux.HandleFunc("POST /internal/execute-action", h.executeAction)
	mux.HandleFunc("POST /internal/reconcile-pending-actions", h.reconcilePending)
}

type executeRequest struct {
	DecisionID string `json:"decision_id"`
	PaymentID  string `json:"payment_id"`
	MerchantID string `json:"merchant_id"`
	Action     string `json:"action"`
	Amount     int64  `json:"amount"`
}

type executeResponse struct {
	Status         string `json:"action_status"`
	Created        bool   `json:"created"` // false = duplicate (idempotent no-op)
	Recovered      bool   `json:"recovered"`
	RecoveryState  string `json:"recovery_state"`
	IdempotencyKey string `json:"idempotency_key"`
}

func (h *Handlers) executeAction(w http.ResponseWriter, r *http.Request) {
	var req executeRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if req.DecisionID == "" || req.PaymentID == "" || req.MerchantID == "" {
		writeError(w, http.StatusBadRequest, "missing_ids")
		return
	}
	action := domain.Action(req.Action)
	if action == domain.ActionNoAction || !validAction(action) {
		writeError(w, http.StatusBadRequest, "invalid_action")
		return
	}
	if req.Amount < 0 {
		writeError(w, http.StatusBadRequest, "invalid_amount")
		return
	}

	key := executor.IdempotencyKey(req.PaymentID, req.DecisionID, action)
	out, err := h.dispatcher.Dispatch(r.Context(), action, req.Amount, key)
	if err != nil {
		h.logger.Error("execute-action dispatch failed", "err", err)
		writeError(w, http.StatusBadGateway, "dispatch_failed")
		return
	}

	// Ambiguous outcome → persist pending_confirmation for the reconciler.
	if out.Status == domain.ActionStatusPendingConfirmation {
		created, perr := h.repo.RecordPendingAction(r.Context(), pipeline.PendingActionRecord{
			DecisionID: req.DecisionID, MerchantID: req.MerchantID, PaymentID: req.PaymentID,
			Action: action, IdempotencyKey: key, ExternalIdempotencyKey: out.ExternalRef,
			PendingState: domain.StateActionPending,
			StateHistory: []domain.RecoveryState{domain.StateActionPending},
		})
		if perr != nil {
			writeError(w, http.StatusInternalServerError, "persist_failed")
			return
		}
		writeJSON(w, http.StatusOK, executeResponse{
			Status: string(domain.ActionStatusPendingConfirmation), Created: created,
			RecoveryState: string(domain.StateActionPending), IdempotencyKey: key,
		})
		return
	}

	finalState := domain.StateStopped
	history := []domain.RecoveryState{domain.StateActionPending, domain.StateFailed, domain.StateReEvaluate, domain.StateStopped}
	var recoveredAmount *int64
	if out.Recovered {
		finalState = domain.StateDone
		history = []domain.RecoveryState{domain.StateActionPending, domain.StateRecovered, domain.StateDone}
		amt := out.RecoveredAmount
		recoveredAmount = &amt
	}

	created, err := h.repo.FinalizeExecution(r.Context(), pipeline.ExecutionRecord{
		DecisionID: req.DecisionID, MerchantID: req.MerchantID, PaymentID: req.PaymentID,
		Action: action, IdempotencyKey: key, ExternalIdempotencyKey: out.ExternalRef,
		ActionStatus: out.Status, OutcomeResult: out.Result, Recovered: out.Recovered,
		RecoveredAmount: recoveredAmount, FinalState: finalState, StateHistory: history,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "persist_failed")
		return
	}
	writeJSON(w, http.StatusOK, executeResponse{
		Status: string(out.Status), Created: created, Recovered: out.Recovered,
		RecoveryState: string(finalState), IdempotencyKey: key,
	})
}

type reconcileRequest struct {
	Limit int `json:"limit,omitempty"`
}

func (h *Handlers) reconcilePending(w http.ResponseWriter, r *http.Request) {
	var req reconcileRequest
	// Body is optional; ignore decode errors on an empty body.
	_ = json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<16)).Decode(&req)
	if h.reconciler == nil {
		writeError(w, http.StatusServiceUnavailable, "reconciler_unavailable")
		return
	}
	rep, err := h.reconciler.ReconcileOnce(r.Context(), req.Limit)
	if err != nil {
		h.logger.Error("reconcile failed", "err", err)
		writeError(w, http.StatusInternalServerError, "reconcile_failed")
		return
	}
	writeJSON(w, http.StatusOK, rep)
}

func validAction(a domain.Action) bool {
	switch a {
	case domain.ActionRetry, domain.ActionDelayedRetry, domain.ActionAltMethod,
		domain.ActionPaymentLink, domain.ActionNotify, domain.ActionEscalate, domain.ActionNoAction:
		return true
	}
	return false
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
