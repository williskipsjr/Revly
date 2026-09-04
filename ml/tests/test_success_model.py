"""Tests for the P(success) model: artifact integrity, monotonicity/sanity, calibration, and
the no-leakage train/val/holdout split. Run with: `python -m unittest ml.tests.test_success_model`.

These exercise the committed artifact (fast) plus the pure split/generative logic; they do not
retrain, so they stay quick and deterministic.
"""
from __future__ import annotations

import json
import math
import os
import unittest

import numpy as np

from ml import features as F
from ml import generate_synthetic as G
from ml.train_success_model import split_indices

ARTIFACT = os.path.join(os.path.dirname(__file__), "..", "artifacts", "success_model.json")


def load_artifact() -> dict:
    with open(ARTIFACT) as fh:
        return json.load(fh)


def sigmoid(z: float) -> float:
    return 1.0 / (1.0 + math.exp(-max(-35.0, min(35.0, z))))


def score(artifact: dict, method: str, action: str, prior_attempts: int, amount: int) -> float:
    """Reference scorer over the artifact — the same math the Go engine implements."""
    c = artifact["coefficients"]
    z = artifact["intercept"]
    spec = {n["name"]: n for n in artifact["feature_spec"]["numeric"]}
    z += c["prior_attempts"] * ((prior_attempts - spec["prior_attempts"]["mean"]) / spec["prior_attempts"]["std"])
    at = F.amount_tier(amount)
    z += c["amount_tier"] * ((at - spec["amount_tier"]["mean"]) / spec["amount_tier"]["std"])
    for name, val in F.onehot(method, action).items():
        if val:
            z += c[name]
    return sigmoid(z)


class TestArtifactIntegrity(unittest.TestCase):
    def test_structure_and_provenance(self):
        a = load_artifact()
        self.assertEqual(a["model_type"], "logistic_regression")
        self.assertEqual(a["training_data"], "synthetic")
        self.assertIn("not represent real razorpay", a["disclaimer"].lower())
        self.assertTrue(a["coefficients"])
        # A coefficient must exist for every method and action one-hot + the two numerics.
        for name in F.feature_names():
            self.assertIn(name, a["coefficients"], f"missing coefficient {name}")

    def test_reproduces_golden_vectors(self):
        a = load_artifact()
        self.assertTrue(a["test_vectors"])
        for v in a["test_vectors"]:
            got = score(a, v["method"], v["action"], v["prior_attempts"], v["amount"])
            self.assertAlmostEqual(got, v["p_success"], places=6, msg=f"vector {v}")


class TestSanity(unittest.TestCase):
    def test_probabilities_in_range(self):
        a = load_artifact()
        for action in F.ACTIONS:
            for method in F.METHODS:
                for pa in range(0, 6):
                    p = score(a, method, action, pa, 250_000)
                    self.assertGreaterEqual(p, 0.0)
                    self.assertLessEqual(p, 1.0)

    def test_monotonic_non_increasing_in_prior_attempts(self):
        a = load_artifact()
        for action in F.ACTIONS:
            seq = [score(a, "card", action, pa, 250_000) for pa in range(0, 6)]
            for i in range(len(seq) - 1):
                self.assertGreaterEqual(seq[i] + 1e-9, seq[i + 1], f"{action} not monotone")

    def test_payment_link_beats_alt_method(self):
        # The learned divergence from the Phase-2 heuristic that drives a different decision.
        a = load_artifact()
        self.assertGreater(
            score(a, "card", "payment_link", 0, 250_000),
            score(a, "card", "alt_method", 0, 250_000),
        )

    def test_calibration_holdout(self):
        # Mean predicted probability should track the empirical positive rate on the held-out set.
        a = load_artifact()
        m = a["metrics"]["holdout"]
        self.assertLess(abs(m["mean_pred"] - m["positive_rate"]), 0.05)
        self.assertGreater(m["auc"], 0.6)  # meaningfully better than random on this synthetic set


class TestSplitNoLeakage(unittest.TestCase):
    def test_splits_are_disjoint_and_complete(self):
        n = 10_000
        tr, va, te = split_indices(n, seed=123)
        self.assertEqual(len(tr) + len(va) + len(te), n)
        s_tr, s_va, s_te = set(tr.tolist()), set(va.tolist()), set(te.tolist())
        self.assertEqual(len(s_tr & s_va), 0)
        self.assertEqual(len(s_tr & s_te), 0)
        self.assertEqual(len(s_va & s_te), 0)
        self.assertEqual(len(s_tr | s_va | s_te), n)

    def test_generative_truth_properties(self):
        # Ground-truth probability decreases with prior attempts and ranks payment_link first.
        p0 = G.true_probability("payment_link", "card", 0, 250_000)
        p2 = G.true_probability("payment_link", "card", 2, 250_000)
        self.assertGreater(p0, p2)
        self.assertGreater(
            G.true_probability("payment_link", "card", 0, 250_000),
            G.true_probability("alt_method", "card", 0, 250_000),
        )


if __name__ == "__main__":
    unittest.main()
