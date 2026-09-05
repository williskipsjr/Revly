//go:build integration

// Phase 5 integration tests: the full policy/safety layer end-to-end on a live Postgres (no
// Redis). They prove the Postgres-derived facts the Phase-5 engine consumes are wired correctly
// — the fraud hard-stop routing to HUMAN_REVIEW, the platform global kill switch, the per-payment
// cooldown derived from a prior action's executed_at, and the per-customer daily action cap —
// complementing the exhaustive pure-engine coverage in internal/policy.
//
// Run with:
//
//	make db-migrate          # applies migrations/003_phase5_policy.sql (platform_policy)
//	make test-integration
package store

import (
	"context"
	"database/sql"
	"testing"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/domain"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/executor"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/ingest"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/pipeline"
)

// TestIntegration_Phase5_FraudRoutesToHumanReview: a fraud_suspected diagnosis blocks every
// autonomous intervention and routes to a human — the persisted decision is HUMAN_REVIEW with
// chosen escalate at STOPPED, and no action is dispatched.
func TestIntegration_Phase5_FraudRoutesToHumanReview(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()
	cleanupPipeline(t, db)
	seedMerchant(t, db, "p2m_p5_fraud", 3, 500, false)
	s := New(db)
	runner := pipeline.NewRunner(s, executor.MockDispatcher{}, nil, nil)

	peID := ingestOne(t, s, "p2m_p5_fraud", "p2_p5_fraud", "p2_evt_p5_fraud",
		"transaction flagged as suspected fraud", 500000, 0)
	if err := runner.Process(context.Background(), peID); err != nil {
		t.Fatalf("pipeline Process: %v", err)
	}

	var chosen, state, result string
	var decisionID string
	if err := db.QueryRow(
		`SELECT id, chosen_action::text, recovery_state::text, policy_check_result::text
		   FROM decisions WHERE payment_event_id=$1::uuid`, peID,
	).Scan(&decisionID, &chosen, &state, &result); err != nil {
		t.Fatalf("read decision: %v", err)
	}
	if result != string(domain.PolicyHumanReview) {
		t.Fatalf("policy_check_result = %s, want HUMAN_REVIEW", result)
	}
	if chosen != string(domain.ActionEscalate) {
		t.Fatalf("chosen_action = %s, want escalate", chosen)
	}
	if state != string(domain.StateStopped) {
		t.Fatalf("recovery_state = %s, want STOPPED", state)
	}
	if n := scalarInt(t, db, `SELECT count(*) FROM actions WHERE decision_id=$1::uuid`, decisionID); n != 0 {
		t.Fatalf("fraud HUMAN_REVIEW: expected 0 actions, got %d", n)
	}
}

// TestIntegration_Phase5_GlobalKillSwitch: with the platform_policy global kill switch on, even a
// perfectly healthy event resolves to no_action at STOPPED with no action dispatched. The switch
// is reset in cleanup so it cannot leak into other tests.
func TestIntegration_Phase5_GlobalKillSwitch(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()
	cleanupPipeline(t, db)
	seedMerchant(t, db, "p2m_p5_gks", 3, 500, false)
	setGlobalKillSwitch(t, db, true)
	t.Cleanup(func() { setGlobalKillSwitch(t, db, false) })

	s := New(db)
	runner := pipeline.NewRunner(s, executor.MockDispatcher{}, nil, nil)

	peID := ingestOne(t, s, "p2m_p5_gks", "p2_p5_gks", "p2_evt_p5_gks", "Issuer declined, try again", 500000, 0)
	if err := runner.Process(context.Background(), peID); err != nil {
		t.Fatalf("pipeline Process: %v", err)
	}

	var chosen, state string
	var decisionID string
	if err := db.QueryRow(
		`SELECT id, chosen_action::text, recovery_state::text FROM decisions WHERE payment_event_id=$1::uuid`, peID,
	).Scan(&decisionID, &chosen, &state); err != nil {
		t.Fatalf("read decision: %v", err)
	}
	if chosen != string(domain.ActionNoAction) {
		t.Fatalf("global kill switch: chosen = %s, want no_action", chosen)
	}
	if state != string(domain.StateStopped) {
		t.Fatalf("global kill switch: recovery_state = %s, want STOPPED", state)
	}
	if n := scalarInt(t, db, `SELECT count(*) FROM actions WHERE decision_id=$1::uuid`, decisionID); n != 0 {
		t.Fatalf("global kill switch: expected 0 actions, got %d", n)
	}
}

// TestIntegration_Phase5_CooldownBlocksRetry: a first event dispatches a retry-type action; a
// second event for the SAME payment, arriving inside the cooldown window, must not choose a
// retry — the cooldown fact is derived from the first action's executed_at in Postgres.
func TestIntegration_Phase5_CooldownBlocksRetry(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()
	cleanupPipeline(t, db)
	seedMerchant(t, db, "p2m_p5_cool", 3, 500, false) // cooldown_minutes = 30 (seedMerchant default)
	s := New(db)
	runner := pipeline.NewRunner(s, executor.MockDispatcher{}, nil, nil)

	pe1 := ingestOne(t, s, "p2m_p5_cool", "p2_p5_cool", "p2_evt_p5_cool1", "Issuer declined, try again", 500000, 0)
	if err := runner.Process(context.Background(), pe1); err != nil {
		t.Fatalf("first Process: %v", err)
	}
	// The first decision must have dispatched a retry-type action, else the cooldown premise fails.
	if n := scalarInt(t, db,
		`SELECT count(*) FROM actions a JOIN decisions d ON d.id=a.decision_id
		   WHERE d.payment_event_id=$1::uuid AND a.action_type IN ('retry','delayed_retry')`, pe1); n != 1 {
		t.Fatalf("expected the first event to dispatch a retry-type action, got %d", n)
	}

	pe2 := ingestOne(t, s, "p2m_p5_cool", "p2_p5_cool", "p2_evt_p5_cool2", "Issuer declined, try again", 500000, 0)
	if err := runner.Process(context.Background(), pe2); err != nil {
		t.Fatalf("second Process: %v", err)
	}
	var chosen2 string
	if err := db.QueryRow(
		`SELECT chosen_action::text FROM decisions WHERE payment_event_id=$1::uuid`, pe2,
	).Scan(&chosen2); err != nil {
		t.Fatalf("read second decision: %v", err)
	}
	if domain.IsRetry(domain.Action(chosen2)) {
		t.Fatalf("inside cooldown the second event chose a retry (%s); cooldown was not enforced", chosen2)
	}
}

// TestIntegration_Phase5_DailyCapStops: with a per-merchant daily action cap of 1, a second
// intervention for the SAME customer within 24h is blocked, so the decision falls back to
// no_action at STOPPED. Proves the Postgres-derived per-customer 24h count feeds the cap.
func TestIntegration_Phase5_DailyCapStops(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()
	cleanupPipeline(t, db)
	seedMerchant(t, db, "p2m_p5_cap", 3, 500, false)
	if _, err := db.Exec(
		`UPDATE merchant_policy_config SET daily_action_cap=1 WHERE merchant_id=$1`, "p2m_p5_cap"); err != nil {
		t.Fatalf("set daily cap: %v", err)
	}
	s := New(db)
	runner := pipeline.NewRunner(s, executor.MockDispatcher{}, nil, nil)

	const customer = "cust_p5_cap"
	pe1 := ingestOneCustomer(t, s, "p2m_p5_cap", "p2_p5_cap1", "p2_evt_p5_cap1", customer, "Issuer declined, try again", 500000, 0)
	if err := runner.Process(context.Background(), pe1); err != nil {
		t.Fatalf("first Process: %v", err)
	}
	// The first event must have dispatched an intervention (so the customer's 24h count is now 1).
	if n := scalarInt(t, db,
		`SELECT count(*) FROM actions a JOIN decisions d ON d.id=a.decision_id
		   WHERE d.payment_event_id=$1::uuid AND a.action_type <> 'no_action'`, pe1); n != 1 {
		t.Fatalf("expected the first event to dispatch an intervention, got %d", n)
	}

	pe2 := ingestOneCustomer(t, s, "p2m_p5_cap", "p2_p5_cap2", "p2_evt_p5_cap2", customer, "Issuer declined, try again", 500000, 0)
	if err := runner.Process(context.Background(), pe2); err != nil {
		t.Fatalf("second Process: %v", err)
	}
	var chosen2, state2 string
	if err := db.QueryRow(
		`SELECT chosen_action::text, recovery_state::text FROM decisions WHERE payment_event_id=$1::uuid`, pe2,
	).Scan(&chosen2, &state2); err != nil {
		t.Fatalf("read second decision: %v", err)
	}
	if chosen2 != string(domain.ActionNoAction) {
		t.Fatalf("daily cap reached: chosen = %s, want no_action", chosen2)
	}
	if state2 != string(domain.StateStopped) {
		t.Fatalf("daily cap reached: recovery_state = %s, want STOPPED", state2)
	}
}

// setGlobalKillSwitch flips the platform_policy singleton's global kill switch, ensuring the row
// exists first (migration 003 seeds it, but be robust if a test DB predates it).
func setGlobalKillSwitch(t *testing.T, db *sql.DB, on bool) {
	t.Helper()
	if _, err := db.Exec(`INSERT INTO platform_policy (id) VALUES ('platform') ON CONFLICT (id) DO NOTHING`); err != nil {
		t.Fatalf("ensure platform_policy row: %v", err)
	}
	if _, err := db.Exec(`UPDATE platform_policy SET global_kill_switch=$1 WHERE id='platform'`, on); err != nil {
		t.Fatalf("set global kill switch: %v", err)
	}
}

// ingestOneCustomer is ingestOne with an explicit customer_id, so per-customer facts (the daily
// action cap) can be exercised end-to-end.
func ingestOneCustomer(t *testing.T, s *Store, merchantID, paymentID, extID, customerID, reason string, amount int64, priorAttempts int) string {
	t.Helper()
	a := amount
	cust := customerID
	res, err := s.Ingest(context.Background(), ingest.IngestRequest{
		Event: &ingest.PaymentEvent{
			SchemaVersion:   ingest.SchemaVersion,
			ExternalEventID: extID,
			MerchantID:      merchantID,
			PaymentID:       paymentID,
			EventType:       "payment.failed",
			Amount:          &a,
			Currency:        "INR",
			Method:          "card",
			CustomerID:      &cust,
			FailureReason:   &reason,
			PriorAttempts:   priorAttempts,
			OccurredAt:      "2026-09-05T10:00:00Z",
		},
		RawBody: []byte(`{"external_event_id":"` + extID + `"}`),
	})
	if err != nil {
		t.Fatalf("ingest (customer): %v", err)
	}
	return res.PaymentEventID
}
