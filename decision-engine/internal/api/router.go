package api

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/domain"
)

// Handlers serves the Phase 7 public API.
type Handlers struct {
	repo   Repository
	auth   Auth
	logger *slog.Logger
}

// NewHandlers builds the public-API handlers.
func NewHandlers(repo Repository, auth Auth, logger *slog.Logger) *Handlers {
	if logger == nil {
		logger = slog.Default()
	}
	return &Handlers{repo: repo, auth: auth, logger: logger}
}

// Register mounts every public route on mux with its auth tier (PLAN.md §9). Reads + override are
// merchant-gated; kill switch + policy-config are admin-gated.
func (h *Handlers) Register(mux *http.ServeMux) {
	m, a := h.auth.requireMerchant, h.auth.requireAdmin
	mux.HandleFunc("GET /v1/merchants/{id}/decisions", m(h.listRecentDecisions))
	mux.HandleFunc("GET /v1/merchants/{id}/payments/{payment_id}/decisions", m(h.listDecisionsByPayment))
	mux.HandleFunc("GET /v1/merchants/{id}/decisions/{decision_id}", m(h.getDecision))
	mux.HandleFunc("POST /v1/merchants/{id}/decisions/{decision_id}/override", m(h.override))
	mux.HandleFunc("GET /v1/merchants/{id}/metrics/recovery-summary", m(h.recoverySummary))
	mux.HandleFunc("GET /v1/merchants/{id}/audit/{payment_id}", m(h.auditByPayment))
	mux.HandleFunc("GET /v1/merchants/{id}/policy-config", m(h.getPolicyConfig))
	mux.HandleFunc("PUT /v1/merchants/{id}/policy-config", a(h.updatePolicyConfig))
	mux.HandleFunc("POST /v1/merchants/{id}/policy/kill-switch", a(h.killSwitch))
}

func (h *Handlers) listRecentDecisions(w http.ResponseWriter, r *http.Request) {
	merchantID := r.PathValue("id")
	limit := clampLimit(r.URL.Query().Get("limit"), 50, 200)
	rows, err := h.repo.ListRecentDecisions(r.Context(), merchantID, limit)
	if err != nil {
		h.fail(w, err, "list decisions")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"merchant_id": merchantID, "decisions": rows})
}

func (h *Handlers) listDecisionsByPayment(w http.ResponseWriter, r *http.Request) {
	merchantID := r.PathValue("id")
	paymentID := r.PathValue("payment_id")
	rows, err := h.repo.ListDecisionsByPayment(r.Context(), merchantID, paymentID)
	if err != nil {
		h.fail(w, err, "list decisions by payment")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"merchant_id": merchantID, "payment_id": paymentID, "decisions": rows})
}

func (h *Handlers) getDecision(w http.ResponseWriter, r *http.Request) {
	merchantID := r.PathValue("id")
	decisionID := r.PathValue("decision_id")
	d, err := h.repo.GetDecision(r.Context(), merchantID, decisionID)
	if err != nil {
		h.fail(w, err, "get decision")
		return
	}
	writeJSON(w, http.StatusOK, d)
}

type overrideRequest struct {
	Action string `json:"action"`
	Reason string `json:"reason"`
}

func (h *Handlers) override(w http.ResponseWriter, r *http.Request) {
	merchantID := r.PathValue("id")
	decisionID := r.PathValue("decision_id")
	var req overrideRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if req.Reason == "" {
		writeError(w, http.StatusBadRequest, "reason_required", "a manual override requires a reason (audited)")
		return
	}
	if !validAction(req.Action) {
		writeError(w, http.StatusBadRequest, "invalid_action", "action must be a valid recovery action")
		return
	}
	actor := "operator"
	if err := h.repo.RecordOverride(r.Context(), merchantID, decisionID, actor, req.Reason, req.Action); err != nil {
		h.fail(w, err, "record override")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "override_recorded", "decision_id": decisionID, "action": req.Action, "reason": req.Reason,
	})
}

func (h *Handlers) recoverySummary(w http.ResponseWriter, r *http.Request) {
	merchantID := r.PathValue("id")
	s, err := h.repo.RecoverySummary(r.Context(), merchantID)
	if err != nil {
		h.fail(w, err, "recovery summary")
		return
	}
	writeJSON(w, http.StatusOK, s)
}

func (h *Handlers) auditByPayment(w http.ResponseWriter, r *http.Request) {
	merchantID := r.PathValue("id")
	paymentID := r.PathValue("payment_id")
	rows, err := h.repo.AuditByPayment(r.Context(), merchantID, paymentID)
	if err != nil {
		h.fail(w, err, "audit by payment")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"merchant_id": merchantID, "payment_id": paymentID, "audit": rows})
}

func (h *Handlers) getPolicyConfig(w http.ResponseWriter, r *http.Request) {
	merchantID := r.PathValue("id")
	cfg, err := h.repo.GetPolicyConfig(r.Context(), merchantID)
	if err != nil {
		h.fail(w, err, "get policy config")
		return
	}
	writeJSON(w, http.StatusOK, cfg)
}

func (h *Handlers) updatePolicyConfig(w http.ResponseWriter, r *http.Request) {
	merchantID := r.PathValue("id")
	var cfg MerchantPolicyConfig
	if !decodeJSON(w, r, &cfg) {
		return
	}
	if cfg.MaxRetries < 0 || cfg.CooldownMinutes < 0 || cfg.DailyActionCap < 0 || cfg.AmountCeiling < 0 || cfg.MinERVThreshold < 0 {
		writeError(w, http.StatusBadRequest, "invalid_value", "policy values must be non-negative")
		return
	}
	if err := h.repo.UpdatePolicyConfig(r.Context(), merchantID, cfg, "operator"); err != nil {
		if errors.Is(err, ErrPolicyBounds) {
			writeError(w, http.StatusBadRequest, "policy_bounds_violation", err.Error())
			return
		}
		h.fail(w, err, "update policy config")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "policy_config_updated", "merchant_id": merchantID})
}

type killSwitchRequest struct {
	Scope   string `json:"scope"` // "merchant" | "global"
	Enabled bool   `json:"enabled"`
}

func (h *Handlers) killSwitch(w http.ResponseWriter, r *http.Request) {
	merchantID := r.PathValue("id")
	var req killSwitchRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	switch req.Scope {
	case "global":
		if err := h.repo.SetGlobalKillSwitch(r.Context(), req.Enabled, "admin"); err != nil {
			h.fail(w, err, "set global kill switch")
			return
		}
	case "merchant", "":
		if err := h.repo.SetMerchantKillSwitch(r.Context(), merchantID, req.Enabled, "admin"); err != nil {
			h.fail(w, err, "set merchant kill switch")
			return
		}
	default:
		writeError(w, http.StatusBadRequest, "invalid_scope", "scope must be 'merchant' or 'global'")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "kill_switch_updated", "scope": req.Scope, "enabled": req.Enabled})
}

// fail maps repository errors to HTTP responses without leaking internals.
func (h *Handlers) fail(w http.ResponseWriter, err error, op string) {
	if errors.Is(err, ErrNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "")
		return
	}
	h.logger.Error("api error", "op", op, "err", err)
	writeError(w, http.StatusInternalServerError, "internal_error", "")
}

func validAction(a string) bool {
	switch domain.Action(a) {
	case domain.ActionRetry, domain.ActionDelayedRetry, domain.ActionAltMethod,
		domain.ActionPaymentLink, domain.ActionNotify, domain.ActionEscalate, domain.ActionNoAction:
		return true
	}
	return false
}

func clampLimit(raw string, def, max int) int {
	if raw == "" {
		return def
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		return def
	}
	if n > max {
		return max
	}
	return n
}

func decodeJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code, detail string) {
	body := map[string]string{"error": code}
	if detail != "" {
		body["detail"] = detail
	}
	writeJSON(w, status, body)
}
