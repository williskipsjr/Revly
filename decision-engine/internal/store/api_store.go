package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/api"
	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/policy"
)

// Compile-time assertion that Store satisfies the public-API persistence boundary.
var _ api.Repository = (*Store)(nil)

func (s *Store) MerchantExists(ctx context.Context, merchantID string) (bool, error) {
	var one int
	err := s.db.QueryRowContext(ctx, merchantExistsSQL, merchantID).Scan(&one)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return false, nil
	case err != nil:
		return false, fmt.Errorf("store: merchant exists: %w", err)
	}
	return true, nil
}

func (s *Store) ListRecentDecisions(ctx context.Context, merchantID string, limit int) ([]api.DecisionSummary, error) {
	return s.queryDecisionSummaries(ctx, listRecentDecisionsSQL, merchantID, limit)
}

func (s *Store) ListDecisionsByPayment(ctx context.Context, merchantID, paymentID string) ([]api.DecisionSummary, error) {
	return s.queryDecisionSummaries(ctx, listDecisionsByPaymentSQL, merchantID, paymentID)
}

func (s *Store) queryDecisionSummaries(ctx context.Context, query string, args ...any) ([]api.DecisionSummary, error) {
	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("store: list decisions: %w", err)
	}
	defer func() { _ = rows.Close() }()

	out := []api.DecisionSummary{}
	for rows.Next() {
		var d api.DecisionSummary
		var decidedAt time.Time
		if err := rows.Scan(&d.DecisionID, &d.PaymentEventID, &d.PaymentID, &d.ChosenAction,
			&d.ERVAtDecision, &d.PolicyResult, &d.PolicyVersion, &d.RecoveryState, &decidedAt); err != nil {
			return nil, fmt.Errorf("store: scan decision summary: %w", err)
		}
		d.DecidedAt = decidedAt.UTC().Format(time.RFC3339)
		out = append(out, d)
	}
	return out, rows.Err()
}

func (s *Store) GetDecision(ctx context.Context, merchantID, decisionID string) (api.DecisionDetail, error) {
	var d api.DecisionDetail
	var decidedAt time.Time
	var policyChecks []byte
	err := s.db.QueryRowContext(ctx, getDecisionSQL, decisionID, merchantID).Scan(
		&d.DecisionID, &d.PaymentEventID, &d.PaymentID, &d.ChosenAction, &d.ERVAtDecision,
		&d.PolicyResult, &d.PolicyVersion, &d.RecoveryState, &decidedAt, &d.MerchantID,
		&d.RootCause, &d.Confidence, &d.Rationale, &d.DiagnosisModelVersion, &d.SuccessModelVersion,
		&policyChecks,
	)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return api.DecisionDetail{}, api.ErrNotFound
	case err != nil:
		return api.DecisionDetail{}, fmt.Errorf("store: get decision: %w", err)
	}
	d.DecidedAt = decidedAt.UTC().Format(time.RFC3339)
	if len(policyChecks) > 0 {
		d.PolicyChecks = policyChecks
	}

	crows, err := s.db.QueryContext(ctx, getDecisionCandidatesSQL, d.PaymentEventID)
	if err != nil {
		return api.DecisionDetail{}, fmt.Errorf("store: get decision candidates: %w", err)
	}
	defer func() { _ = crows.Close() }()
	d.Candidates = []api.CandidateScore{}
	for crows.Next() {
		var c api.CandidateScore
		if err := crows.Scan(&c.Action, &c.PSuccess, &c.RecoverableAmount, &c.Cost, &c.FrictionPenalty, &c.ERV); err != nil {
			return api.DecisionDetail{}, fmt.Errorf("store: scan candidate: %w", err)
		}
		d.Candidates = append(d.Candidates, c)
	}
	return d, crows.Err()
}

func (s *Store) RecordOverride(ctx context.Context, merchantID, decisionID, actor, reason, newAction string) error {
	var fromAction string
	err := s.db.QueryRowContext(ctx, decisionOwnedSQL, decisionID, merchantID).Scan(&fromAction)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return api.ErrNotFound
	case err != nil:
		return fmt.Errorf("store: verify decision owner: %w", err)
	}
	details := mustJSON(map[string]any{
		"stage": "override", "decision_id": decisionID,
		"from_action": fromAction, "to_action": newAction, "reason": reason, "actor": actor,
	})
	// The decision row is immutable (PLAN.md §11) — the override is recorded to the audit log,
	// not written over the original decision.
	if _, err := s.db.ExecContext(ctx, insertAuditSQL, merchantID, "decision", decisionID, actor, details); err != nil {
		return fmt.Errorf("store: insert override audit: %w", err)
	}
	return nil
}

func (s *Store) SetMerchantKillSwitch(ctx context.Context, merchantID string, on bool, actor string) error {
	res, err := s.db.ExecContext(ctx, setMerchantKillSwitchSQL, merchantID, on)
	if err != nil {
		return fmt.Errorf("store: set merchant kill switch: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return api.ErrNotFound
	}
	details := mustJSON(map[string]any{"stage": "kill_switch", "scope": "merchant", "enabled": on, "actor": actor})
	_, err = s.db.ExecContext(ctx, insertAuditSQL, merchantID, "policy", merchantID, actor, details)
	return err
}

func (s *Store) SetGlobalKillSwitch(ctx context.Context, on bool, actor string) error {
	if _, err := s.db.ExecContext(ctx, ensurePlatformRowSQL); err != nil {
		return fmt.Errorf("store: ensure platform row: %w", err)
	}
	if _, err := s.db.ExecContext(ctx, setGlobalKillSwitchSQL, on); err != nil {
		return fmt.Errorf("store: set global kill switch: %w", err)
	}
	// Platform-scope audit rows have a NULL merchant_id.
	details := mustJSON(map[string]any{"stage": "kill_switch", "scope": "global", "enabled": on, "actor": actor})
	_, err := s.db.ExecContext(ctx, insertAuditSQL, nil, "platform_policy", "platform", actor, details)
	return err
}

func (s *Store) RecoverySummary(ctx context.Context, merchantID string) (api.RecoverySummary, error) {
	sum := api.RecoverySummary{MerchantID: merchantID}
	err := s.db.QueryRowContext(ctx, recoverySummarySQL, merchantID).Scan(
		&sum.TotalDecisions, &sum.TotalActions, &sum.RecoveredCount, &sum.RecoveredAmount,
		&sum.InterventionCost, &sum.HumanReviewCount, &sum.NoActionCount,
	)
	if err != nil {
		return api.RecoverySummary{}, fmt.Errorf("store: recovery summary: %w", err)
	}
	sum.NetRecovered = float64(sum.RecoveredAmount) - sum.InterventionCost
	if sum.TotalDecisions > 0 {
		sum.RecoveryRate = float64(sum.RecoveredCount) / float64(sum.TotalDecisions)
	}
	return sum, nil
}

func (s *Store) AuditByPayment(ctx context.Context, merchantID, paymentID string) ([]api.AuditEntry, error) {
	rows, err := s.db.QueryContext(ctx, auditByPaymentSQL, merchantID, paymentID)
	if err != nil {
		return nil, fmt.Errorf("store: audit by payment: %w", err)
	}
	defer func() { _ = rows.Close() }()

	out := []api.AuditEntry{}
	for rows.Next() {
		var e api.AuditEntry
		var details []byte
		var at time.Time
		if err := rows.Scan(&e.ID, &e.EntityType, &e.EntityID, &e.Actor, &details, &at); err != nil {
			return nil, fmt.Errorf("store: scan audit entry: %w", err)
		}
		if len(details) > 0 {
			e.Details = details
		}
		e.At = at.UTC().Format(time.RFC3339)
		out = append(out, e)
	}
	return out, rows.Err()
}

func (s *Store) GetPolicyConfig(ctx context.Context, merchantID string) (api.MerchantPolicyConfig, error) {
	var cfg api.MerchantPolicyConfig
	var confFloor sql.NullFloat64
	err := s.db.QueryRowContext(ctx, getPolicyConfigSQL, merchantID).Scan(
		&cfg.MaxRetries, &cfg.CooldownMinutes, &cfg.MinERVThreshold, &cfg.DailyActionCap,
		&cfg.AmountCeiling, &confFloor, &cfg.KillSwitch,
	)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return api.MerchantPolicyConfig{}, api.ErrNotFound
	case err != nil:
		return api.MerchantPolicyConfig{}, fmt.Errorf("store: get policy config: %w", err)
	}
	if confFloor.Valid {
		v := confFloor.Float64
		cfg.ConfidenceFloorOverride = &v
	}
	return cfg, nil
}

func (s *Store) UpdatePolicyConfig(ctx context.Context, merchantID string, cfg api.MerchantPolicyConfig, actor string) error {
	plat, err := s.LoadPlatform(ctx)
	if err != nil {
		return err
	}
	// Reject any edit that would loosen policy past a platform ceiling (PLAN.md §6). Values are
	// validated here so a rejected edit is explicit; resolution also re-clamps at decision time.
	if plat.MaxRetriesCeiling > 0 && cfg.MaxRetries > plat.MaxRetriesCeiling {
		return fmt.Errorf("%w: max_retries %d exceeds platform ceiling %d", api.ErrPolicyBounds, cfg.MaxRetries, plat.MaxRetriesCeiling)
	}
	if cfg.CooldownMinutes < plat.MinCooldownMinutes {
		return fmt.Errorf("%w: cooldown_minutes %d below platform minimum %d", api.ErrPolicyBounds, cfg.CooldownMinutes, plat.MinCooldownMinutes)
	}
	if plat.MaxAmountCeiling > 0 && cfg.AmountCeiling > plat.MaxAmountCeiling {
		return fmt.Errorf("%w: amount_ceiling %d exceeds platform maximum %d", api.ErrPolicyBounds, cfg.AmountCeiling, plat.MaxAmountCeiling)
	}
	if plat.MaxDailyActionCap > 0 && cfg.DailyActionCap > plat.MaxDailyActionCap {
		return fmt.Errorf("%w: daily_action_cap %d exceeds platform maximum %d", api.ErrPolicyBounds, cfg.DailyActionCap, plat.MaxDailyActionCap)
	}
	if cfg.ConfidenceFloorOverride != nil && *cfg.ConfidenceFloorOverride < plat.ConfidenceFloor {
		return fmt.Errorf("%w: confidence_floor_override %.3f below platform floor %.3f", api.ErrPolicyBounds, *cfg.ConfidenceFloorOverride, plat.ConfidenceFloor)
	}

	res, err := s.db.ExecContext(ctx, updatePolicyConfigSQL,
		merchantID, cfg.MaxRetries, cfg.CooldownMinutes, cfg.MinERVThreshold,
		cfg.DailyActionCap, cfg.AmountCeiling, nullableFloat(cfg.ConfidenceFloorOverride),
	)
	if err != nil {
		return fmt.Errorf("store: update policy config: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return api.ErrNotFound
	}
	details := mustJSON(map[string]any{
		"stage": "policy_config_update", "actor": actor,
		"max_retries": cfg.MaxRetries, "cooldown_minutes": cfg.CooldownMinutes,
		"min_erv_threshold": cfg.MinERVThreshold, "daily_action_cap": cfg.DailyActionCap,
		"amount_ceiling": cfg.AmountCeiling,
	})
	_, err = s.db.ExecContext(ctx, insertAuditSQL, merchantID, "policy", merchantID, actor, details)
	return err
}

func (s *Store) LoadPlatform(ctx context.Context) (policy.Platform, error) {
	var p policy.Platform
	err := s.db.QueryRowContext(ctx, loadPlatformSQL).Scan(
		&p.GlobalKillSwitch, &p.ConfidenceFloor, &p.MaxRetriesCeiling,
		&p.MinCooldownMinutes, &p.MaxAmountCeiling, &p.MaxDailyActionCap,
	)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return policy.DefaultPlatform(), nil
	case err != nil:
		return policy.Platform{}, fmt.Errorf("store: load platform: %w", err)
	}
	return p, nil
}

// nullableFloat stores a nil override as SQL NULL.
func nullableFloat(p *float64) any {
	if p == nil {
		return nil
	}
	return *p
}
