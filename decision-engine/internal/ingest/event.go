// Package ingest implements the payment-event ingestion layer (PLAN.md Phase 1):
// it accepts a canonical PaymentEvent webhook, verifies its signature, validates it
// against the frozen contract (schemas/payment_event.schema.json), and hands it to an
// Ingestor for transactional, idempotent persistence.
//
// This package is deliberately free of any database driver: all DB work is behind the
// Ingestor interface (implemented by internal/store against PostgreSQL). That keeps the
// domain logic — types, validation, signature verification, HTTP mapping — pure stdlib
// and independently testable.
package ingest

import "encoding/json"

// SchemaVersion is the only PaymentEvent schema version this build accepts. A breaking
// contract change bumps this (schemas/README.md); unknown versions are rejected.
const SchemaVersion = "0.1.0"

// PaymentEvent is the canonical, normalized revenue-at-risk event. It mirrors
// schemas/payment_event.schema.json exactly (additionalProperties:false → strict decode).
//
// Amount is a pointer so a missing (required) amount is distinguishable from a legitimate
// zero. Money is integer minor units (paise).
type PaymentEvent struct {
	SchemaVersion   string          `json:"schema_version"`
	ExternalEventID string          `json:"external_event_id"`
	MerchantID      string          `json:"merchant_id"`
	PaymentID       string          `json:"payment_id"`
	CustomerID      *string         `json:"customer_id,omitempty"`
	EventType       string          `json:"event_type"`
	Amount          *int64          `json:"amount"`
	Currency        string          `json:"currency"`
	Method          string          `json:"method"`
	FailureReason   *string         `json:"failure_reason,omitempty"`
	PriorAttempts   int             `json:"prior_attempts,omitempty"`
	OccurredAt      string          `json:"occurred_at"`
	ReceivedAt      *string         `json:"received_at,omitempty"`
	RawPayload      json.RawMessage `json:"raw_payload,omitempty"`
}

// Enum sets mirror the frozen contract. Kept as maps for O(1) membership checks.
var (
	validEventTypes = map[string]struct{}{
		"payment.failed":             {},
		"payment.authorized_pending": {},
		"checkout.abandoned":         {},
		"subscription.charge_failed": {},
		"invoice.overdue":            {},
		"mandate.failed":             {},
	}
	validMethods = map[string]struct{}{
		"card": {}, "upi": {}, "netbanking": {}, "wallet": {}, "emi": {}, "other": {},
	}
)

// PaymentStatusForEvent maps an event type to the durable payments.status value written
// on first ingestion. payments.status is intentionally not contract-frozen yet, so this
// mapping is deliberately small and local to Phase 1.
func PaymentStatusForEvent(eventType string) string {
	switch eventType {
	case "checkout.abandoned":
		return "abandoned"
	case "invoice.overdue":
		return "overdue"
	case "payment.authorized_pending":
		return "authorized_pending"
	default:
		// payment.failed, subscription.charge_failed, mandate.failed
		return "failed"
	}
}
