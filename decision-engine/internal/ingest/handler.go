package ingest

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"time"
)

// processTimeout bounds the synchronous Phase 2 recovery pipeline run after a newly-ingested
// event. The pipeline runs on a context detached from the request (a client disconnect must
// not abort a half-written decision), but still time-bounded so a stuck run can't wedge the
// handler.
const processTimeout = 15 * time.Second

// maxBodyBytes bounds the inbound webhook body (defensive; a payment event is small).
const maxBodyBytes = 1 << 20 // 1 MiB

type ingestResponse struct {
	Status          string `json:"status"` // "ingested" | "duplicate"
	Duplicate       bool   `json:"duplicate"`
	PaymentEventID  string `json:"payment_event_id"`
	ExternalEventID string `json:"external_event_id"`
}

type errorResponse struct {
	Error  string `json:"error"`
	Detail string `json:"detail,omitempty"`
}

// NewHandler returns the HTTP handler for
//
//	POST /v1/merchants/{id}/events/payment-failed
//
// It verifies the webhook signature (when secret is non-empty), strictly decodes and
// validates the body against the frozen PaymentEvent contract, and persists it via the
// Ingestor. Idempotency is enforced durably by the store (unique external_event_id): a
// repeated delivery returns 200 with duplicate=true and creates no new row; a first
// delivery returns 201.
//
// When secret is empty, signature verification is skipped (dev convenience). Callers
// should log that fact once at startup so it is never silent in a real deployment.
//
// processor, when non-nil, runs the Phase 2 recovery pipeline synchronously after a newly
// created ingestion. Its failure never changes the ingestion response: the event is durably
// persisted (the Phase 1 contract), so a pipeline error is logged and the event can be
// reprocessed, rather than reporting the accepted webhook as failed. A nil processor
// preserves pure Phase 1 behavior.
func NewHandler(ingestor Ingestor, processor Processor, secret string, logger *slog.Logger) http.HandlerFunc {
	if logger == nil {
		logger = slog.Default()
	}
	verifySignature := secret != ""

	return func(w http.ResponseWriter, r *http.Request) {
		merchantID := r.PathValue("id")

		r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
		body, err := io.ReadAll(r.Body)
		if err != nil {
			var maxErr *http.MaxBytesError
			if errors.As(err, &maxErr) {
				writeError(w, http.StatusRequestEntityTooLarge, "payload_too_large", "")
				return
			}
			writeError(w, http.StatusBadRequest, "unreadable_body", "")
			return
		}

		if verifySignature {
			if !VerifySignature(body, r.Header.Get(SignatureHeader), secret) {
				logger.Warn("ingest rejected: bad signature", "merchant_id", merchantID)
				writeError(w, http.StatusUnauthorized, "invalid_signature", "")
				return
			}
		}

		// Strict decode: additionalProperties:false in the contract → reject unknown fields.
		dec := json.NewDecoder(bytes.NewReader(body))
		dec.DisallowUnknownFields()
		var evt PaymentEvent
		if err := dec.Decode(&evt); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
			return
		}
		if dec.More() {
			writeError(w, http.StatusBadRequest, "invalid_json", "unexpected trailing data")
			return
		}

		if err := evt.Validate(merchantID); err != nil {
			var vErr *ValidationError
			switch {
			case errors.Is(err, ErrMerchantMismatch):
				writeError(w, http.StatusBadRequest, "merchant_mismatch", "")
			case errors.As(err, &vErr):
				writeError(w, http.StatusBadRequest, "validation_failed", vErr.Error())
			default:
				writeError(w, http.StatusBadRequest, "validation_failed", "")
			}
			return
		}

		res, err := ingestor.Ingest(r.Context(), IngestRequest{Event: &evt, RawBody: body})
		if err != nil {
			// Do not leak internal/DB error detail to the caller.
			logger.Error("ingest persistence failed",
				"merchant_id", merchantID,
				"external_event_id", evt.ExternalEventID,
				"err", err,
			)
			writeError(w, http.StatusInternalServerError, "internal_error", "")
			return
		}

		// Phase 2: run the recovery pipeline for a newly-created event, before responding.
		// Duplicate deliveries (res.Created == false) are never reprocessed — the Phase 1
		// idempotency boundary is also the "process exactly one recovery per event" boundary.
		if processor != nil && res.Created {
			pctx, cancel := context.WithTimeout(context.WithoutCancel(r.Context()), processTimeout)
			if err := processor.Process(pctx, res.PaymentEventID); err != nil {
				// Ingestion already succeeded and is durable; a pipeline error must not turn the
				// accepted webhook into a failure. Log for correlation and let it be reprocessed.
				logger.Error("recovery pipeline failed after ingestion",
					"merchant_id", merchantID,
					"payment_event_id", res.PaymentEventID,
					"external_event_id", evt.ExternalEventID,
					"err", err,
				)
			}
			cancel()
		}

		status := http.StatusOK
		statusStr := "duplicate"
		if res.Created {
			status = http.StatusCreated
			statusStr = "ingested"
		}

		// Structured, PII-minimal log: identifiers for correlation (PLAN.md §11), never the
		// raw payload, customer_id, or signature.
		logger.Info("payment event ingested",
			"merchant_id", merchantID,
			"payment_id", evt.PaymentID,
			"external_event_id", evt.ExternalEventID,
			"event_type", evt.EventType,
			"created", res.Created,
		)

		writeJSON(w, status, ingestResponse{
			Status:          statusStr,
			Duplicate:       !res.Created,
			PaymentEventID:  res.PaymentEventID,
			ExternalEventID: evt.ExternalEventID,
		})
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code, detail string) {
	writeJSON(w, status, errorResponse{Error: code, Detail: detail})
}
