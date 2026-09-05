// merchant_override.go — Phase 5 override resolution (PLAN.md §6).
//
// PLAN.md §6 makes several policy knobs merchant-overridable, but every override is "within
// safe bounds": a merchant may make policy SAFER (fewer retries, longer cooldown, a higher
// confidence floor, a lower amount ceiling / daily cap) but never weaker than the platform
// allows. This file resolves a merchant's raw config against the platform ceilings into the
// single set of values the pure engine (engine.go) enforces. Resolution is itself a pure,
// deterministic function — no I/O — so it is unit-testable and the resolved values are what a
// decision records.
//
// Direction of every bound (why each clamp is the SAFE direction):
//   - max_retries      → min(merchant, platform ceiling)   fewer charge re-attempts is safer
//   - cooldown_minutes → max(merchant, platform minimum)   waiting longer between retries is safer
//   - amount_ceiling   → min(merchant, platform maximum)   a lower automated-money-movement bar is safer
//   - daily_action_cap → min(merchant, platform maximum)   fewer actions per customer is safer
//   - confidence_floor → max(platform floor, merchant)     a higher gate is safer (never below platform)
//   - min_erv_threshold→ merchant value as-is              purely economic, no platform safety bound (PLAN.md §6)
//
// A merchant "0" for amount_ceiling / daily_action_cap means "unbounded" in the engine (rule
// disabled); resolution treats that as the platform maximum instead, so no merchant can obtain
// truly unlimited automated money movement or unlimited daily actions when the platform caps them.
package policy

// Platform is the platform-wide policy (the platform_policy singleton, PLAN.md §6): the global
// kill switch, the confidence safety floor a merchant may only raise, and the ceilings that
// bound merchant overrides. It is loaded from Postgres (the durable source of truth) and, when
// that row is somehow absent, defaults to DefaultPlatform().
type Platform struct {
	GlobalKillSwitch   bool
	ConfidenceFloor    float64 // platform safety floor; merchants may raise, never lower
	MaxRetriesCeiling  int     // merchant max_retries clamped to <= this (0 = no platform ceiling)
	MinCooldownMinutes int     // merchant cooldown raised to >= this
	MaxAmountCeiling   int64   // merchant amount_ceiling clamped to <= this (0 = no platform ceiling)
	MaxDailyActionCap  int     // merchant daily_action_cap clamped to <= this (0 = no platform ceiling)
}

// Platform default values — the in-code mirror of the platform_policy column DEFAULTs
// (migrations/003_phase5_policy.sql). They are used only as the belt-and-suspenders fallback
// when the singleton row cannot be read; Postgres remains authoritative in the normal path.
const (
	DefaultPlatformConfidenceFloor = 0.400
	DefaultMaxRetriesCeiling       = 5
	DefaultMinCooldownMinutes      = 5
	DefaultMaxAmountCeiling        = int64(100_000_000) // paise (₹1,000,000)
	DefaultMaxDailyActionCap       = 50
)

// DefaultPlatform returns the platform policy matching the migration DEFAULTs, with the global
// kill switch OFF. Used as the fallback when the platform_policy row is missing.
func DefaultPlatform() Platform {
	return Platform{
		GlobalKillSwitch:   false,
		ConfidenceFloor:    DefaultPlatformConfidenceFloor,
		MaxRetriesCeiling:  DefaultMaxRetriesCeiling,
		MinCooldownMinutes: DefaultMinCooldownMinutes,
		MaxAmountCeiling:   DefaultMaxAmountCeiling,
		MaxDailyActionCap:  DefaultMaxDailyActionCap,
	}
}

// MerchantConfig is a merchant's raw, unbounded policy config as stored in
// merchant_policy_config. It is the INPUT to resolution — the values before platform ceilings
// are applied. ConfidenceFloorOverride is nil when the merchant has set no override.
type MerchantConfig struct {
	MaxRetries              int
	CooldownMinutes         int
	MinERVThreshold         float64
	DailyActionCap          int
	AmountCeiling           int64
	ConfidenceFloorOverride *float64
	KillSwitch              bool
}

// Resolved is a merchant's policy after platform ceilings are applied — the exact values the
// engine enforces and a decision records. ConfidenceFloor and GlobalKillSwitch are folded in
// so the engine consumes one flat, already-safe set.
type Resolved struct {
	MaxRetries       int
	CooldownMinutes  int
	MinERVThreshold  float64
	DailyActionCap   int
	AmountCeiling    int64
	ConfidenceFloor  float64
	KillSwitch       bool
	GlobalKillSwitch bool
}

// ResolveMerchantPolicy bounds a merchant's raw config by the platform ceilings, always in the
// safe direction (see the file comment). The result is deterministic and pure.
func ResolveMerchantPolicy(m MerchantConfig, p Platform) Resolved {
	return Resolved{
		MaxRetries:       clampMaxInt(m.MaxRetries, p.MaxRetriesCeiling),
		CooldownMinutes:  atLeastInt(m.CooldownMinutes, p.MinCooldownMinutes),
		MinERVThreshold:  m.MinERVThreshold, // purely economic; no platform safety bound (PLAN.md §6)
		DailyActionCap:   clampCapInt(m.DailyActionCap, p.MaxDailyActionCap),
		AmountCeiling:    clampCapInt64(m.AmountCeiling, p.MaxAmountCeiling),
		ConfidenceFloor:  resolveConfidenceFloor(m.ConfidenceFloorOverride, p.ConfidenceFloor),
		KillSwitch:       m.KillSwitch,
		GlobalKillSwitch: p.GlobalKillSwitch,
	}
}

// resolveConfidenceFloor returns the effective floor: the platform floor unless the merchant
// override RAISES it. A merchant can never lower the platform safety floor (PLAN.md §6).
func resolveConfidenceFloor(override *float64, platformFloor float64) float64 {
	if override != nil && *override > platformFloor {
		return *override
	}
	return platformFloor
}

// clampMaxInt clamps a merchant value to <= ceiling. A ceiling <= 0 means "no platform ceiling"
// (leave the merchant value untouched). Used for max_retries, where fewer is safer.
func clampMaxInt(merchant, ceiling int) int {
	if ceiling <= 0 || merchant <= ceiling {
		return merchant
	}
	return ceiling
}

// atLeastInt raises a merchant value to >= floor. Used for cooldown, where longer is safer.
func atLeastInt(merchant, floor int) int {
	if merchant < floor {
		return floor
	}
	return merchant
}

// clampCapInt resolves a per-count cap where the merchant "0" means unbounded: with a platform
// maximum set, "0" (or an over-cap value) becomes the platform maximum; with no platform
// maximum (<= 0) the merchant value stands (0 = disabled, as the engine reads it).
func clampCapInt(merchant, platformMax int) int {
	if platformMax <= 0 {
		return merchant
	}
	if merchant <= 0 || merchant > platformMax {
		return platformMax
	}
	return merchant
}

// clampCapInt64 is clampCapInt for BIGINT amounts (amount_ceiling, paise).
func clampCapInt64(merchant, platformMax int64) int64 {
	if platformMax <= 0 {
		return merchant
	}
	if merchant <= 0 || merchant > platformMax {
		return platformMax
	}
	return merchant
}
