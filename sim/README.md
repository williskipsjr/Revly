# sim

Python: the evaluation/simulation harness. **Populated in Phase 9.**

Replays a **separately generated, held-out** synthetic dataset (never used in Phase-3 training
or model selection) through four systems and reports the headline numbers:

1. no-action baseline
2. always-retry baseline
3. simple rule-based baseline (the Phase-2 heuristic, no ERV)
4. the full ERV-based recovery decision system

Metrics: recovery rate, total recovered revenue, intervention cost, **net recovered revenue**,
and unnecessary-intervention rate. Every result carries the disclaimer:

> These results demonstrate performance in a simulated environment and do not represent real
> Razorpay customer behaviour.
