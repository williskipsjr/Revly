package ingest

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// fakeIngestor simulates the store's DB-enforced idempotency in-memory so the handler's
// HTTP behavior can be tested without a database. The real idempotency guarantee lives in
// internal/store's integration tests against Postgres.
type fakeIngestor struct {
	calls int
	seen  map[string]string // external_event_id -> payment_event_id
	err   error
}

func (f *fakeIngestor) Ingest(_ context.Context, req IngestRequest) (IngestResult, error) {
	f.calls++
	if f.err != nil {
		return IngestResult{}, f.err
	}
	if f.seen == nil {
		f.seen = map[string]string{}
	}
	eid := req.Event.ExternalEventID
	if id, ok := f.seen[eid]; ok {
		return IngestResult{PaymentEventID: id, Created: false}, nil
	}
	id := "pe_" + eid
	f.seen[eid] = id
	return IngestResult{PaymentEventID: id, Created: true}, nil
}

const validBody = `{
  "schema_version": "0.1.0",
  "external_event_id": "evt_abc123",
  "merchant_id": "merch_1",
  "payment_id": "pay_abc123",
  "event_type": "payment.failed",
  "amount": 15000,
  "currency": "INR",
  "method": "card",
  "occurred_at": "2026-09-04T10:00:00Z"
}`

const path = "/v1/merchants/merch_1/events/payment-failed"

// serve mounts the handler on a real ServeMux so path routing and {id} extraction are
// exercised, then dispatches one request.
func serve(t *testing.T, ing Ingestor, secret string, req *http.Request) *httptest.ResponseRecorder {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/merchants/{id}/events/payment-failed", NewHandler(ing, nil, secret, nil))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	return rec
}

func postReq(body string) *http.Request {
	return httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
}

func TestHandler_NewReturns201(t *testing.T) {
	rec := serve(t, &fakeIngestor{}, "", postReq(validBody))
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d (%s)", rec.Code, rec.Body.String())
	}
	var resp ingestResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.Duplicate || resp.Status != "ingested" || resp.PaymentEventID == "" {
		t.Fatalf("unexpected response: %+v", resp)
	}
	if resp.ExternalEventID != "evt_abc123" {
		t.Fatalf("expected external_event_id echoed, got %q", resp.ExternalEventID)
	}
}

func TestHandler_DuplicateReturns200(t *testing.T) {
	ing := &fakeIngestor{}
	if rec := serve(t, ing, "", postReq(validBody)); rec.Code != http.StatusCreated {
		t.Fatalf("first post expected 201, got %d", rec.Code)
	}
	rec := serve(t, ing, "", postReq(validBody))
	if rec.Code != http.StatusOK {
		t.Fatalf("duplicate expected 200, got %d (%s)", rec.Code, rec.Body.String())
	}
	var resp ingestResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	if !resp.Duplicate || resp.Status != "duplicate" {
		t.Fatalf("expected duplicate response, got %+v", resp)
	}
	if ing.calls != 2 {
		t.Fatalf("expected ingestor called twice, got %d", ing.calls)
	}
}

func TestHandler_ClientErrors(t *testing.T) {
	cases := []struct {
		name string
		body string
		want int
		code string
	}{
		{"invalid json", `{`, http.StatusBadRequest, "invalid_json"},
		{"unknown field", `{"schema_version":"0.1.0","surprise":true}`, http.StatusBadRequest, "invalid_json"},
		{"validation failed", strings.Replace(validBody, `"INR"`, `"USD"`, 1), http.StatusBadRequest, "validation_failed"},
		{"merchant mismatch", strings.Replace(validBody, `"merch_1"`, `"merch_9"`, 1), http.StatusBadRequest, "merchant_mismatch"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := serve(t, &fakeIngestor{}, "", postReq(tc.body))
			if rec.Code != tc.want {
				t.Fatalf("expected %d, got %d (%s)", tc.want, rec.Code, rec.Body.String())
			}
			var resp errorResponse
			_ = json.Unmarshal(rec.Body.Bytes(), &resp)
			if resp.Error != tc.code {
				t.Fatalf("expected error code %q, got %q", tc.code, resp.Error)
			}
		})
	}
}

func TestHandler_StoreErrorReturns500(t *testing.T) {
	rec := serve(t, &fakeIngestor{err: errors.New("db down")}, "", postReq(validBody))
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", rec.Code)
	}
	// Internal error detail must not leak to the caller.
	if strings.Contains(rec.Body.String(), "db down") {
		t.Fatalf("internal error leaked to response: %s", rec.Body.String())
	}
}

func TestHandler_SignatureEnforced(t *testing.T) {
	secret := "whsec_test"
	body := validBody

	// No signature → 401.
	if rec := serve(t, &fakeIngestor{}, secret, postReq(body)); rec.Code != http.StatusUnauthorized {
		t.Fatalf("missing signature expected 401, got %d", rec.Code)
	}

	// Bad signature → 401.
	bad := postReq(body)
	bad.Header.Set(SignatureHeader, "sha256=deadbeef")
	if rec := serve(t, &fakeIngestor{}, secret, bad); rec.Code != http.StatusUnauthorized {
		t.Fatalf("bad signature expected 401, got %d", rec.Code)
	}

	// Correct signature → 201.
	good := postReq(body)
	good.Header.Set(SignatureHeader, ComputeSignature([]byte(body), secret))
	if rec := serve(t, &fakeIngestor{}, secret, good); rec.Code != http.StatusCreated {
		t.Fatalf("valid signature expected 201, got %d", rec.Code)
	}
}
