package ingest

import (
	"context"
	"encoding/json"
	"errors"
)

// ErrMerchantMismatch is returned when the event's merchant_id does not match the
// merchant in the request path. It is a client error (mapped to HTTP 400).
var ErrMerchantMismatch = errors.New("event merchant_id does not match path merchant")

// ValidationError describes a single failed field validation against the PaymentEvent
// contract. The handler maps it to HTTP 400 with the field name, without leaking internals.
type ValidationError struct {
	Field  string
	Reason string
}

func (e *ValidationError) Error() string {
	return "invalid field " + e.Field + ": " + e.Reason
}

func newValidationError(field, reason string) *ValidationError {
	return &ValidationError{Field: field, Reason: reason}
}

// IngestRequest is the unit of work handed to an Ingestor: the parsed, validated event
// plus the complete original request body (persisted as payment_events.raw_payload for
// audit/replay — PLAN.md §11).
type IngestRequest struct {
	Event   *PaymentEvent
	RawBody json.RawMessage
}

// IngestResult reports the outcome of a durable ingestion.
//   - Created == true:  a new payment_events row was inserted.
//   - Created == false: the external_event_id already existed; this was a duplicate
//     delivery and no new row was created (idempotent replay). PaymentEventID always
//     identifies the single durable row for this external_event_id.
type IngestResult struct {
	PaymentEventID string
	Created        bool
}

// Ingestor persists a payment event transactionally and idempotently. Implemented by
// internal/store against PostgreSQL; the unique constraint on external_event_id — not
// this interface — is what enforces idempotency under concurrent duplicate delivery.
type Ingestor interface {
	Ingest(ctx context.Context, req IngestRequest) (IngestResult, error)
}

// Processor runs the downstream recovery pipeline for a newly-ingested payment event
// (Phase 2). It is implemented by internal/pipeline.Runner and invoked by the handler only
// when ingestion created a new event — a duplicate delivery (Phase 1 idempotency) triggers
// no reprocessing. A nil Processor keeps the Phase 1 behavior (ingest only), so the
// ingestion layer has no hard dependency on the decision plane.
type Processor interface {
	Process(ctx context.Context, paymentEventID string) error
}
