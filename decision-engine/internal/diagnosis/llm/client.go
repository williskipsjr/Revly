// Package llm is the Phase 4 LLM-backed diagnoser: a client for the Intelligence-plane
// diagnosis service (Python/FastAPI) that satisfies pipeline.Diagnoser.
//
// The decision plane — not the service — owns the fallback. On ANY failure (service down,
// connection refused, timeout, non-2xx, malformed JSON, or a response that violates the frozen
// diagnosis contract), Diagnose returns the deterministic Phase-2 rule-table result
// (diagnosis.Diagnose), tagged source=rule_based_fallback. This is what makes "kill the
// diagnosis service mid-demo → automatic, correct rule-based diagnosis, no pipeline stall"
// (PLAN.md §15) true regardless of what the remote service does or fails to do.
//
// Isolation is preserved: this client sends only the moneyless event slice (event_type,
// failure_reason, method, prior_attempts). No amount, merchant, or payment credential ever
// crosses to the intelligence plane. Confidence returned by the LLM stays a gate — it is never
// used as P(success); that lives in a separate code path (internal/successmodel).
package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/diagnosis"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/domain"
)

// expectedSchemaVersion mirrors schemas/diagnosis.schema.json's schema_version const. A
// response asserting a different version is rejected (→ fallback) rather than trusted.
const expectedSchemaVersion = "0.1.0"

// maxResponseBytes bounds the diagnosis response body defensively (a diagnosis is tiny).
const maxResponseBytes = 1 << 20 // 1 MiB

// Diagnoser calls the diagnosis service and falls back to the rule table on any failure.
// It implements pipeline.Diagnoser.
type Diagnoser struct {
	endpoint string
	client   *http.Client
	timeout  time.Duration
	logger   *slog.Logger
}

// New builds an LLM diagnoser targeting serviceURL (the diagnosis service base URL, e.g.
// http://diagnosis-service:8000). timeout bounds each call; a non-positive timeout falls back
// to 6s. A nil logger uses slog.Default().
func New(serviceURL string, timeout time.Duration, logger *slog.Logger) *Diagnoser {
	if timeout <= 0 {
		timeout = 6 * time.Second
	}
	if logger == nil {
		logger = slog.Default()
	}
	return &Diagnoser{
		endpoint: strings.TrimRight(serviceURL, "/") + "/internal/diagnose",
		// The per-request context deadline is the real bound; this is a backstop so a stuck
		// connection can never outlive the timeout even if the caller's context lacks one.
		client:  &http.Client{Timeout: timeout},
		timeout: timeout,
		logger:  logger,
	}
}

// Diagnose returns the LLM diagnosis, or the deterministic rule-table diagnosis on any failure.
// It never returns an error: the pipeline always receives a valid, contract-shaped diagnosis.
func (d *Diagnoser) Diagnose(ctx context.Context, in diagnosis.Input) diagnosis.Diagnosis {
	diag, err := d.call(ctx, in)
	if err != nil {
		d.logger.Warn("llm diagnosis unavailable; falling back to rule-based table",
			"err", err,
			"event_type", in.EventType,
			"method", in.Method,
		)
		return diagnosis.Diagnose(in) // source = rule_based_fallback
	}
	return diag
}

// diagnoseRequest is the moneyless event slice sent to the service. It intentionally mirrors
// diagnosis.Input — no amount, no merchant.
type diagnoseRequest struct {
	EventType     string `json:"event_type"`
	FailureReason string `json:"failure_reason"`
	Method        string `json:"method"`
	PriorAttempts int    `json:"prior_attempts"`
}

// diagnoseResponse is the schema-valid body returned by the service. Optional contract fields
// we do not consume (created_at, payment_event_id) are simply ignored.
type diagnoseResponse struct {
	SchemaVersion    string   `json:"schema_version"`
	RootCause        string   `json:"root_cause"`
	Confidence       float64  `json:"confidence"`
	Rationale        string   `json:"rationale"`
	CandidateActions []string `json:"candidate_actions"`
	ModelVersion     string   `json:"model_version"`
	Source           string   `json:"source"`
}

// call performs the HTTP request, validates the response against the diagnosis contract, and
// maps it to a diagnosis.Diagnosis tagged source=llm. Any failure is returned as an error so
// Diagnose falls back.
func (d *Diagnoser) call(ctx context.Context, in diagnosis.Input) (diagnosis.Diagnosis, error) {
	reqCtx, cancel := context.WithTimeout(ctx, d.timeout)
	defer cancel()

	body, err := json.Marshal(diagnoseRequest{
		EventType:     in.EventType,
		FailureReason: in.FailureReason,
		Method:        in.Method,
		PriorAttempts: in.PriorAttempts,
	})
	if err != nil {
		return diagnosis.Diagnosis{}, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(reqCtx, http.MethodPost, d.endpoint, bytes.NewReader(body))
	if err != nil {
		return diagnosis.Diagnosis{}, fmt.Errorf("build request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := d.client.Do(httpReq)
	if err != nil {
		return diagnosis.Diagnosis{}, fmt.Errorf("call diagnosis service: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return diagnosis.Diagnosis{}, fmt.Errorf("diagnosis service status %d", resp.StatusCode)
	}

	var out diagnoseResponse
	dec := json.NewDecoder(io.LimitReader(resp.Body, maxResponseBytes))
	if err := dec.Decode(&out); err != nil {
		return diagnosis.Diagnosis{}, fmt.Errorf("decode response: %w", err)
	}

	return validate(out)
}

// validate enforces the frozen diagnosis contract (schemas/diagnosis.schema.json) in Go — enum
// membership, confidence range, non-empty rationale, and a non-empty candidate list of valid
// actions — without a JSON-schema dependency. A violation is an error (→ fallback), never a
// partial/garbage diagnosis handed to the pipeline.
func validate(out diagnoseResponse) (diagnosis.Diagnosis, error) {
	if out.SchemaVersion != "" && out.SchemaVersion != expectedSchemaVersion {
		return diagnosis.Diagnosis{}, fmt.Errorf("unexpected schema_version %q", out.SchemaVersion)
	}
	cause, ok := rootCause(out.RootCause)
	if !ok {
		return diagnosis.Diagnosis{}, fmt.Errorf("invalid root_cause %q", out.RootCause)
	}
	if out.Confidence < 0 || out.Confidence > 1 {
		return diagnosis.Diagnosis{}, fmt.Errorf("confidence %v out of [0,1]", out.Confidence)
	}
	if out.Rationale == "" {
		return diagnosis.Diagnosis{}, fmt.Errorf("empty rationale")
	}
	if len(out.CandidateActions) == 0 {
		return diagnosis.Diagnosis{}, fmt.Errorf("empty candidate_actions")
	}
	if out.ModelVersion == "" {
		return diagnosis.Diagnosis{}, fmt.Errorf("empty model_version")
	}
	actions := make([]domain.Action, 0, len(out.CandidateActions))
	seen := make(map[domain.Action]bool, len(out.CandidateActions))
	for _, s := range out.CandidateActions {
		a, ok := action(s)
		if !ok {
			return diagnosis.Diagnosis{}, fmt.Errorf("invalid candidate action %q", s)
		}
		if seen[a] {
			continue // tolerate a duplicate by de-duplicating rather than failing
		}
		seen[a] = true
		actions = append(actions, a)
	}

	return diagnosis.Diagnosis{
		RootCause:        cause,
		Confidence:       out.Confidence,
		Rationale:        out.Rationale,
		CandidateActions: actions,
		ModelVersion:     out.ModelVersion,
		Source:           diagnosis.SourceLLM,
	}, nil
}

var rootCauses = map[string]domain.RootCause{
	string(domain.RootTemporaryBankDecline): domain.RootTemporaryBankDecline,
	string(domain.RootInsufficientFunds):    domain.RootInsufficientFunds,
	string(domain.RootExpiredMethod):        domain.RootExpiredMethod,
	string(domain.RootCheckoutAbandonment):  domain.RootCheckoutAbandonment,
	string(domain.RootChronicFailure):       domain.RootChronicFailure,
	string(domain.RootFraudSuspected):       domain.RootFraudSuspected,
	string(domain.RootUnknown):              domain.RootUnknown,
}

var actions = map[string]domain.Action{
	string(domain.ActionRetry):        domain.ActionRetry,
	string(domain.ActionDelayedRetry): domain.ActionDelayedRetry,
	string(domain.ActionAltMethod):    domain.ActionAltMethod,
	string(domain.ActionPaymentLink):  domain.ActionPaymentLink,
	string(domain.ActionNotify):       domain.ActionNotify,
	string(domain.ActionEscalate):     domain.ActionEscalate,
	string(domain.ActionNoAction):     domain.ActionNoAction,
}

func rootCause(s string) (domain.RootCause, bool) {
	c, ok := rootCauses[s]
	return c, ok
}

func action(s string) (domain.Action, bool) {
	a, ok := actions[s]
	return a, ok
}
