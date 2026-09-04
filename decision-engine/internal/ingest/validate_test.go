package ingest

import (
	"errors"
	"testing"
)

func strPtr(s string) *string { return &s }
func i64Ptr(i int64) *int64   { return &i }

// validEvent returns a contract-valid event for merchant merch_1 that individual tests mutate.
func validEvent() PaymentEvent {
	return PaymentEvent{
		SchemaVersion:   SchemaVersion,
		ExternalEventID: "evt_abc123",
		MerchantID:      "merch_1",
		PaymentID:       "pay_abc123",
		EventType:       "payment.failed",
		Amount:          i64Ptr(15000),
		Currency:        "INR",
		Method:          "card",
		OccurredAt:      "2026-09-04T10:00:00Z",
	}
}

func TestValidate_Valid(t *testing.T) {
	e := validEvent()
	if err := e.Validate("merch_1"); err != nil {
		t.Fatalf("expected valid, got %v", err)
	}
}

func TestValidate_ZeroAmountAllowed(t *testing.T) {
	e := validEvent()
	e.Amount = i64Ptr(0) // 0 paise is a legitimate amount (minimum 0), not "missing"
	if err := e.Validate("merch_1"); err != nil {
		t.Fatalf("zero amount should be valid, got %v", err)
	}
}

func TestValidate_MerchantMismatch(t *testing.T) {
	e := validEvent()
	if err := e.Validate("merch_OTHER"); !errors.Is(err, ErrMerchantMismatch) {
		t.Fatalf("expected ErrMerchantMismatch, got %v", err)
	}
}

func TestValidate_Rejections(t *testing.T) {
	cases := []struct {
		name   string
		mutate func(*PaymentEvent)
		field  string
	}{
		{"bad schema_version", func(e *PaymentEvent) { e.SchemaVersion = "9.9.9" }, "schema_version"},
		{"empty external_event_id", func(e *PaymentEvent) { e.ExternalEventID = "" }, "external_event_id"},
		{"empty merchant_id", func(e *PaymentEvent) { e.MerchantID = "" }, "merchant_id"},
		{"empty payment_id", func(e *PaymentEvent) { e.PaymentID = "" }, "payment_id"},
		{"unknown event_type", func(e *PaymentEvent) { e.EventType = "payment.exploded" }, "event_type"},
		{"missing amount", func(e *PaymentEvent) { e.Amount = nil }, "amount"},
		{"negative amount", func(e *PaymentEvent) { e.Amount = i64Ptr(-1) }, "amount"},
		{"non-INR currency", func(e *PaymentEvent) { e.Currency = "USD" }, "currency"},
		{"unknown method", func(e *PaymentEvent) { e.Method = "crypto" }, "method"},
		{"negative prior_attempts", func(e *PaymentEvent) { e.PriorAttempts = -1 }, "prior_attempts"},
		{"empty occurred_at", func(e *PaymentEvent) { e.OccurredAt = "" }, "occurred_at"},
		{"bad occurred_at", func(e *PaymentEvent) { e.OccurredAt = "not-a-time" }, "occurred_at"},
		{"bad received_at", func(e *PaymentEvent) { e.ReceivedAt = strPtr("nope") }, "received_at"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			e := validEvent()
			tc.mutate(&e)
			err := e.Validate("merch_1")
			if err == nil {
				t.Fatalf("expected rejection for %s", tc.name)
			}
			var vErr *ValidationError
			if !errors.As(err, &vErr) {
				t.Fatalf("expected *ValidationError, got %T (%v)", err, err)
			}
			if vErr.Field != tc.field {
				t.Fatalf("expected field %q, got %q", tc.field, vErr.Field)
			}
		})
	}
}

func TestPaymentStatusForEvent(t *testing.T) {
	cases := map[string]string{
		"payment.failed":             "failed",
		"subscription.charge_failed": "failed",
		"mandate.failed":             "failed",
		"checkout.abandoned":         "abandoned",
		"invoice.overdue":            "overdue",
		"payment.authorized_pending": "authorized_pending",
	}
	for in, want := range cases {
		if got := PaymentStatusForEvent(in); got != want {
			t.Errorf("PaymentStatusForEvent(%q) = %q, want %q", in, got, want)
		}
	}
}
