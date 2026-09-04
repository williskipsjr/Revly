//go:build integration

// Integration tests for the PostgreSQL ingestion path. Excluded from the default build;
// run with a live database and the schema applied:
//
//	make db-migrate                 # apply migrations/001_init.sql
//	make test-integration           # go test -tags=integration ./...
//
// They require TEST_DATABASE_URL (or DATABASE_URL). These tests are the authoritative
// proof of the Phase 1 invariant — that the DB unique constraint, not application code,
// enforces idempotency — including under concurrent duplicate delivery.
package store

import (
	"context"
	"database/sql"
	"os"
	"sync"
	"testing"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/ingest"
)

const testMerchantID = "test_merchant"

func openTestDB(t *testing.T) *sql.DB {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		dsn = os.Getenv("DATABASE_URL")
	}
	if dsn == "" {
		t.Skip("set TEST_DATABASE_URL (or DATABASE_URL) to run store integration tests")
	}
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		t.Fatalf("ping db (is Postgres up and 001_init.sql applied?): %v", err)
	}
	return db
}

// resetData clears test rows and ensures the test merchant exists (FK parent for payments).
func resetData(t *testing.T, db *sql.DB) {
	t.Helper()
	ctx := context.Background()
	// payment_events references payments → delete children first.
	if _, err := db.ExecContext(ctx, `DELETE FROM payment_events WHERE payment_id LIKE 'test_%'`); err != nil {
		t.Fatalf("cleanup events: %v", err)
	}
	if _, err := db.ExecContext(ctx, `DELETE FROM payments WHERE id LIKE 'test_%'`); err != nil {
		t.Fatalf("cleanup payments: %v", err)
	}
	if _, err := db.ExecContext(ctx,
		`INSERT INTO merchants (id, name, risk_tolerance_tier) VALUES ($1, 'Test Merchant', 'balanced')
		 ON CONFLICT (id) DO NOTHING`, testMerchantID); err != nil {
		t.Fatalf("ensure merchant: %v", err)
	}
}

func newReq(merchantID, paymentID, externalID string, amount int64) ingest.IngestRequest {
	a := amount
	return ingest.IngestRequest{
		Event: &ingest.PaymentEvent{
			SchemaVersion:   ingest.SchemaVersion,
			ExternalEventID: externalID,
			MerchantID:      merchantID,
			PaymentID:       paymentID,
			EventType:       "payment.failed",
			Amount:          &a,
			Currency:        "INR",
			Method:          "card",
			OccurredAt:      "2026-09-04T10:00:00Z",
		},
		RawBody: []byte(`{"external_event_id":"` + externalID + `","amount":` + itoa(amount) + `}`),
	}
}

func itoa(i int64) string {
	// small dependency-free int64→string for the raw payload
	if i == 0 {
		return "0"
	}
	neg := i < 0
	if neg {
		i = -i
	}
	var b [20]byte
	pos := len(b)
	for i > 0 {
		pos--
		b[pos] = byte('0' + i%10)
		i /= 10
	}
	if neg {
		pos--
		b[pos] = '-'
	}
	return string(b[pos:])
}

func countEvents(t *testing.T, db *sql.DB, externalID string) int {
	t.Helper()
	var n int
	if err := db.QueryRow(`SELECT count(*) FROM payment_events WHERE external_event_id = $1`, externalID).Scan(&n); err != nil {
		t.Fatalf("count events: %v", err)
	}
	return n
}

func countPayments(t *testing.T, db *sql.DB, paymentID string) int {
	t.Helper()
	var n int
	if err := db.QueryRow(`SELECT count(*) FROM payments WHERE id = $1`, paymentID).Scan(&n); err != nil {
		t.Fatalf("count payments: %v", err)
	}
	return n
}

// The core Phase 1 invariant: delivering the same event twice creates exactly one row.
func TestIntegration_NewThenDuplicate(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()
	resetData(t, db)
	s := New(db)
	ctx := context.Background()

	const ext = "test_evt_dup"
	req := newReq(testMerchantID, "test_pay_dup", ext, 15000)

	first, err := s.Ingest(ctx, req)
	if err != nil {
		t.Fatalf("first ingest: %v", err)
	}
	if !first.Created {
		t.Fatal("expected first ingest to create a row")
	}

	second, err := s.Ingest(ctx, req)
	if err != nil {
		t.Fatalf("second ingest: %v", err)
	}
	if second.Created {
		t.Fatal("expected second (duplicate) ingest to NOT create a row")
	}
	if first.PaymentEventID != second.PaymentEventID {
		t.Fatalf("duplicate returned a different id: %s vs %s", first.PaymentEventID, second.PaymentEventID)
	}
	if n := countEvents(t, db, ext); n != 1 {
		t.Fatalf("expected exactly 1 payment_events row, got %d", n)
	}
}

// The strongest form of the invariant: concurrent duplicate deliveries still yield one row.
func TestIntegration_ConcurrentDuplicate(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()
	resetData(t, db)
	s := New(db)

	const ext = "test_evt_concurrent"
	const n = 20
	req := newReq(testMerchantID, "test_pay_concurrent", ext, 20000)

	var wg sync.WaitGroup
	results := make([]ingest.IngestResult, n)
	errs := make([]error, n)
	start := make(chan struct{})
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start // release all goroutines at once to maximize contention
			results[i], errs[i] = s.Ingest(context.Background(), req)
		}(i)
	}
	close(start)
	wg.Wait()

	createdCount := 0
	var id string
	for i := 0; i < n; i++ {
		if errs[i] != nil {
			t.Fatalf("goroutine %d errored: %v", i, errs[i])
		}
		if results[i].Created {
			createdCount++
		}
		if id == "" {
			id = results[i].PaymentEventID
		} else if results[i].PaymentEventID != id {
			t.Fatalf("goroutines saw different ids: %s vs %s", id, results[i].PaymentEventID)
		}
	}
	if createdCount != 1 {
		t.Fatalf("expected exactly 1 creator under concurrency, got %d", createdCount)
	}
	if got := countEvents(t, db, ext); got != 1 {
		t.Fatalf("expected exactly 1 payment_events row, got %d", got)
	}
}

// A mid-transaction failure (invalid enum on the event insert) must roll back the payment
// upsert too — no partial state.
func TestIntegration_TransactionRollback(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()
	resetData(t, db)
	s := New(db)

	req := newReq(testMerchantID, "test_pay_rollback", "test_evt_rollback", 5000)
	req.Event.EventType = "not_a_valid_event_type" // passes Go, fails the ::payment_event_type cast

	if _, err := s.Ingest(context.Background(), req); err == nil {
		t.Fatal("expected an error for invalid event_type")
	}
	if n := countPayments(t, db, "test_pay_rollback"); n != 0 {
		t.Fatalf("payment must not persist when the event insert fails; got %d payment rows", n)
	}
	if n := countEvents(t, db, "test_evt_rollback"); n != 0 {
		t.Fatalf("expected 0 event rows after rollback, got %d", n)
	}
}

// The payments.merchant_id foreign key must reject an unknown merchant, with no partial state.
func TestIntegration_ForeignKeyEnforced(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()
	resetData(t, db)
	s := New(db)

	req := newReq("test_missing_merchant", "test_pay_fk", "test_evt_fk", 5000)
	if _, err := s.Ingest(context.Background(), req); err == nil {
		t.Fatal("expected a foreign-key error for unknown merchant")
	}
	if n := countPayments(t, db, "test_pay_fk"); n != 0 {
		t.Fatalf("expected 0 payment rows after FK violation, got %d", n)
	}
}

// Money must round-trip as exact integer paise.
func TestIntegration_MonetaryExact(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()
	resetData(t, db)
	s := New(db)

	const amount int64 = 9_999_999_999 // large, exact paise value
	req := newReq(testMerchantID, "test_pay_money", "test_evt_money", amount)
	if _, err := s.Ingest(context.Background(), req); err != nil {
		t.Fatalf("ingest: %v", err)
	}
	var got int64
	if err := db.QueryRow(`SELECT amount FROM payments WHERE id = $1`, "test_pay_money").Scan(&got); err != nil {
		t.Fatalf("read amount: %v", err)
	}
	if got != amount {
		t.Fatalf("amount round-trip mismatch: stored %d, want %d", got, amount)
	}
}
