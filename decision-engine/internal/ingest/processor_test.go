package ingest

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
)

// fakeProcessor records the payment_event_ids it was asked to process.
type fakeProcessor struct {
	mu  sync.Mutex
	ids []string
	err error
}

func (f *fakeProcessor) Process(_ context.Context, paymentEventID string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.ids = append(f.ids, paymentEventID)
	return f.err
}

func (f *fakeProcessor) count() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.ids)
}

func serveWithProcessor(t *testing.T, ing Ingestor, proc Processor, req *http.Request) *http.Response {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/merchants/{id}/events/payment-failed", NewHandler(ing, proc, "", nil))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	return rec.Result()
}

// TestHandler_ProcessorRunsOnNewOnly: the recovery pipeline runs once for a newly-created
// event and NOT for a duplicate delivery (Phase 1 idempotency is also the reprocessing gate).
func TestHandler_ProcessorRunsOnNewOnly(t *testing.T) {
	ing := &fakeIngestor{}
	proc := &fakeProcessor{}

	// First delivery → 201 and one Process call.
	if resp := serveWithProcessor(t, ing, proc, postReq(validBody)); resp.StatusCode != http.StatusCreated {
		t.Fatalf("first: expected 201, got %d", resp.StatusCode)
	}
	if proc.count() != 1 {
		t.Fatalf("expected processor called once, got %d", proc.count())
	}
	if proc.ids[0] != "pe_evt_abc123" {
		t.Fatalf("processor got wrong id: %q", proc.ids[0])
	}

	// Duplicate delivery → 200 and NO additional Process call.
	if resp := serveWithProcessor(t, ing, proc, postReq(validBody)); resp.StatusCode != http.StatusOK {
		t.Fatalf("duplicate: expected 200, got %d", resp.StatusCode)
	}
	if proc.count() != 1 {
		t.Fatalf("duplicate must not reprocess; processor call count = %d", proc.count())
	}
}

// TestHandler_ProcessorErrorDoesNotFailIngestion: a pipeline error is swallowed — the durable
// ingestion still reports success (201), preserving the Phase 1 contract.
func TestHandler_ProcessorErrorDoesNotFailIngestion(t *testing.T) {
	ing := &fakeIngestor{}
	proc := &fakeProcessor{err: errors.New("pipeline boom")}

	resp := serveWithProcessor(t, ing, proc, postReq(validBody))
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201 despite pipeline error, got %d", resp.StatusCode)
	}
	if proc.count() != 1 {
		t.Fatalf("processor should have been invoked once, got %d", proc.count())
	}
}
