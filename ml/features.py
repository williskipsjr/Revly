"""Feature specification for the P(success | context, action) model.

This module is the SINGLE SOURCE OF TRUTH for how a (context, action) pair becomes a feature
vector. The Go decision engine re-implements exactly this featurization
(decision-engine/internal/successmodel/model.go); the two are kept in agreement by the
`test_vectors` baked into the exported artifact, which the Go tests must reproduce.

Features (PLAN.md §5 lists prior-attempt count, time-since-failure, method, and amount tier as
inputs — never separate penalty terms). We use:
  * prior_attempts   — numeric, standardized
  * amount_tier      — numeric (floor(log10(amount_paise+1)), 0..8), standardized
  * method           — one-hot over the payment_method enum
  * action           — one-hot over the six *intervention* actions

We deliberately omit elapsed time-since-failure: the Phase-2 pipeline decides synchronously at
t≈0, so elapsed time carries no signal at decision time — the benefit of waiting is instead
captured by the `delayed_retry` action itself. This is documented in README_data_assumptions.md.

no_action is NOT modelled: it is defined to recover nothing (P=0), the clean ERV baseline every
intervention must beat, so the scorer returns 0 for it without consulting the model.
"""
from __future__ import annotations

import math

# Order matters: it defines the one-hot layout and must match the Go implementation.
METHODS = ["card", "upi", "netbanking", "wallet", "emi", "other"]
ACTIONS = ["retry", "delayed_retry", "alt_method", "payment_link", "notify", "escalate"]

NUMERIC = ["prior_attempts", "amount_tier"]

AMOUNT_TIER_MIN = 0
AMOUNT_TIER_MAX = 8


def amount_tier(amount_paise: int) -> int:
    """Bucket a paise amount into an ordinal tier floor(log10(amount+1)), clamped 0..8.

    Deterministic and trivially reproducible in Go (math.Log10). amount 0 -> 0.
    """
    if amount_paise < 0:
        amount_paise = 0
    tier = int(math.floor(math.log10(amount_paise + 1)))
    return max(AMOUNT_TIER_MIN, min(AMOUNT_TIER_MAX, tier))


def feature_names() -> list[str]:
    """The full ordered feature-name list (numeric first, then method, then action one-hots)."""
    return list(NUMERIC) + [f"method_{m}" for m in METHODS] + [f"action_{a}" for a in ACTIONS]


def raw_numeric(prior_attempts: int, amount_paise: int) -> list[float]:
    """The two numeric features BEFORE standardization."""
    return [float(prior_attempts), float(amount_tier(amount_paise))]


def onehot(method: str, action: str) -> dict[str, float]:
    """Method + action one-hot values keyed by feature name. Unknown method -> 'other'."""
    m = method if method in METHODS else "other"
    vals: dict[str, float] = {}
    for name in METHODS:
        vals[f"method_{name}"] = 1.0 if name == m else 0.0
    for name in ACTIONS:
        vals[f"action_{name}"] = 1.0 if name == action else 0.0
    return vals
