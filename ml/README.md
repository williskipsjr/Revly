# ml

Python: synthetic data generation, feature engineering, and training of the interpretable
`P(success | context, action)` model (logistic regression). **Implemented in Phase 3.**

The model is a plain logistic regression trained with **numpy only** — no scikit-learn, no deep
learning. It is an interpretable statistical MVP, not ML sophistication (PLAN.md §7). It replaces
the Phase-2 hand-set heuristic so the ERV layer ranks actions from learned coefficients.

## Files

- `features.py` — the single source of truth for featurization (mirrored by the Go engine).
- `generate_synthetic.py` — the documented synthetic generative process (simulated data only).
- `logreg.py` — numpy logistic regression + metrics (AUC, log-loss, Brier).
- `train_success_model.py` — generate → split (train/val/holdout, no leakage) → fit → evaluate →
  export the JSON artifact.
- `README_data_assumptions.md` — honest documentation of the synthetic data and its assumptions.
- `artifacts/success_model.json` — the exported model (coefficients + feature spec + metrics +
  golden test vectors). The Go decision engine loads this for in-process inference.
- `artifacts/metrics.json` — the evaluation report (held-out metrics, selection grid, calibration).
- `tests/test_success_model.py` — artifact integrity, monotonicity/sanity, calibration, no-leakage.

## Run

```bash
pip install -r requirements.txt             # numpy only
python -m ml.train_success_model            # (re)train and export the artifact
python -m unittest ml.tests.test_success_model
```

## Serving / inference

The trained model is a linear model, so it is **exported as JSON coefficients** and evaluated
**in-process by the Go decision engine** (`decision-engine/internal/successmodel`) — no ONNX and
no extra service. Cross-language agreement is guaranteed by the `test_vectors` in the artifact,
which the Go tests reproduce. If the artifact is unavailable, the engine falls back to the Phase-2
heuristic estimator and logs it (the pipeline never stalls).

The training set here is kept strictly separate from the held-out evaluation set used by the
simulation harness in `../sim/` (Phase 9).
