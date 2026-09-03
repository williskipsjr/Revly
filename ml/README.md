# ml

Python: synthetic/simulated data generation, feature engineering, and training of the
interpretable `P(success | context, action)` model (logistic regression). **Populated in
Phase 3.**

Key files (Phase 3):
- `train_success_model.py` — training + calibration on the synthetic training set.
- `README_data_assumptions.md` — explicit, honest documentation of the synthetic data
  generating process and its assumptions.

The training set here is kept strictly separate from the held-out evaluation set used by the
simulation harness in `../sim/` (Phase 9).
