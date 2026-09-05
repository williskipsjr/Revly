# Simulation / Evaluation Harness (Phase 9)

Comparative recovery evidence on a **held-out** synthetic population, honestly labeled as
simulation (PLAN.md §9/§12). Stdlib-only Python — no dependencies.

```bash
python3 sim/run_simulation.py   # generates datasets if missing, runs 4 systems, writes results/
python3 sim/report.py           # renders results/report.md from results/summary.json
```

Outputs (git-ignored, regenerated on each run):
- `datasets/train_failed_payments.csv`, `datasets/holdout_failed_payments.csv` — the two
  independently-seeded synthetic populations (the model is only ever scored on the held-out one).
- `results/summary.csv`, `results/summary.json`, `results/report.md`.

Systems compared: `no_action`, `always_retry`, `rule_based` (Phase-2 heuristic, no ERV), and
`erv_based` (our ERV ranking + deterministic policy). Metrics: recovery rate, recovered revenue,
intervention cost, net recovered revenue, unnecessary interventions.

> **These results demonstrate performance in a SIMULATED environment and do NOT represent real
> Razorpay customer behavior.** No claim of production-grade model performance is made.
