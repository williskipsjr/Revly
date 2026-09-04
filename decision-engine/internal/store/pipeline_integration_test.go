//go:build integration

// Integration tests for the Phase 2 recovery pipeline persistence against a live Postgres.
// Excluded from the default build; run with:
//
//	make db-migrate                 # apply migrations/001_init.sql + 002_phase2_kill_switch.sql
//	make test-integration           # go test -tags=integration ./...
//
// These are the authoritative proof of the Phase 2 slice end-to-end on Postgres alone (no
// Redis): a real decision + idempotent action + outcome, visible recovery_state transitions,
// policy blocking/allowing, and the idempotency guarantee under a repeated action fire.
package store

import (
	"context"
	"database/sql"
	"testing"

	_ "github.com/jackc/pgx/v5/stdlib"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/domain"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/executor"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/ingest"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/pipeline"
)

// seedMerchant creates a merchant with a full policy config and action-cost table so the
// pipeline can load a complete decision context. killSwitch and minERV/maxRetries are
// parameterized so each test can shape policy behavior.
func seedMerchant(t *testing.T, db *sql.DB, id string, maxRetries int, minERV float64, killSwitch bool) {
	t.Helper()
	ctx := context.Background()
	if _, err := db.ExecContext(ctx,
		`INSERT INTO merchants (id, name, risk_tolerance_tier) VALUES ($1, 'Test', 'balanced')
		 ON CONFLICT (id) DO NOTHING`, id); err != nil {
		t.Fatalf("seed merchant: %v", err)
	}
	if _, err := db.ExecContext(ctx,
		`INSERT INTO merchant_policy_config
		   (merchant_id, max_retries, cooldown_minutes, min_erv_threshold, daily_action_cap, amount_ceiling, kill_switch)
		 VALUES ($1, $2, 30, $3, 20, 50000000, $4)
		 ON CONFLICT (merchant_id) DO UPDATE SET
		   max_retries=$2, min_erv_threshold=$3, kill_switch=$4`,
		id, maxRetries, minERV, killSwitch); err != nil {
		t.Fatalf("seed policy config: %v", err)
	}
	costs := []struct {
		action   string
		cost     float64
		friction float64
	}{
		{"retry", 200, 0.4}, {"delayed_retry", 200, 0.3}, {"alt_method", 20, 0.8},
		{"payment_link", 20, 0.8}, {"notify", 20, 0.5}, {"escalate", 5000, 0.3}, {"no_action", 0, 0},
	}
	for _, c := range costs {
		if _, err := db.ExecContext(ctx,
			`INSERT INTO merchant_action_costs (merchant_id, action_type, monetary_cost, friction_weight)
			 VALUES ($1, $2::action_type, $3, $4)
			 ON CONFLICT (merchant_id, action_type) DO UPDATE SET monetary_cost=$3, friction_weight=$4`,
			id, c.action, c.cost, c.friction); err != nil {
			t.Fatalf("seed action cost %s: %v", c.action, err)
		}
	}
}

// ingestOne persists a payment + payment_event via the Phase 1 ingest path and returns the
// payment_event_id the pipeline will process.
func ingestOne(t *testing.T, s *Store, merchantID, paymentID, extID, reason string, amount int64, priorAttempts int) string {
	t.Helper()
	a := amount
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
			FailureReason:   &reason,
			PriorAttempts:   priorAttempts,
			OccurredAt:      "2026-09-05T10:00:00Z",
		},
		RawBody: []byte(`{"external_event_id":"` + extID + `"}`),
	})
	if err != nil {
		t.Fatalf("ingest: %v", err)
	}
	return res.PaymentEventID
}

// cleanupPipeline removes all rows created by these tests (children first) for a payment id
// prefix, leaving merchant config in place (re-usable across runs).
func cleanupPipeline(t *testing.T, db *sql.DB) {
	t.Helper()
	ctx := context.Background()
	stmts := []string{
		`DELETE FROM outcomes WHERE action_id IN (
		    SELECT a.id FROM actions a JOIN decisions d ON d.id=a.decision_id
		    JOIN payment_events pe ON pe.id=d.payment_event_id WHERE pe.payment_id LIKE 'p2_%')`,
		`DELETE FROM actions WHERE decision_id IN (
		    SELECT d.id FROM decisions d JOIN payment_events pe ON pe.id=d.payment_event_id WHERE pe.payment_id LIKE 'p2_%')`,
		`DELETE FROM audit_log WHERE entity_type IN ('decision','action') AND actor IN ('pipeline','executor')
		    AND merchant_id LIKE 'p2m_%'`,
		`DELETE FROM decisions WHERE payment_event_id IN (SELECT id FROM payment_events WHERE payment_id LIKE 'p2_%')`,
		`DELETE FROM erv_scores WHERE payment_event_id IN (SELECT id FROM payment_events WHERE payment_id LIKE 'p2_%')`,
		`DELETE FROM success_model_scores WHERE payment_event_id IN (SELECT id FROM payment_events WHERE payment_id LIKE 'p2_%')`,
		`DELETE FROM diagnoses WHERE payment_event_id IN (SELECT id FROM payment_events WHERE payment_id LIKE 'p2_%')`,
		`DELETE FROM payment_events WHERE payment_id LIKE 'p2_%'`,
		`DELETE FROM payments WHERE id LIKE 'p2_%'`,
	}
	for _, q := range stmts {
		if _, err := db.ExecContext(ctx, q); err != nil {
			t.Fatalf("cleanup (%s): %v", q, err)
		}
	}
}

// TestIntegration_Pipeline_EndToEndRecovered runs the full slice for a transient decline and
// asserts every stage persisted, plus the terminal recovery_state and visible transitions.
func TestIntegration_Pipeline_EndToEndRecovered(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()
	cleanupPipeline(t, db)
	seedMerchant(t, db, "p2m_healthy", 3, 500, false)
	s := New(db)
	runner := pipeline.NewRunner(s, executor.MockDispatcher{}, nil)

	peID := ingestOne(t, s, "p2m_healthy", "p2_recovered", "p2_evt_recovered", "Issuer declined, try again", 500000, 0)

	if err := runner.Process(context.Background(), peID); err != nil {
		t.Fatalf("pipeline Process: %v", err)
	}

	// A diagnosis was written.
	if n := scalarInt(t, db, `SELECT count(*) FROM diagnoses WHERE payment_event_id=$1::uuid`, peID); n != 1 {
		t.Fatalf("expected 1 diagnosis, got %d", n)
	}
	// Per-candidate ERV + success scores were written (same count, one per candidate).
	ervN := scalarInt(t, db, `SELECT count(*) FROM erv_scores WHERE payment_event_id=$1::uuid`, peID)
	smN := scalarInt(t, db, `SELECT count(*) FROM success_model_scores WHERE payment_event_id=$1::uuid`, peID)
	if ervN < 2 || ervN != smN {
		t.Fatalf("expected matching per-candidate erv/success scores (>=2), got erv=%d success=%d", ervN, smN)
	}

	// Exactly one decision, chosen action is a real intervention, terminal state DONE.
	var chosen, state, policyResult string
	var decisionID string
	if err := db.QueryRow(
		`SELECT id, chosen_action::text, recovery_state::text, policy_check_result::text
		   FROM decisions WHERE payment_event_id=$1::uuid`, peID,
	).Scan(&decisionID, &chosen, &state, &policyResult); err != nil {
		t.Fatalf("read decision: %v", err)
	}
	if chosen == string(domain.ActionNoAction) {
		t.Fatalf("expected an intervention, got no_action")
	}
	if state != string(domain.StateDone) {
		t.Fatalf("recovery_state = %s, want DONE", state)
	}
	if policyResult != string(domain.PolicyAllow) {
		t.Fatalf("policy_check_result = %s, want ALLOW", policyResult)
	}

	// Exactly one confirmed action, one outcome recovering the full amount.
	if n := scalarInt(t, db, `SELECT count(*) FROM actions WHERE decision_id=$1::uuid`, decisionID); n != 1 {
		t.Fatalf("expected 1 action, got %d", n)
	}
	var status string
	var recovered sql.NullInt64
	if err := db.QueryRow(
		`SELECT a.status::text, o.recovered_amount
		   FROM actions a JOIN outcomes o ON o.action_id=a.id WHERE a.decision_id=$1::uuid`, decisionID,
	).Scan(&status, &recovered); err != nil {
		t.Fatalf("read action/outcome: %v", err)
	}
	if status != string(domain.ActionStatusConfirmed) {
		t.Fatalf("action status = %s, want confirmed", status)
	}
	if !recovered.Valid || recovered.Int64 != 500000 {
		t.Fatalf("recovered_amount = %v, want 500000", recovered)
	}

	// Visible transitions: two audit rows (decision + execution), execution carries a DONE
	// state history reaching RECOVERED then DONE.
	if n := scalarInt(t, db, `SELECT count(*) FROM audit_log WHERE entity_id=$1 AND entity_type='decision'`, decisionID); n != 1 {
		t.Fatalf("expected 1 decision audit row, got %d", n)
	}
	histReachesDone := scalarInt(t, db,
		`SELECT count(*) FROM audit_log
		   WHERE entity_type='action' AND actor='executor'
		     AND details_json->>'final_state' = 'DONE'
		     AND details_json->'state_history' ? 'RECOVERED'`)
	if histReachesDone != 1 {
		t.Fatalf("expected exactly 1 execution audit reaching DONE via RECOVERED, got %d", histReachesDone)
	}
}

// TestIntegration_Pipeline_KillSwitchStops asserts a kill-switched merchant produces a
// no_action decision at STOPPED, with no action/outcome rows.
func TestIntegration_Pipeline_KillSwitchStops(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()
	cleanupPipeline(t, db)
	seedMerchant(t, db, "p2m_killed", 3, 500, true)
	s := New(db)
	runner := pipeline.NewRunner(s, executor.MockDispatcher{}, nil)

	peID := ingestOne(t, s, "p2m_killed", "p2_killed", "p2_evt_killed", "Issuer declined", 500000, 0)
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
		t.Fatalf("kill switch: chosen = %s, want no_action", chosen)
	}
	if state != string(domain.StateStopped) {
		t.Fatalf("kill switch: recovery_state = %s, want STOPPED", state)
	}
	if n := scalarInt(t, db, `SELECT count(*) FROM actions WHERE decision_id=$1::uuid`, decisionID); n != 0 {
		t.Fatalf("kill switch: expected 0 actions, got %d", n)
	}
}

// TestIntegration_Pipeline_IdempotentAction proves the DB unique idempotency_key prevents a
// duplicate financial action: finalizing the same execution twice yields exactly one action
// row and one outcome, with the second call reporting created=false.
func TestIntegration_Pipeline_IdempotentAction(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()
	cleanupPipeline(t, db)
	seedMerchant(t, db, "p2m_idem", 3, 500, false)
	s := New(db)

	peID := ingestOne(t, s, "p2m_idem", "p2_idem", "p2_evt_idem", "Issuer declined", 500000, 0)

	// Persist a minimal decision to hang the action off of.
	decID, err := s.PersistDecision(context.Background(), pipeline.DecisionRecord{
		PaymentEventID: peID, MerchantID: "p2m_idem",
		RootCause: domain.RootTemporaryBankDecline, Confidence: 0.6, Rationale: "test",
		DiagnosisModelVersion: "rules-v1", SuccessModelVersion: "heuristic-v1",
		Candidates: []pipeline.CandidateRecord{
			{Action: domain.ActionRetry, PSuccess: 0.4, RecoverableAmount: 500000, Cost: 200, FrictionPenalty: 200, ERV: 199600},
		},
		ChosenAction: domain.ActionRetry, ERVAtDecision: 199600,
		PolicyVersion: "policy-v1", PolicyCheckResult: domain.PolicyAllow,
		RecoveryState: domain.StateActionSelected,
		StateHistory:  []domain.RecoveryState{domain.StateFailed, domain.StateDiagnosed, domain.StateRecoveryEligible, domain.StateActionSelected},
	})
	if err != nil {
		t.Fatalf("persist decision: %v", err)
	}

	key := executor.IdempotencyKey("p2_idem", decID, domain.ActionRetry)
	amt := int64(500000)
	exec := pipeline.ExecutionRecord{
		DecisionID: decID, MerchantID: "p2m_idem", PaymentID: "p2_idem",
		Action: domain.ActionRetry, IdempotencyKey: key, ExternalIdempotencyKey: "mock-ref",
		ActionStatus: domain.ActionStatusConfirmed, OutcomeResult: "mock_recovered",
		Recovered: true, RecoveredAmount: &amt,
		FinalState:   domain.StateDone,
		StateHistory: []domain.RecoveryState{domain.StateActionPending, domain.StateRecovered, domain.StateDone},
	}

	first, err := s.FinalizeExecution(context.Background(), exec)
	if err != nil {
		t.Fatalf("first finalize: %v", err)
	}
	if !first {
		t.Fatal("first finalize should report created=true")
	}
	second, err := s.FinalizeExecution(context.Background(), exec)
	if err != nil {
		t.Fatalf("second finalize: %v", err)
	}
	if second {
		t.Fatal("duplicate finalize must report created=false")
	}

	if n := scalarInt(t, db, `SELECT count(*) FROM actions WHERE idempotency_key=$1`, key); n != 1 {
		t.Fatalf("expected exactly 1 action row for the idempotency key, got %d", n)
	}
	if n := scalarInt(t, db, `SELECT count(*) FROM outcomes o JOIN actions a ON a.id=o.action_id WHERE a.idempotency_key=$1`, key); n != 1 {
		t.Fatalf("expected exactly 1 outcome, got %d", n)
	}
}

// TestIntegration_Pipeline_ConcurrentDuplicateFire is the strongest idempotency form: N
// concurrent finalizations of the same action still yield exactly one action row.
func TestIntegration_Pipeline_ConcurrentDuplicateFire(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()
	cleanupPipeline(t, db)
	seedMerchant(t, db, "p2m_conc", 3, 500, false)
	s := New(db)

	peID := ingestOne(t, s, "p2m_conc", "p2_conc", "p2_evt_conc", "Issuer declined", 500000, 0)
	decID, err := s.PersistDecision(context.Background(), pipeline.DecisionRecord{
		PaymentEventID: peID, MerchantID: "p2m_conc",
		RootCause: domain.RootTemporaryBankDecline, Confidence: 0.6, Rationale: "test",
		DiagnosisModelVersion: "rules-v1", SuccessModelVersion: "heuristic-v1",
		Candidates:   []pipeline.CandidateRecord{{Action: domain.ActionRetry, PSuccess: 0.4, RecoverableAmount: 500000, Cost: 200, FrictionPenalty: 200, ERV: 199600}},
		ChosenAction: domain.ActionRetry, ERVAtDecision: 199600,
		PolicyVersion: "policy-v1", PolicyCheckResult: domain.PolicyAllow,
		RecoveryState: domain.StateActionSelected,
		StateHistory:  []domain.RecoveryState{domain.StateFailed, domain.StateDiagnosed, domain.StateRecoveryEligible, domain.StateActionSelected},
	})
	if err != nil {
		t.Fatalf("persist decision: %v", err)
	}

	key := executor.IdempotencyKey("p2_conc", decID, domain.ActionRetry)
	amt := int64(500000)
	exec := pipeline.ExecutionRecord{
		DecisionID: decID, MerchantID: "p2m_conc", PaymentID: "p2_conc",
		Action: domain.ActionRetry, IdempotencyKey: key, ExternalIdempotencyKey: "mock-ref",
		ActionStatus: domain.ActionStatusConfirmed, OutcomeResult: "mock_recovered",
		Recovered: true, RecoveredAmount: &amt,
		FinalState:   domain.StateDone,
		StateHistory: []domain.RecoveryState{domain.StateActionPending, domain.StateRecovered, domain.StateDone},
	}

	const n = 16
	created := make([]bool, n)
	errs := make([]error, n)
	done := make(chan struct{})
	start := make(chan struct{})
	for i := 0; i < n; i++ {
		go func(i int) {
			<-start
			created[i], errs[i] = s.FinalizeExecution(context.Background(), exec)
			done <- struct{}{}
		}(i)
	}
	close(start)
	for i := 0; i < n; i++ {
		<-done
	}

	createdCount := 0
	for i := 0; i < n; i++ {
		if errs[i] != nil {
			t.Fatalf("goroutine %d errored: %v", i, errs[i])
		}
		if created[i] {
			createdCount++
		}
	}
	if createdCount != 1 {
		t.Fatalf("expected exactly 1 creator under concurrency, got %d", createdCount)
	}
	if got := scalarInt(t, db, `SELECT count(*) FROM actions WHERE idempotency_key=$1`, key); got != 1 {
		t.Fatalf("expected exactly 1 action row, got %d", got)
	}
}

// TestIntegration_Pipeline_ContextNotFound: LoadContext returns ErrContextNotFound for an
// unknown payment_event id.
func TestIntegration_Pipeline_ContextNotFound(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()
	s := New(db)
	_, err := s.LoadContext(context.Background(), "00000000-0000-0000-0000-000000000000")
	if err != ErrContextNotFound {
		t.Fatalf("expected ErrContextNotFound, got %v", err)
	}
}

func scalarInt(t *testing.T, db *sql.DB, q string, args ...any) int {
	t.Helper()
	var n int
	if err := db.QueryRow(q, args...).Scan(&n); err != nil {
		t.Fatalf("scalar query (%s): %v", q, err)
	}
	return n
}
