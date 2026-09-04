package store

// SQL statements for payment-event ingestion.
//
// Idempotency is enforced entirely by the database:
//   - payment_events.external_event_id has a UNIQUE constraint; INSERT ... ON CONFLICT
//     DO NOTHING makes a duplicate delivery a no-op that returns no row.
//   - Under concurrent duplicate delivery, Postgres serializes on the unique index: one
//     inserter wins and RETURNs its id; the other conflicts, returns no row, and the
//     follow-up SELECT reads the winner's row. Exactly one row results, always.
//
// Explicit ::enum / ::timestamptz / ::jsonb casts let us bind plain Go strings to typed
// columns without the driver rejecting text→enum coercion.
const (
	// upsertPaymentSQL ensures the parent payment row exists (the payment_events FK
	// requires it). The first event defines the payment; a later event for an existing
	// payment leaves it untouched (DO NOTHING) rather than clobbering prior values.
	upsertPaymentSQL = `
INSERT INTO payments (id, merchant_id, amount, currency, method, status, customer_id)
VALUES ($1, $2, $3, $4, $5::payment_method, $6, $7)
ON CONFLICT (id) DO NOTHING`

	// insertEventSQL inserts the event, or does nothing if external_event_id already
	// exists. RETURNING id yields exactly one row on insert and zero rows on conflict.
	insertEventSQL = `
INSERT INTO payment_events
    (payment_id, external_event_id, event_type, occurred_at, failure_reason, prior_attempts, raw_payload)
VALUES ($1, $2, $3::payment_event_type, $4::timestamptz, $5, $6, $7::jsonb)
ON CONFLICT (external_event_id) DO NOTHING
RETURNING id`

	// selectEventIDSQL fetches the id of the durable row for a duplicate delivery.
	selectEventIDSQL = `SELECT id FROM payment_events WHERE external_event_id = $1`
)
