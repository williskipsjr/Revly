#!/usr/bin/env python3
"""Phase 9 — render the simulation results as a Markdown report (sim/results/report.md).

Run sim/run_simulation.py first (it writes sim/results/summary.json), then:
    python3 sim/report.py
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
RESULTS = os.path.join(HERE, "results")


def main() -> None:
    with open(os.path.join(RESULTS, "summary.json")) as f:
        data = json.load(f)

    lines = [
        "# Recovery Simulation — Held-out Results",
        "",
        f"> **{data['disclaimer']}**",
        "",
        f"Held-out population: **{data['holdout_size']:,} failed payments** "
        "(generated with a different RNG seed than the training set — never used in model "
        "training or selection).",
        "",
        "| System | Recovery rate | Recovered revenue (₹) | Intervention cost (₹) | Net recovered (₹) | Unnecessary interventions |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for s in data["systems"]:
        lines.append(
            f"| `{s['system']}` | {s['recovery_rate']*100:.1f}% | "
            f"{s['recovered_revenue_paise']/100:,.0f} | {s['intervention_cost_paise']/100:,.0f} | "
            f"{s['net_recovered_paise']/100:,.0f} | {s['unnecessary_interventions']} |"
        )
    lines += [
        "",
        "**Reading the table:** the `erv_based` system should win on *net recovered revenue* — it "
        "recovers revenue while avoiding economically pointless interventions (unlike "
        "`always_retry`) and respecting safety constraints (fraud → escalate, confidence floor, "
        "retry limits). `no_action` is the do-nothing floor.",
        "",
    ]
    out = os.path.join(RESULTS, "report.md")
    with open(out, "w") as f:
        f.write("\n".join(lines))
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
