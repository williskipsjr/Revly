// Package store is the PostgreSQL adapter for the decision engine's durable state.
//
// It depends only on the stdlib database/sql interface — never on a concrete driver — so
// it compiles and type-checks without network access. The pgx driver is registered in
// internal/db and injected here as a *sql.DB. Real database behavior (the idempotency
// constraint, transaction rollback, concurrency) is exercised by the build-tagged
// integration tests, which run against a live Postgres.
package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/ingest"
)

// Store persists decision-engine state to PostgreSQL.
type Store struct {
	db *sql.DB
}

// New returns a Store backed by db.
func New(db *sql.DB) *Store {
	return &Store{db: db}
}

// Ingest persists a payment event transactionally and idempotently, satisfying
// ingest.Ingestor.
//
// Within a single transaction it (1) ensures the parent payment row exists and (2) inserts
// the payment_events row, relying on the UNIQUE(external_event_id) constraint to absorb
// duplicate deliveries. On any error the transaction is rolled back, so a failure never
// leaves a partially-persisted event (e.g. a payment with no event, or vice versa).
func (s *Store) Ingest(ctx context.Context, req ingest.IngestRequest) (ingest.IngestResult, error) {
	evt := req.Event
	if evt == nil || evt.Amount == nil {
		return ingest.IngestResult{}, errors.New("store: nil event or amount")
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return ingest.IngestResult{}, err
	}
	// Rollback is a no-op once the tx has committed; safe to always defer.
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.ExecContext(ctx, upsertPaymentSQL,
		evt.PaymentID,
		evt.MerchantID,
		*evt.Amount,
		evt.Currency,
		evt.Method,
		ingest.PaymentStatusForEvent(evt.EventType),
		nullableString(evt.CustomerID),
	); err != nil {
		return ingest.IngestResult{}, err
	}

	var id string
	created := true
	err = tx.QueryRowContext(ctx, insertEventSQL,
		evt.PaymentID,
		evt.ExternalEventID,
		evt.EventType,
		evt.OccurredAt,
		nullableString(evt.FailureReason),
		evt.PriorAttempts,
		nullableJSON(req.RawBody),
	).Scan(&id)

	switch {
	case err == nil:
		// New row inserted.
	case errors.Is(err, sql.ErrNoRows):
		// ON CONFLICT DO NOTHING returned nothing → duplicate delivery. Read the id of the
		// single durable row so the caller gets a stable, idempotent result.
		created = false
		if err := tx.QueryRowContext(ctx, selectEventIDSQL, evt.ExternalEventID).Scan(&id); err != nil {
			return ingest.IngestResult{}, err
		}
	default:
		return ingest.IngestResult{}, err
	}

	if err := tx.Commit(); err != nil {
		return ingest.IngestResult{}, err
	}
	return ingest.IngestResult{PaymentEventID: id, Created: created}, nil
}

// nullableString converts an optional string to a value the driver stores as NULL when
// absent, avoiding a spurious empty string in the database.
func nullableString(p *string) any {
	if p == nil {
		return nil
	}
	return *p
}

// nullableJSON returns the raw JSON body for a jsonb column, or NULL when empty.
func nullableJSON(b json.RawMessage) any {
	if len(b) == 0 {
		return nil
	}
	return string(b)
}
