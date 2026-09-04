"""Synthetic outcome-data generator for the P(success) model.

EVERYTHING HERE IS SIMULATED. There is no real Razorpay data anywhere in this repo. The
generative process below is a deliberately simple, documented model of "which recovery action
tends to recover which kind of failed payment", used only to give the logistic regression
something interpretable to learn. See README_data_assumptions.md for the full rationale.

The generative "ground truth" is intentionally DIFFERENT from the Phase-2 hand-set heuristic:
Phase 2 guessed the base rates; here the synthetic world says, for instance, that sending a
fresh payment link recovers more failed payments than offering an alternative method, and that
both beat a plain retry. The Phase-2 heuristic guessed the opposite ordering for
alt_method-vs-payment_link, so the trained model — for an expired-method event, where both are
candidate actions — can select a DIFFERENT action than the heuristic. Demonstrating that the
data-fit model actually changes decisions is the whole point of replacing the heuristic.
"""
from __future__ import annotations

import numpy as np

from ml.features import ACTIONS, METHODS, amount_tier

# Synthetic ground-truth base recovery rate per intervention action. NOT the Phase-2 heuristic
# values — see the module docstring.
TRUE_ACTION_BASE = {
    "retry": 0.40,
    "delayed_retry": 0.48,
    "alt_method": 0.50,   # heuristic guessed this ABOVE payment_link; the data says otherwise
    "payment_link": 0.63,  # a fresh link converts best of the re-presentment actions
    "notify": 0.18,
    "escalate": 0.58,
}

# Synthetic ground-truth method multiplier.
TRUE_METHOD_MULT = {
    "card": 0.97,
    "upi": 1.06,
    "netbanking": 0.93,
    "wallet": 1.00,
    "emi": 0.88,
    "other": 0.90,
}

# Each prior failed attempt multiplies the recovery probability by this factor.
TRUE_ATTEMPT_DECAY = 0.82

# Sampling distributions for the covariates.
METHOD_WEIGHTS = np.array([0.45, 0.30, 0.12, 0.08, 0.03, 0.02])  # aligns with METHODS order
PRIOR_ATTEMPT_CHOICES = np.array([0, 1, 2, 3, 4, 5])
PRIOR_ATTEMPT_WEIGHTS = np.array([0.40, 0.25, 0.15, 0.10, 0.06, 0.04])
AMOUNT_MIN_PAISE = 5_000       # ₹50
AMOUNT_MAX_PAISE = 5_000_000   # ₹50,000


def true_probability(action: str, method: str, prior_attempts: int, amount_paise: int) -> float:
    """The synthetic latent P(recover) used to draw labels. Documented, not learned."""
    base = TRUE_ACTION_BASE[action] * TRUE_METHOD_MULT[method]
    decayed = base * (TRUE_ATTEMPT_DECAY ** prior_attempts)
    # Larger amounts are modestly harder to recover (customer hesitation), centred at tier 3.
    amount_factor = 1.0 - 0.03 * (amount_tier(amount_paise) - 3)
    p = decayed * amount_factor
    return float(min(0.98, max(0.01, p)))


def generate(n: int, seed: int) -> dict[str, np.ndarray]:
    """Draw n synthetic (features, label) rows. Returns column arrays."""
    rng = np.random.default_rng(seed)

    method_idx = rng.choice(len(METHODS), size=n, p=METHOD_WEIGHTS)
    methods = np.array(METHODS)[method_idx]
    actions = np.array(ACTIONS)[rng.integers(0, len(ACTIONS), size=n)]
    prior_attempts = rng.choice(PRIOR_ATTEMPT_CHOICES, size=n, p=PRIOR_ATTEMPT_WEIGHTS)
    # Log-uniform amount so tiers are represented across the range.
    log_lo, log_hi = np.log10(AMOUNT_MIN_PAISE), np.log10(AMOUNT_MAX_PAISE)
    amounts = np.power(10.0, rng.uniform(log_lo, log_hi, size=n)).astype(np.int64)

    p_true = np.array([
        true_probability(a, m, int(pa), int(amt))
        for a, m, pa, amt in zip(actions, methods, prior_attempts, amounts)
    ])
    labels = (rng.random(n) < p_true).astype(np.float64)

    return {
        "method": methods,
        "action": actions,
        "prior_attempts": prior_attempts.astype(np.int64),
        "amount": amounts,
        "p_true": p_true,
        "label": labels,
    }
