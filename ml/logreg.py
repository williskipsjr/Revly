"""A tiny, dependency-light logistic regression (numpy only) — no scikit-learn.

This is a genuine interpretable statistical model (sigmoid link, log-loss objective, L2
regularization, batch gradient descent), deliberately kept to a few dozen lines so the whole
P(success) estimator is auditable end to end. It is NOT a deep model and makes no claim to ML
sophistication (PLAN.md §7): the selling point is the decision architecture, not the model.
"""
from __future__ import annotations

import numpy as np


def sigmoid(z: np.ndarray) -> np.ndarray:
    # Clip to avoid overflow warnings on large |z|; sigmoid saturates well before this.
    z = np.clip(z, -35.0, 35.0)
    return 1.0 / (1.0 + np.exp(-z))


def log_loss(y: np.ndarray, p: np.ndarray) -> float:
    eps = 1e-12
    p = np.clip(p, eps, 1.0 - eps)
    return float(-np.mean(y * np.log(p) + (1.0 - y) * np.log(1.0 - p)))


def brier(y: np.ndarray, p: np.ndarray) -> float:
    return float(np.mean((p - y) ** 2))


def auc(y: np.ndarray, p: np.ndarray) -> float:
    """ROC AUC via the Mann–Whitney U statistic (rank-based), no sklearn.

    Returns 0.5 for a degenerate single-class input.
    """
    pos = p[y == 1]
    neg = p[y == 0]
    n_pos, n_neg = len(pos), len(neg)
    if n_pos == 0 or n_neg == 0:
        return 0.5
    order = np.argsort(p, kind="mergesort")
    ranks = np.empty(len(p), dtype=float)
    ranks[order] = np.arange(1, len(p) + 1)
    # Average ranks for ties so AUC is exact under ties.
    _assign_tied_ranks(p, ranks)
    sum_ranks_pos = ranks[y == 1].sum()
    u = sum_ranks_pos - n_pos * (n_pos + 1) / 2.0
    return float(u / (n_pos * n_neg))


def _assign_tied_ranks(p: np.ndarray, ranks: np.ndarray) -> None:
    order = np.argsort(p, kind="mergesort")
    sp = p[order]
    i = 0
    n = len(sp)
    while i < n:
        j = i
        while j + 1 < n and sp[j + 1] == sp[i]:
            j += 1
        if j > i:
            avg = (ranks[order[i]] + ranks[order[j]]) / 2.0
            for k in range(i, j + 1):
                ranks[order[k]] = avg
        i = j + 1


class LogisticRegression:
    """Batch gradient-descent logistic regression with L2 regularization on the weights."""

    def __init__(self, l2: float = 1e-3, lr: float = 0.2, epochs: int = 4000) -> None:
        self.l2 = l2
        self.lr = lr
        self.epochs = epochs
        self.w: np.ndarray | None = None
        self.b: float = 0.0

    def fit(self, X: np.ndarray, y: np.ndarray) -> "LogisticRegression":
        n, d = X.shape
        w = np.zeros(d)
        b = 0.0
        for _ in range(self.epochs):
            p = sigmoid(X @ w + b)
            err = p - y
            grad_w = X.T @ err / n + self.l2 * w  # L2 not applied to bias
            grad_b = float(np.mean(err))
            w -= self.lr * grad_w
            b -= self.lr * grad_b
        self.w = w
        self.b = b
        return self

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        assert self.w is not None, "model is not fitted"
        return sigmoid(X @ self.w + self.b)
