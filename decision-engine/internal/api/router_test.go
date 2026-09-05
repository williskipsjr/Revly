package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/policy"
)

type fakeRepo struct {
	platform    policy.Platform
	getErr      error
	overrideErr error
	updateErr   error
	lastKill    *struct {
		scope string
		on    bool
	}
}

func (f *fakeRepo) MerchantExists(context.Context, string) (bool, error) { return true, nil }
func (f *fakeRepo) ListRecentDecisions(context.Context, string, int) ([]DecisionSummary, error) {
	return []DecisionSummary{{DecisionID: "d1", ChosenAction: "retry", PolicyResult: "ALLOW"}}, nil
}
func (f *fakeRepo) ListDecisionsByPayment(context.Context, string, string) ([]DecisionSummary, error) {
	return []DecisionSummary{{DecisionID: "d1"}}, nil
}
func (f *fakeRepo) GetDecision(context.Context, string, string) (DecisionDetail, error) {
	if f.getErr != nil {
		return DecisionDetail{}, f.getErr
	}
	return DecisionDetail{DecisionSummary: DecisionSummary{DecisionID: "d1"}, RootCause: "temporary_bank_decline"}, nil
}
func (f *fakeRepo) RecordOverride(context.Context, string, string, string, string, string) error {
	return f.overrideErr
}
func (f *fakeRepo) SetMerchantKillSwitch(_ context.Context, _ string, on bool, _ string) error {
	f.lastKill = &struct {
		scope string
		on    bool
	}{"merchant", on}
	return nil
}
func (f *fakeRepo) SetGlobalKillSwitch(_ context.Context, on bool, _ string) error {
	f.lastKill = &struct {
		scope string
		on    bool
	}{"global", on}
	return nil
}
func (f *fakeRepo) RecoverySummary(context.Context, string) (RecoverySummary, error) {
	return RecoverySummary{MerchantID: "m", RecoveryRate: 0.5}, nil
}
func (f *fakeRepo) AuditByPayment(context.Context, string, string) ([]AuditEntry, error) {
	return []AuditEntry{{ID: 1, EntityType: "decision"}}, nil
}
func (f *fakeRepo) GetPolicyConfig(context.Context, string) (MerchantPolicyConfig, error) {
	return MerchantPolicyConfig{MaxRetries: 3}, nil
}
func (f *fakeRepo) UpdatePolicyConfig(context.Context, string, MerchantPolicyConfig, string) error {
	return f.updateErr
}
func (f *fakeRepo) LoadPlatform(context.Context) (policy.Platform, error) { return f.platform, nil }

func newServer(repo Repository, auth Auth) *httptest.Server {
	mux := http.NewServeMux()
	NewHandlers(repo, auth, nil).Register(mux)
	return httptest.NewServer(mux)
}

func do(t *testing.T, method, url, key, body string) *http.Response {
	t.Helper()
	var r *http.Request
	if body != "" {
		r, _ = http.NewRequest(method, url, strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
	} else {
		r, _ = http.NewRequest(method, url, nil)
	}
	if key != "" {
		r.Header.Set("X-API-Key", key)
	}
	resp, err := http.DefaultClient.Do(r)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	return resp
}

func TestAuth_MerchantKeyRequired(t *testing.T) {
	srv := newServer(&fakeRepo{}, Auth{MerchantKey: "secret"})
	defer srv.Close()
	if resp := do(t, "GET", srv.URL+"/v1/merchants/m/decisions", "", ""); resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("no key: got %d, want 401", resp.StatusCode)
	}
	if resp := do(t, "GET", srv.URL+"/v1/merchants/m/decisions", "secret", ""); resp.StatusCode != http.StatusOK {
		t.Fatalf("with key: got %d, want 200", resp.StatusCode)
	}
}

func TestAuth_AdminKeyGatesKillSwitch(t *testing.T) {
	repo := &fakeRepo{}
	srv := newServer(repo, Auth{MerchantKey: "m", AdminKey: "admin"})
	defer srv.Close()
	// merchant key is not sufficient for an admin route.
	if resp := do(t, "POST", srv.URL+"/v1/merchants/m/policy/kill-switch", "m", `{"scope":"global","enabled":true}`); resp.StatusCode != http.StatusForbidden {
		t.Fatalf("merchant key on admin route: got %d, want 403", resp.StatusCode)
	}
	if resp := do(t, "POST", srv.URL+"/v1/merchants/m/policy/kill-switch", "admin", `{"scope":"global","enabled":true}`); resp.StatusCode != http.StatusOK {
		t.Fatalf("admin key: got %d, want 200", resp.StatusCode)
	}
	if repo.lastKill == nil || repo.lastKill.scope != "global" || !repo.lastKill.on {
		t.Fatalf("kill switch not applied: %+v", repo.lastKill)
	}
}

func TestGetDecision_NotFoundMapsTo404(t *testing.T) {
	srv := newServer(&fakeRepo{getErr: ErrNotFound}, Auth{})
	defer srv.Close()
	if resp := do(t, "GET", srv.URL+"/v1/merchants/m/decisions/x", "", ""); resp.StatusCode != http.StatusNotFound {
		t.Fatalf("got %d, want 404", resp.StatusCode)
	}
}

func TestOverride_RequiresReason(t *testing.T) {
	srv := newServer(&fakeRepo{}, Auth{})
	defer srv.Close()
	if resp := do(t, "POST", srv.URL+"/v1/merchants/m/decisions/d1/override", "", `{"action":"retry"}`); resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("missing reason: got %d, want 400", resp.StatusCode)
	}
	if resp := do(t, "POST", srv.URL+"/v1/merchants/m/decisions/d1/override", "", `{"action":"retry","reason":"manual"}`); resp.StatusCode != http.StatusOK {
		t.Fatalf("valid override: got %d, want 200", resp.StatusCode)
	}
}

func TestUpdatePolicyConfig_BoundsViolationIs400(t *testing.T) {
	srv := newServer(&fakeRepo{updateErr: ErrPolicyBounds}, Auth{})
	defer srv.Close()
	resp := do(t, "PUT", srv.URL+"/v1/merchants/m/policy-config", "",
		`{"max_retries":99,"cooldown_minutes":30,"min_erv_threshold":500,"daily_action_cap":5,"amount_ceiling":100000}`)
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("bounds violation: got %d, want 400", resp.StatusCode)
	}
}
