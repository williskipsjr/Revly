package llm

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/diagnosis"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/domain"
)

// declineInput is a transient-decline event; the rule table maps it to temporary_bank_decline,
// so fallback assertions have a known-good expected diagnosis.
var declineInput = diagnosis.Input{
	EventType:     "payment.failed",
	FailureReason: "Issuer declined, please try again",
	Method:        "card",
	PriorAttempts: 0,
}

const validBody = `{
  "schema_version": "0.1.0",
  "root_cause": "expired_method",
  "confidence": 0.82,
  "rationale": "Card reported expired by issuer.",
  "candidate_actions": ["alt_method", "payment_link", "no_action"],
  "model_version": "claude-sonnet-5",
  "source": "llm",
  "payment_event_id": null,
  "created_at": null
}`

func newDiagnoser(t *testing.T, url string, timeout time.Duration) *Diagnoser {
	t.Helper()
	return New(url, timeout, nil)
}

// TestDiagnose_Success: a valid response is mapped to source=llm with all fields validated,
// and the request carries only the moneyless event slice (isolation invariant).
func TestDiagnose_Success(t *testing.T) {
	var gotPath string
	var gotBody map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &gotBody)
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, validBody)
	}))
	defer srv.Close()

	d := newDiagnoser(t, srv.URL, time.Second)
	got := d.Diagnose(context.Background(), declineInput)

	if got.Source != diagnosis.SourceLLM {
		t.Fatalf("source = %q, want llm", got.Source)
	}
	if got.RootCause != domain.RootExpiredMethod {
		t.Fatalf("root cause = %q, want expired_method", got.RootCause)
	}
	if got.Confidence != 0.82 {
		t.Fatalf("confidence = %v, want 0.82", got.Confidence)
	}
	if got.ModelVersion != "claude-sonnet-5" {
		t.Fatalf("model version = %q", got.ModelVersion)
	}
	wantActions := []domain.Action{domain.ActionAltMethod, domain.ActionPaymentLink, domain.ActionNoAction}
	if len(got.CandidateActions) != len(wantActions) {
		t.Fatalf("candidate actions = %v, want %v", got.CandidateActions, wantActions)
	}
	for i, a := range wantActions {
		if got.CandidateActions[i] != a {
			t.Fatalf("candidate[%d] = %q, want %q", i, got.CandidateActions[i], a)
		}
	}

	// Endpoint + isolation: correct path, and the body carries ONLY the moneyless fields.
	if gotPath != "/internal/diagnose" {
		t.Errorf("request path = %q, want /internal/diagnose", gotPath)
	}
	for _, forbidden := range []string{"amount", "merchant_id", "recoverable_amount"} {
		if _, ok := gotBody[forbidden]; ok {
			t.Errorf("request leaked forbidden field %q to intelligence plane: %v", forbidden, gotBody)
		}
	}
	if gotBody["event_type"] != "payment.failed" {
		t.Errorf("request event_type = %v, want payment.failed", gotBody["event_type"])
	}
}

// TestDiagnose_FallbackPaths: every failure mode must return the deterministic rule-table
// diagnosis (source=rule_based_fallback), never an error or a partial result.
func TestDiagnose_FallbackPaths(t *testing.T) {
	want := diagnosis.Diagnose(declineInput) // the expected fallback

	cases := []struct {
		name    string
		status  int
		body    string
		handler http.HandlerFunc // overrides status/body when set
	}{
		{name: "non-200", status: http.StatusBadGateway, body: `{"error":"llm_failed"}`},
		{name: "service unavailable", status: http.StatusServiceUnavailable, body: `{"error":"llm_unavailable"}`},
		{name: "malformed json", status: 200, body: `{not json`},
		{name: "invalid root_cause", status: 200, body: `{"root_cause":"aliens","confidence":0.5,"rationale":"x","candidate_actions":["retry"],"model_version":"m"}`},
		{name: "invalid action", status: 200, body: `{"root_cause":"unknown","confidence":0.5,"rationale":"x","candidate_actions":["teleport"],"model_version":"m"}`},
		{name: "confidence too high", status: 200, body: `{"root_cause":"unknown","confidence":1.5,"rationale":"x","candidate_actions":["retry"],"model_version":"m"}`},
		{name: "confidence negative", status: 200, body: `{"root_cause":"unknown","confidence":-0.1,"rationale":"x","candidate_actions":["retry"],"model_version":"m"}`},
		{name: "empty candidate_actions", status: 200, body: `{"root_cause":"unknown","confidence":0.5,"rationale":"x","candidate_actions":[],"model_version":"m"}`},
		{name: "empty rationale", status: 200, body: `{"root_cause":"unknown","confidence":0.5,"rationale":"","candidate_actions":["retry"],"model_version":"m"}`},
		{name: "empty model_version", status: 200, body: `{"root_cause":"unknown","confidence":0.5,"rationale":"x","candidate_actions":["retry"],"model_version":""}`},
		{name: "wrong schema_version", status: 200, body: `{"schema_version":"9.9.9","root_cause":"unknown","confidence":0.5,"rationale":"x","candidate_actions":["retry"],"model_version":"m"}`},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(tc.status)
				_, _ = io.WriteString(w, tc.body)
			}))
			defer srv.Close()

			got := newDiagnoser(t, srv.URL, time.Second).Diagnose(context.Background(), declineInput)
			assertRuleFallback(t, got, want)
		})
	}
}

// TestDiagnose_ConnectionRefused: the service being down (killed mid-demo) falls back cleanly.
func TestDiagnose_ConnectionRefused(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	url := srv.URL
	srv.Close() // port is now closed → dial error

	got := newDiagnoser(t, url, time.Second).Diagnose(context.Background(), declineInput)
	assertRuleFallback(t, got, diagnosis.Diagnose(declineInput))
}

// TestDiagnose_Timeout: a slow service is bounded and falls back rather than stalling.
func TestDiagnose_Timeout(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Return promptly once the client cancels (on timeout) so Close() doesn't block.
		select {
		case <-time.After(2 * time.Second):
		case <-r.Context().Done():
		}
	}))
	defer srv.Close()

	got := newDiagnoser(t, srv.URL, 20*time.Millisecond).Diagnose(context.Background(), declineInput)
	assertRuleFallback(t, got, diagnosis.Diagnose(declineInput))
}

func assertRuleFallback(t *testing.T, got, want diagnosis.Diagnosis) {
	t.Helper()
	if got.Source != diagnosis.SourceRuleBased {
		t.Fatalf("source = %q, want rule_based_fallback", got.Source)
	}
	if got.RootCause != want.RootCause {
		t.Fatalf("fallback root cause = %q, want %q (rule table)", got.RootCause, want.RootCause)
	}
	if got.ModelVersion != want.ModelVersion {
		t.Fatalf("fallback model version = %q, want %q", got.ModelVersion, want.ModelVersion)
	}
	if len(got.CandidateActions) == 0 {
		t.Fatal("fallback must never yield an empty candidate list")
	}
}
