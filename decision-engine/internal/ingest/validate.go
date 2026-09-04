package ingest

import "time"

// Validate checks the event against the frozen contract and confirms it belongs to the
// merchant in the request path. It returns *ValidationError for a contract violation, or
// ErrMerchantMismatch when the body's merchant_id disagrees with the path. A nil return
// means the event is safe to persist.
//
// This is pure input validation only — it performs no I/O and enforces no policy.
func (e *PaymentEvent) Validate(pathMerchantID string) error {
	if e.SchemaVersion != SchemaVersion {
		return newValidationError("schema_version", "must be "+SchemaVersion)
	}
	if e.ExternalEventID == "" {
		return newValidationError("external_event_id", "required, non-empty")
	}
	if e.MerchantID == "" {
		return newValidationError("merchant_id", "required, non-empty")
	}
	if e.MerchantID != pathMerchantID {
		return ErrMerchantMismatch
	}
	if e.PaymentID == "" {
		return newValidationError("payment_id", "required, non-empty")
	}
	if _, ok := validEventTypes[e.EventType]; !ok {
		return newValidationError("event_type", "not a recognized event type")
	}
	if e.Amount == nil {
		return newValidationError("amount", "required")
	}
	if *e.Amount < 0 {
		return newValidationError("amount", "must be >= 0 (paise)")
	}
	if e.Currency != "INR" {
		return newValidationError("currency", "must be INR")
	}
	if _, ok := validMethods[e.Method]; !ok {
		return newValidationError("method", "not a recognized payment method")
	}
	if e.PriorAttempts < 0 {
		return newValidationError("prior_attempts", "must be >= 0")
	}
	if e.OccurredAt == "" {
		return newValidationError("occurred_at", "required")
	}
	if _, err := time.Parse(time.RFC3339, e.OccurredAt); err != nil {
		return newValidationError("occurred_at", "must be an RFC3339 timestamp")
	}
	if e.ReceivedAt != nil {
		if _, err := time.Parse(time.RFC3339, *e.ReceivedAt); err != nil {
			return newValidationError("received_at", "must be an RFC3339 timestamp")
		}
	}
	return nil
}
