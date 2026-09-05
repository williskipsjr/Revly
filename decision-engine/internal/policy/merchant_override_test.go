package policy

import "testing"

func f64(v float64) *float64 { return &v }

// platform is a representative platform policy for resolution tests.
func platform() Platform {
	return Platform{
		GlobalKillSwitch:   false,
		ConfidenceFloor:    0.40,
		MaxRetriesCeiling:  5,
		MinCooldownMinutes: 10,
		MaxAmountCeiling:   100_000_000,
		MaxDailyActionCap:  50,
	}
}

// TestResolve_MerchantWithinBoundsUnchanged: a merchant whose config is already inside every
// platform bound is passed through untouched.
func TestResolve_MerchantWithinBoundsUnchanged(t *testing.T) {
	m := MerchantConfig{
		MaxRetries: 3, CooldownMinutes: 30, MinERVThreshold: 5000,
		DailyActionCap: 20, AmountCeiling: 5_000_000, KillSwitch: false,
	}
	got := ResolveMerchantPolicy(m, platform())
	want := Resolved{
		MaxRetries: 3, CooldownMinutes: 30, MinERVThreshold: 5000,
		DailyActionCap: 20, AmountCeiling: 5_000_000, ConfidenceFloor: 0.40,
		KillSwitch: false, GlobalKillSwitch: false,
	}
	if got != want {
		t.Fatalf("resolved = %+v, want %+v", got, want)
	}
}

// TestResolve_ClampsUnsafeOverrides: a merchant trying to loosen every knob past the platform
// bounds is clamped back to the safe side of each.
func TestResolve_ClampsUnsafeOverrides(t *testing.T) {
	m := MerchantConfig{
		MaxRetries:      99,          // > ceiling 5      → 5
		CooldownMinutes: 1,           // < min 10         → 10
		DailyActionCap:  999,         // > max 50         → 50
		AmountCeiling:   999_999_999, // > max 1e8       → 1e8
	}
	got := ResolveMerchantPolicy(m, platform())
	if got.MaxRetries != 5 {
		t.Errorf("MaxRetries = %d, want clamped to 5", got.MaxRetries)
	}
	if got.CooldownMinutes != 10 {
		t.Errorf("CooldownMinutes = %d, want raised to 10", got.CooldownMinutes)
	}
	if got.DailyActionCap != 50 {
		t.Errorf("DailyActionCap = %d, want clamped to 50", got.DailyActionCap)
	}
	if got.AmountCeiling != 100_000_000 {
		t.Errorf("AmountCeiling = %d, want clamped to 1e8", got.AmountCeiling)
	}
}

// TestResolve_ZeroCapsBecomePlatformMax: a merchant "0" for amount ceiling / daily cap means
// "unbounded" to the engine; resolution replaces it with the platform maximum so no merchant
// gets truly unlimited automated money movement or unlimited daily actions.
func TestResolve_ZeroCapsBecomePlatformMax(t *testing.T) {
	m := MerchantConfig{AmountCeiling: 0, DailyActionCap: 0, MaxRetries: 3, CooldownMinutes: 30}
	got := ResolveMerchantPolicy(m, platform())
	if got.AmountCeiling != 100_000_000 {
		t.Errorf("zero amount ceiling → %d, want platform max 1e8", got.AmountCeiling)
	}
	if got.DailyActionCap != 50 {
		t.Errorf("zero daily cap → %d, want platform max 50", got.DailyActionCap)
	}
}

// TestResolve_ConfidenceFloorOnlyRaised: the merchant override may raise the confidence floor
// above the platform floor, but a lower override is ignored (the platform floor holds).
func TestResolve_ConfidenceFloorOnlyRaised(t *testing.T) {
	raised := ResolveMerchantPolicy(MerchantConfig{ConfidenceFloorOverride: f64(0.70)}, platform())
	if raised.ConfidenceFloor != 0.70 {
		t.Errorf("raised floor = %v, want 0.70", raised.ConfidenceFloor)
	}
	lowered := ResolveMerchantPolicy(MerchantConfig{ConfidenceFloorOverride: f64(0.10)}, platform())
	if lowered.ConfidenceFloor != 0.40 {
		t.Errorf("attempted-lowered floor = %v, want platform floor 0.40", lowered.ConfidenceFloor)
	}
	none := ResolveMerchantPolicy(MerchantConfig{}, platform())
	if none.ConfidenceFloor != 0.40 {
		t.Errorf("no override floor = %v, want platform floor 0.40", none.ConfidenceFloor)
	}
}

// TestResolve_GlobalKillSwitchAndMerchantKillSwitch: both kill switches flow through resolution
// independently.
func TestResolve_KillSwitchesFlowThrough(t *testing.T) {
	p := platform()
	p.GlobalKillSwitch = true
	got := ResolveMerchantPolicy(MerchantConfig{KillSwitch: true}, p)
	if !got.KillSwitch || !got.GlobalKillSwitch {
		t.Fatalf("kill switches = merchant %v global %v, want both true", got.KillSwitch, got.GlobalKillSwitch)
	}
}

// TestResolve_NoPlatformCeilingLeavesMerchant: when the platform sets a ceiling of 0 ("no
// platform ceiling"), the merchant value is left as-is.
func TestResolve_NoPlatformCeilingLeavesMerchant(t *testing.T) {
	p := Platform{ConfidenceFloor: 0.40} // all ceilings zero
	m := MerchantConfig{MaxRetries: 99, AmountCeiling: 999_999_999, DailyActionCap: 999, CooldownMinutes: 1}
	got := ResolveMerchantPolicy(m, p)
	if got.MaxRetries != 99 || got.AmountCeiling != 999_999_999 || got.DailyActionCap != 999 {
		t.Fatalf("with no platform ceilings, merchant values should stand: %+v", got)
	}
	// MinCooldownMinutes 0 → merchant cooldown of 1 stands.
	if got.CooldownMinutes != 1 {
		t.Errorf("CooldownMinutes = %d, want 1 (no platform minimum)", got.CooldownMinutes)
	}
}

// TestDefaultPlatform_MatchesConstants keeps the in-code fallback aligned with the documented
// platform defaults (and thus the migration DEFAULTs).
func TestDefaultPlatform_MatchesConstants(t *testing.T) {
	p := DefaultPlatform()
	if p.ConfidenceFloor != DefaultPlatformConfidenceFloor ||
		p.MaxRetriesCeiling != DefaultMaxRetriesCeiling ||
		p.MinCooldownMinutes != DefaultMinCooldownMinutes ||
		p.MaxAmountCeiling != DefaultMaxAmountCeiling ||
		p.MaxDailyActionCap != DefaultMaxDailyActionCap ||
		p.GlobalKillSwitch {
		t.Fatalf("DefaultPlatform drifted from the documented constants: %+v", p)
	}
}
