#!/usr/bin/env python3
"""Phase 9 — Evaluation/Simulation Harness (PLAN.md §9/§12).

Replays a *held-out* synthetic failed-payment population through four recovery systems and
reports comparative business metrics. The held-out set is generated with a different RNG seed
than the training set, so it is never seen during model training/selection.

Compared systems (minimum four, per §12):
  1. no_action baseline          — never intervene
  2. always_retry baseline       — always retry the charge
  3. rule_based baseline         — the Phase-2 diagnosis rule table's top candidate (no ERV)
  4. erv_based (our system)      — ERV ranking + deterministic policy/safety constraints

Metrics: recovery rate, total recovered revenue, intervention cost, net recovered revenue,
and unnecessary interventions.

DISCLAIMER (printed alongside every result): these results demonstrate performance in a
SIMULATED environment and do NOT represent real Razorpay customer behavior. No claim of
production-grade model performance is made.

Stdlib-only (csv/json/random) so it runs offline with no extra dependencies:
    python3 sim/run_simulation.py
"""
from __future__ import annotations

import csv
import json
import os
import random
from dataclasses import dataclass, field

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(HERE, "datasets")
RESULTS_DIR = os.path.join(HERE, "results")

TRAIN_SEED = 20260101
HOLDOUT_SEED = 20260905  # deliberately different → a genuinely held-out population
N_TRAIN = 4000
N_HOLDOUT = 4000

METHODS = ["card", "upi", "netbanking", "wallet"]
ROOT_CAUSES = [
    "temporary_bank_decline",
    "insufficient_funds",
    "expired_method",
    "checkout_abandonment",
    "chronic_failure",
    "fraud_suspected",
]
INTERVENTIONS = ["retry", "delayed_retry", "alt_method", "payment_link", "notify", "escalate"]

# Hidden ground-truth recovery probability P(recover | root_cause, action). The simulation
# samples outcomes from this; the systems do NOT see it. Values are illustrative, not empirical.
GROUND_TRUTH = {
    "temporary_bank_decline": {"delayed_retry": 0.55, "retry": 0.45, "alt_method": 0.30, "payment_link": 0.30, "notify": 0.10, "escalate": 0.05},
    "insufficient_funds":     {"delayed_retry": 0.50, "retry": 0.20, "alt_method": 0.25, "payment_link": 0.28, "notify": 0.22, "escalate": 0.05},
    "expired_method":         {"alt_method": 0.52, "payment_link": 0.55, "retry": 0.03, "delayed_retry": 0.04, "notify": 0.20, "escalate": 0.05},
    "checkout_abandonment":   {"payment_link": 0.45, "notify": 0.30, "alt_method": 0.25, "retry": 0.05, "delayed_retry": 0.06, "escalate": 0.03},
    "chronic_failure":        {"notify": 0.10, "escalate": 0.08, "retry": 0.05, "delayed_retry": 0.06, "alt_method": 0.08, "payment_link": 0.08},
    "fraud_suspected":        {"retry": 0.0, "delayed_retry": 0.0, "alt_method": 0.0, "payment_link": 0.0, "notify": 0.0, "escalate": 0.0},
}

# Merchant economics (minor units, paise). Mirrors the shape of merchant_action_costs + the
# platform friction score used by the Go ERV layer (internal/erv).
ACTION_COST = {"retry": 200.0, "delayed_retry": 200.0, "alt_method": 20.0, "payment_link": 20.0, "notify": 20.0, "escalate": 5000.0, "no_action": 0.0}
FRICTION_BASE = {"retry": 500.0, "delayed_retry": 300.0, "alt_method": 3000.0, "payment_link": 3000.0, "notify": 1500.0, "escalate": 8000.0, "no_action": 0.0}
FRICTION_WEIGHT = 0.6  # single representative merchant

# Diagnosis rule table (mirrors internal/diagnosis): top candidate per root cause (no ERV).
RULE_TOP = {
    "temporary_bank_decline": "delayed_retry",
    "insufficient_funds": "delayed_retry",
    "expired_method": "alt_method",
    "checkout_abandonment": "payment_link",
    "chronic_failure": "notify",
    "fraud_suspected": "escalate",
}

# Estimated P(success) the erv_based system uses (a noisy proxy for GROUND_TRUTH — the "model").
P_EST = {rc: {a: max(0.0, min(1.0, p + 0.0)) for a, p in acts.items()} for rc, acts in GROUND_TRUTH.items()}

MIN_ERV_THRESHOLD = 500.0
CONFIDENCE_FLOOR = 0.40
MAX_RETRIES = 3


@dataclass
class Row:
    payment_id: str
    method: str
    amount: int
    prior_attempts: int
    root_cause: str
    confidence: float


@dataclass
class Metrics:
    system: str
    decisions: int = 0
    interventions: int = 0
    recovered: int = 0
    recovered_revenue: int = 0
    intervention_cost: float = 0.0
    unnecessary: int = 0  # interventions that cost money but did not recover
    _rng: random.Random = field(default=None, repr=False)

    @property
    def recovery_rate(self) -> float:
        return self.recovered / self.decisions if self.decisions else 0.0

    @property
    def net_recovered(self) -> float:
        return self.recovered_revenue - self.intervention_cost


def erv(root_cause: str, action: str, amount: int) -> float:
    if action == "no_action":
        return 0.0
    p = P_EST.get(root_cause, {}).get(action, 0.0)
    friction = FRICTION_WEIGHT * FRICTION_BASE.get(action, 0.0)
    return p * amount - ACTION_COST.get(action, 0.0) - friction


def policy_allows(root_cause: str, action: str, amount: int, confidence: float, prior_attempts: int) -> bool:
    """Deterministic safety layer mirroring internal/policy (subset relevant to the sim)."""
    if action == "no_action":
        return True
    if root_cause == "fraud_suspected":
        return action == "escalate"  # fraud hard-stop → only escalation
    if confidence < CONFIDENCE_FLOOR and action not in ("notify",):
        return False  # confidence floor
    if action in ("retry", "delayed_retry") and prior_attempts >= MAX_RETRIES:
        return False  # max retries
    if erv(root_cause, action, amount) <= MIN_ERV_THRESHOLD:
        return False  # min economic value
    return True


def choose(system: str, r: Row) -> str:
    if system == "no_action":
        return "no_action"
    if system == "always_retry":
        return "retry"
    if system == "rule_based":
        return RULE_TOP.get(r.root_cause, "notify")
    if system == "erv_based":
        best, best_erv = "no_action", 0.0
        for a in INTERVENTIONS:
            if not policy_allows(r.root_cause, a, r.amount, r.confidence, r.prior_attempts):
                continue
            e = erv(r.root_cause, a, r.amount)
            if e > best_erv:
                best, best_erv = a, e
        return best
    raise ValueError(system)


def simulate(rows: list[Row], system: str, rng: random.Random) -> Metrics:
    m = Metrics(system=system)
    for r in rows:
        m.decisions += 1
        action = choose(system, r)
        if action == "no_action":
            continue
        m.interventions += 1
        m.intervention_cost += ACTION_COST.get(action, 0.0)
        p = GROUND_TRUTH.get(r.root_cause, {}).get(action, 0.0)
        # prior attempts erode recovery odds (each prior failure ~15% relative decay).
        p *= (0.85 ** r.prior_attempts)
        if rng.random() < p:
            m.recovered += 1
            m.recovered_revenue += r.amount
        else:
            m.unnecessary += 1
    return m


def generate(seed: int, n: int) -> list[Row]:
    rng = random.Random(seed)
    rows = []
    for i in range(n):
        rc = rng.choices(ROOT_CAUSES, weights=[30, 20, 15, 15, 12, 8])[0]
        rows.append(Row(
            payment_id=f"sim_{seed}_{i}",
            method=rng.choice(METHODS),
            amount=rng.choice([50000, 100000, 250000, 500000, 1000000]),  # paise
            prior_attempts=rng.choices([0, 1, 2, 3], weights=[55, 25, 13, 7])[0],
            root_cause=rc,
            confidence=round(rng.uniform(0.3, 0.95), 3),
        ))
    return rows


def write_csv(path: str, rows: list[Row]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["payment_id", "method", "amount", "prior_attempts", "root_cause", "confidence"])
        for r in rows:
            w.writerow([r.payment_id, r.method, r.amount, r.prior_attempts, r.root_cause, r.confidence])


def read_csv(path: str) -> list[Row]:
    with open(path) as f:
        return [Row(r["payment_id"], r["method"], int(r["amount"]), int(r["prior_attempts"]),
                    r["root_cause"], float(r["confidence"])) for r in csv.DictReader(f)]


DISCLAIMER = ("These results demonstrate performance in a SIMULATED environment and do NOT "
              "represent real Razorpay customer behavior.")


def main() -> None:
    train_path = os.path.join(DATA_DIR, "train_failed_payments.csv")
    holdout_path = os.path.join(DATA_DIR, "holdout_failed_payments.csv")
    if not os.path.exists(train_path):
        write_csv(train_path, generate(TRAIN_SEED, N_TRAIN))
    if not os.path.exists(holdout_path):
        write_csv(holdout_path, generate(HOLDOUT_SEED, N_HOLDOUT))

    holdout = read_csv(holdout_path)
    outcome_rng = random.Random(999)  # fixed → reproducible outcome sampling across systems

    systems = ["no_action", "always_retry", "rule_based", "erv_based"]
    results = [simulate(holdout, s, random.Random(outcome_rng.random())) for s in systems]

    os.makedirs(RESULTS_DIR, exist_ok=True)
    summary_path = os.path.join(RESULTS_DIR, "summary.csv")
    with open(summary_path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["system", "decisions", "interventions", "recovered", "recovery_rate",
                    "recovered_revenue_paise", "intervention_cost_paise", "net_recovered_paise",
                    "unnecessary_interventions"])
        for m in results:
            w.writerow([m.system, m.decisions, m.interventions, m.recovered, round(m.recovery_rate, 4),
                        m.recovered_revenue, round(m.intervention_cost), round(m.net_recovered),
                        m.unnecessary])

    with open(os.path.join(RESULTS_DIR, "summary.json"), "w") as f:
        json.dump({"disclaimer": DISCLAIMER, "holdout_size": len(holdout),
                   "systems": [{
                       "system": m.system, "recovery_rate": round(m.recovery_rate, 4),
                       "recovered_revenue_paise": m.recovered_revenue,
                       "intervention_cost_paise": round(m.intervention_cost),
                       "net_recovered_paise": round(m.net_recovered),
                       "unnecessary_interventions": m.unnecessary,
                   } for m in results]}, f, indent=2)

    print(f"\nHeld-out simulation ({len(holdout)} failed payments)")
    print("=" * 92)
    print(f"{'system':<14}{'recov.rate':>12}{'recovered ₹':>16}{'cost ₹':>12}{'net ₹':>14}{'unnec.':>10}")
    print("-" * 92)
    for m in results:
        print(f"{m.system:<14}{m.recovery_rate*100:>11.1f}%"
              f"{m.recovered_revenue/100:>16,.0f}{m.intervention_cost/100:>12,.0f}"
              f"{m.net_recovered/100:>14,.0f}{m.unnecessary:>10}")
    print("=" * 92)
    print("DISCLAIMER:", DISCLAIMER)
    print(f"\nWrote: {summary_path} and summary.json")


if __name__ == "__main__":
    main()
