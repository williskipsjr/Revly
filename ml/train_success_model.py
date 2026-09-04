"""Train the interpretable P(success | context, action) logistic-regression model.

Pipeline (run: `python -m ml.train_success_model`):
  1. Generate a synthetic labelled dataset (ml/generate_synthetic.py) — SIMULATED, not real
     Razorpay data.
  2. Split into train / validation / held-out test with NO leakage: standardization statistics
     and model weights are fit on TRAIN only; the L2 strength is selected on VALIDATION; the
     HELD-OUT set is touched exactly once, for the final report, and never influences fitting
     or selection.
  3. Fit a numpy logistic regression (ml/logreg.py).
  4. Evaluate (AUC, log-loss, Brier, calibration) and run monotonicity sanity checks.
  5. Export an interpretable JSON artifact (coefficients + feature spec + standardization +
     metrics + golden test vectors) to ml/artifacts/success_model.json, which the Go decision
     engine loads for in-process inference.

The held-out set here is the model's OWN internal test split. It is distinct from the Phase-9
simulation harness's separately generated evaluation population (sim/), which uses a different
seed and is never seen here.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone

import numpy as np

from ml import features as F
from ml import generate_synthetic as G
from ml.logreg import LogisticRegression, auc, brier, log_loss

SEED = 20260905
N_SAMPLES = 40_000
MODEL_VERSION = "logreg-synthetic-v1"
L2_GRID = [0.0, 1e-4, 1e-3, 1e-2, 1e-1]

ARTIFACT_PATH = os.path.join(os.path.dirname(__file__), "artifacts", "success_model.json")
METRICS_PATH = os.path.join(os.path.dirname(__file__), "artifacts", "metrics.json")


def build_matrix(data: dict[str, np.ndarray]) -> np.ndarray:
    """Assemble the raw (unstandardized) feature matrix in F.feature_names() order."""
    n = len(data["label"])
    names = F.feature_names()
    idx = {name: i for i, name in enumerate(names)}
    X = np.zeros((n, len(names)))
    for r in range(n):
        X[r, idx["prior_attempts"]] = float(data["prior_attempts"][r])
        X[r, idx["amount_tier"]] = float(F.amount_tier(int(data["amount"][r])))
        oh = F.onehot(str(data["method"][r]), str(data["action"][r]))
        for name, val in oh.items():
            X[r, idx[name]] = val
    return X


def standardize_fit(X: np.ndarray, numeric_cols: list[int]) -> tuple[np.ndarray, np.ndarray]:
    """Mean/std for the numeric columns only (one-hots are left as 0/1)."""
    mean = np.zeros(X.shape[1])
    std = np.ones(X.shape[1])
    for c in numeric_cols:
        mean[c] = X[:, c].mean()
        s = X[:, c].std()
        std[c] = s if s > 1e-9 else 1.0
    return mean, std


def standardize_apply(X: np.ndarray, mean: np.ndarray, std: np.ndarray) -> np.ndarray:
    return (X - mean) / std


def evaluate(model: LogisticRegression, X: np.ndarray, y: np.ndarray) -> dict[str, float]:
    p = model.predict_proba(X)
    return {
        "auc": round(auc(y, p), 4),
        "log_loss": round(log_loss(y, p), 4),
        "brier": round(brier(y, p), 4),
        "positive_rate": round(float(y.mean()), 4),
        "mean_pred": round(float(p.mean()), 4),
        "n": int(len(y)),
    }


def calibration_table(model: LogisticRegression, X: np.ndarray, y: np.ndarray, bins: int = 10) -> list[dict]:
    p = model.predict_proba(X)
    edges = np.linspace(0.0, 1.0, bins + 1)
    out = []
    for i in range(bins):
        lo, hi = edges[i], edges[i + 1]
        mask = (p >= lo) & (p < hi) if i < bins - 1 else (p >= lo) & (p <= hi)
        if mask.sum() == 0:
            continue
        out.append({
            "bin": f"[{lo:.1f},{hi:.1f})",
            "count": int(mask.sum()),
            "mean_pred": round(float(p[mask].mean()), 4),
            "empirical": round(float(y[mask].mean()), 4),
        })
    return out


def coefficients_dict(model: LogisticRegression) -> dict[str, float]:
    names = F.feature_names()
    assert model.w is not None
    return {name: float(model.w[i]) for i, name in enumerate(names)}


def score_one(coefs: dict[str, float], intercept: float, mean: np.ndarray, std: np.ndarray,
              method: str, action: str, prior_attempts: int, amount: int) -> float:
    """Reference scorer used to compute golden test vectors — mirrors the Go implementation."""
    from ml.logreg import sigmoid
    names = F.feature_names()
    idx = {name: i for i, name in enumerate(names)}
    z = intercept
    # numeric (standardized)
    z += coefs["prior_attempts"] * ((prior_attempts - mean[idx["prior_attempts"]]) / std[idx["prior_attempts"]])
    at = F.amount_tier(amount)
    z += coefs["amount_tier"] * ((at - mean[idx["amount_tier"]]) / std[idx["amount_tier"]])
    # categorical one-hots
    for name, val in F.onehot(method, action).items():
        if val:
            z += coefs[name]
    return float(sigmoid(np.array([z]))[0])


def golden_vectors(coefs, intercept, mean, std) -> list[dict]:
    cases = [
        ("card", "retry", 0, 250_000),
        ("card", "delayed_retry", 0, 250_000),
        ("card", "alt_method", 0, 250_000),
        ("upi", "payment_link", 1, 100_000),
        ("netbanking", "escalate", 3, 4_000_000),
        ("emi", "notify", 2, 30_000),
    ]
    out = []
    for method, action, pa, amt in cases:
        out.append({
            "method": method, "action": action, "prior_attempts": pa, "amount": amt,
            "p_success": round(score_one(coefs, intercept, mean, std, method, action, pa, amt), 8),
        })
    return out


def monotonicity_checks(coefs, intercept, mean, std) -> dict[str, bool]:
    """Sanity properties the model must satisfy (asserted; also surfaced in the report)."""
    def s(method, action, pa, amt):
        return score_one(coefs, intercept, mean, std, method, action, pa, amt)

    # P(success) is non-increasing in prior attempts.
    seq = [s("card", "retry", pa, 250_000) for pa in range(0, 6)]
    non_increasing = all(seq[i] >= seq[i + 1] - 1e-9 for i in range(len(seq) - 1))

    # Re-presentment beats a plain retry (card, no priors).
    payment_link_beats_retry = s("card", "payment_link", 0, 250_000) > s("card", "retry", 0, 250_000)

    # The learned ordering that diverges from the Phase-2 heuristic: for expired-method events,
    # a fresh payment link should score above an alternative method (the heuristic guessed the
    # reverse). This is what lets the model change the pipeline's chosen action.
    payment_link_beats_alt = s("card", "payment_link", 0, 250_000) > s("card", "alt_method", 0, 250_000)

    return {
        "p_non_increasing_in_prior_attempts": bool(non_increasing),
        "payment_link_beats_retry": bool(payment_link_beats_retry),
        "payment_link_beats_alt_method": bool(payment_link_beats_alt),
    }


def split_indices(n: int, seed: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    perm = rng.permutation(n)
    n_train = int(0.70 * n)
    n_val = int(0.15 * n)
    return perm[:n_train], perm[n_train:n_train + n_val], perm[n_train + n_val:]


def main() -> None:
    data = G.generate(N_SAMPLES, seed=SEED)
    X = build_matrix(data)
    y = data["label"]

    tr, va, te = split_indices(len(y), seed=SEED + 1)
    numeric_cols = [F.feature_names().index(name) for name in F.NUMERIC]

    # Standardization fit on TRAIN only.
    mean, std = standardize_fit(X[tr], numeric_cols)
    Xtr = standardize_apply(X[tr], mean, std)
    Xva = standardize_apply(X[va], mean, std)
    Xte = standardize_apply(X[te], mean, std)

    # Model selection: pick L2 by VALIDATION log-loss. The held-out set is untouched here.
    best = None
    selection = []
    for l2 in L2_GRID:
        model = LogisticRegression(l2=l2).fit(Xtr, y[tr])
        val_ll = log_loss(y[va], model.predict_proba(Xva))
        selection.append({"l2": l2, "val_log_loss": round(val_ll, 4)})
        if best is None or val_ll < best[0]:
            best = (val_ll, l2, model)
    assert best is not None
    _, best_l2, model = best

    coefs = coefficients_dict(model)
    intercept = float(model.b)

    metrics = {
        "train": evaluate(model, Xtr, y[tr]),
        "val": evaluate(model, Xva, y[va]),
        "holdout": evaluate(model, Xte, y[te]),
    }
    checks = monotonicity_checks(coefs, intercept, mean, std)
    for name, ok in checks.items():
        if not ok:
            raise SystemExit(f"monotonicity/sanity check failed: {name}")

    idx = {name: i for i, name in enumerate(F.feature_names())}
    artifact = {
        "model_type": "logistic_regression",
        "model_version": MODEL_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "training_data": "synthetic",
        "disclaimer": (
            "Trained on synthetic/simulated data with documented assumptions "
            "(see ml/README_data_assumptions.md). Does NOT represent real Razorpay customer "
            "behaviour. Interpretable logistic-regression MVP — not a production-grade model."
        ),
        "seed": SEED,
        "selected_l2": best_l2,
        "feature_spec": {
            "numeric": [
                {"name": name, "mean": float(mean[idx[name]]), "std": float(std[idx[name]])}
                for name in F.NUMERIC
            ],
            "methods": F.METHODS,
            "actions": F.ACTIONS,
            "amount_tier": {"kind": "floor_log10_paise", "min": F.AMOUNT_TIER_MIN, "max": F.AMOUNT_TIER_MAX},
        },
        "intercept": intercept,
        "coefficients": coefs,
        "metrics": metrics,
        "sanity_checks": checks,
        "test_vectors": golden_vectors(coefs, intercept, mean, std),
    }

    os.makedirs(os.path.dirname(ARTIFACT_PATH), exist_ok=True)
    with open(ARTIFACT_PATH, "w") as fh:
        json.dump(artifact, fh, indent=2, sort_keys=True)
        fh.write("\n")

    report = {
        "model_version": MODEL_VERSION,
        "selected_l2": best_l2,
        "selection_grid": selection,
        "metrics": metrics,
        "sanity_checks": checks,
        "calibration_holdout": calibration_table(model, Xte, y[te]),
        "disclaimer": artifact["disclaimer"],
    }
    with open(METRICS_PATH, "w") as fh:
        json.dump(report, fh, indent=2, sort_keys=True)
        fh.write("\n")

    print(f"wrote {ARTIFACT_PATH}")
    print(f"wrote {METRICS_PATH}")
    print("holdout metrics:", metrics["holdout"])
    print("sanity checks:", checks)


if __name__ == "__main__":
    main()
