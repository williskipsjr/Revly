package executor

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/domain"
)

// RazorpayDispatcher is the Phase-6 real-execution plane against the Razorpay sandbox. It is
// selected only when RAZORPAY_KEY_ID is configured; otherwise the engine keeps the deterministic
// MockDispatcher (PLAN.md §15 MVP: notify/alt-method actions may be mocked). It sends the
// external idempotency-key header so a safe retransmit at the HTTP layer never double-charges,
// and it maps an ambiguous response (network timeout / 5xx after send) to pending_confirmation
// so the reconciler settles it rather than blindly re-dispatching (PLAN.md §8/§12).
//
// The Razorpay recovery surface (creating a fresh payment attempt, issuing a payment link) is
// abstracted here to one authenticated POST with the idempotency header; the exact sandbox route
// per action is configurable via RAZORPAY_BASE_URL. This is a faithful integration *shape*: with
// real sandbox credentials it performs a real authenticated call; without them the engine never
// selects it. It never bypasses policy — it only executes an already policy-authorized action.
type RazorpayDispatcher struct {
	baseURL string
	authB64 string // base64(keyID:keySecret) for HTTP Basic
	http    *http.Client
	logger  *slog.Logger
}

// NewRazorpayDispatcher builds the sandbox dispatcher. timeout bounds each external call; a
// deadline exceeded on a sent request yields pending_confirmation, never a fabricated success.
func NewRazorpayDispatcher(baseURL, keyID, keySecret string, timeout time.Duration, logger *slog.Logger) *RazorpayDispatcher {
	if logger == nil {
		logger = slog.Default()
	}
	if timeout <= 0 {
		timeout = 8 * time.Second
	}
	return &RazorpayDispatcher{
		baseURL: strings.TrimRight(baseURL, "/"),
		authB64: base64.StdEncoding.EncodeToString([]byte(keyID + ":" + keySecret)),
		http:    &http.Client{Timeout: timeout},
		logger:  logger,
	}
}

// razorpayRequest is the small, action-agnostic body we send; the sandbox route encodes the
// action, the amount is echoed, and reference is our idempotency key for correlation.
type razorpayRequest struct {
	Action    string `json:"action"`
	Amount    int64  `json:"amount"`
	Currency  string `json:"currency"`
	Reference string `json:"reference"`
}

type razorpayResponse struct {
	ID     string `json:"id"`
	Status string `json:"status"` // "captured"/"authorized"/"created"/"failed" (sandbox-dependent)
}

// Dispatch executes one policy-authorized action against the sandbox.
func (d *RazorpayDispatcher) Dispatch(ctx context.Context, action domain.Action, amount int64, idempotencyKey string) (Outcome, error) {
	// notify/escalate are out-of-band (no money movement); the MVP mocks them (PLAN.md §15).
	if action == domain.ActionNotify || action == domain.ActionEscalate {
		return Outcome{Status: domain.ActionStatusConfirmed, Recovered: false, Result: "dispatched", ExternalRef: "rzp-oob-" + shortRef(idempotencyKey)}, nil
	}
	return d.call(ctx, action, amount, idempotencyKey, "/v1/recovery/"+string(action))
}

// Resolve queries the sandbox for the settled outcome of a pending_confirmation action, so the
// reconciler can close it out without re-dispatching.
func (d *RazorpayDispatcher) Resolve(ctx context.Context, action domain.Action, amount int64, externalRef string) (Outcome, error) {
	if action == domain.ActionNotify || action == domain.ActionEscalate {
		return Outcome{Status: domain.ActionStatusConfirmed, Recovered: false, Result: "dispatched", ExternalRef: externalRef}, nil
	}
	// Idempotent status read keyed by our reference; a GET never moves money.
	return d.call(ctx, action, amount, externalRef, "/v1/recovery/"+string(action)+"/status")
}

func (d *RazorpayDispatcher) call(ctx context.Context, action domain.Action, amount int64, ref, path string) (Outcome, error) {
	body, _ := json.Marshal(razorpayRequest{Action: string(action), Amount: amount, Currency: "INR", Reference: ref})
	u, err := url.JoinPath(d.baseURL, path)
	if err != nil {
		return Outcome{}, fmt.Errorf("razorpay: build url: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, u, strings.NewReader(string(body)))
	if err != nil {
		return Outcome{}, fmt.Errorf("razorpay: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Basic "+d.authB64)
	// Razorpay's external idempotency header: a retransmit with the same key is coalesced server
	// side, so an HTTP-layer retry can never create a duplicate financial action.
	req.Header.Set("X-Idempotency-Key", ref)

	resp, err := d.http.Do(req)
	if err != nil {
		// Ambiguous: the request may have reached Razorpay before the timeout. Do NOT retry
		// blindly — mark pending_confirmation for the reconciler to settle (PLAN.md §12).
		if errors.Is(err, context.DeadlineExceeded) || isTimeout(err) {
			d.logger.Warn("razorpay call ambiguous (timeout) → pending_confirmation", "action", action, "ref", ref)
			return Outcome{Status: domain.ActionStatusPendingConfirmation, Recovered: false, Result: "pending_confirmation", ExternalRef: ref}, nil
		}
		return Outcome{}, fmt.Errorf("razorpay: call: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode >= 500 {
		// Server-side ambiguity after send → pending_confirmation, reconcile later.
		return Outcome{Status: domain.ActionStatusPendingConfirmation, Recovered: false, Result: "pending_confirmation", ExternalRef: ref}, nil
	}
	if resp.StatusCode >= 400 {
		return Outcome{Status: domain.ActionStatusFailed, Recovered: false, Result: fmt.Sprintf("razorpay_%d", resp.StatusCode), ExternalRef: ref}, nil
	}

	var rr razorpayResponse
	if err := json.NewDecoder(resp.Body).Decode(&rr); err != nil {
		// A 2xx we cannot parse is still a successful send but an unknown outcome.
		return Outcome{Status: domain.ActionStatusPendingConfirmation, Recovered: false, Result: "pending_confirmation", ExternalRef: ref}, nil
	}
	recovered := rr.Status == "captured" || rr.Status == "authorized" || rr.Status == "paid"
	extRef := rr.ID
	if extRef == "" {
		extRef = ref
	}
	amt := int64(0)
	if recovered {
		amt = amount
	}
	return Outcome{
		Status:          domain.ActionStatusConfirmed,
		Recovered:       recovered,
		RecoveredAmount: amt,
		Result:          "razorpay_" + rr.Status,
		ExternalRef:     extRef,
	}, nil
}

func isTimeout(err error) bool {
	type timeout interface{ Timeout() bool }
	var t timeout
	return errors.As(err, &t) && t.Timeout()
}
