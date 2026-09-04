"use client";

import React from "react";

export default function ImpactMetrics() {
  const baselines = [
    {
      name: "Baseline 1: No Action",
      recovered: "₹0.00",
      rate: "0.0%",
      cost: "₹0.00",
      churn: "HIGH",
      status: "PASSIVE",
    },
    {
      name: "Baseline 2: Always Retry (3x)",
      recovered: "₹28.4 L",
      rate: "31.2%",
      cost: "₹6.2 L",
      churn: "HIGH (UNCHECKED RETRIES)",
      status: "NAIVE",
    },
    {
      name: "Baseline 3: Static Rule Table",
      recovered: "₹39.8 L",
      rate: "44.1%",
      cost: "₹3.8 L",
      churn: "MODERATE",
      status: "HEURISTIC",
    },
    {
      name: "Revly Decision Platform",
      recovered: "₹58.2 L",
      rate: "64.8%",
      cost: "₹1.4 L",
      churn: "LOW (73% ACTIONS AVOIDED)",
      status: "OPTIMAL",
      highlight: true,
    },
  ];

  return (
    <section
      id="impact"
      className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 max-w-[1440px] mx-auto border-t border-border"
    >
      <div className="flex items-center gap-2 mb-6">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-revly-cyan">
          10 · SIMULATED EVALUATION RESULTS
        </span>
        <span className="font-mono text-[10px] text-white/40 bg-white/[0.05] px-2 py-0.5 rounded border border-white/10">
          HELD-OUT POPULATION: 10,000 EVENTS
        </span>
      </div>

      <div className="max-w-[1000px] mb-16">
        <h2 className="t-h2 text-white mb-6">
          The objective is not activity.
          <br />
          <span className="text-white/60">The objective is recovered value.</span>
        </h2>
        <p className="t-body max-w-[760px] text-base sm:text-lg">
          To measure whether Revly outperforms traditional systems, we evaluated the
          decision pipeline against naive retry automation across 10,000 simulated
          payment failure events. The numbers below represent synthetic evaluation results.
        </p>
      </div>

      {/* Top Level Metric KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <div className="p-6 rounded-lg bg-surface border border-border">
          <div className="font-mono text-[11px] text-white/40 uppercase tracking-widest mb-1">
            REVENUE AT RISK
          </div>
          <div className="text-3xl font-mono font-bold text-white mb-2">
            ₹1.82 Cr
          </div>
          <p className="text-xs text-white/50">
            Total failed volume evaluated across 10k test population events.
          </p>
        </div>

        <div className="p-6 rounded-lg bg-surface border border-border">
          <div className="font-mono text-[11px] text-revly-cyan uppercase tracking-widest mb-1">
            RECOVERED REVENUE
          </div>
          <div className="text-3xl font-mono font-bold text-revly-cyan mb-2">
            ₹58.2 L
          </div>
          <p className="text-xs text-white/50">
            Successfully recovered into merchant accounts via optimal paths.
          </p>
        </div>

        <div className="p-6 rounded-lg bg-surface border border-border">
          <div className="font-mono text-[11px] text-revly-emerald uppercase tracking-widest mb-1">
            NET RECOVERY RATE
          </div>
          <div className="text-3xl font-mono font-bold text-revly-emerald mb-2">
            64.8%
          </div>
          <p className="text-xs text-white/50">
            Recovered / Recoverable payments (vs. 31.2% for naive retries).
          </p>
        </div>

        <div className="p-6 rounded-lg bg-surface border border-border">
          <div className="font-mono text-[11px] text-revly-lavender uppercase tracking-widest mb-1">
            FRICTION REDUCTION
          </div>
          <div className="text-3xl font-mono font-bold text-white mb-2">
            −73%
          </div>
          <p className="text-xs text-white/50">
            Unnecessary interventions suppressed by the ERV & Policy engine.
          </p>
        </div>
      </div>

      {/* Comparative Benchmark Table */}
      <div className="rounded-lg bg-surface border border-border overflow-hidden mb-8">
        <div className="p-4 sm:p-6 border-b border-white/[0.08] flex items-center justify-between font-mono text-xs text-white/50">
          <span>BENCHMARK COMPARISON · HELD-OUT TEST SUITE</span>
          <span className="hidden sm:inline">SYNTHETIC EVALUATION POPULATION</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] text-white/40 uppercase">
                <th className="py-3 px-6">STRATEGY</th>
                <th className="py-3 px-6">RECOVERED REVENUE</th>
                <th className="py-3 px-6">RECOVERY RATE</th>
                <th className="py-3 px-6">ACTION COST</th>
                <th className="py-3 px-6">FRICTION & CHURN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {baselines.map((b) => (
                <tr
                  key={b.name}
                  className={`transition-colors ${
                    b.highlight
                      ? "bg-revly-blue/[0.08] text-white font-semibold"
                      : "text-white/70 hover:bg-white/[0.02]"
                  }`}
                >
                  <td className="py-4 px-6 flex items-center gap-3">
                    {b.highlight && (
                      <span className="w-2 h-2 rounded-full bg-revly-cyan animate-pulse" />
                    )}
                    <span>{b.name}</span>
                  </td>
                  <td className="py-4 px-6 text-white font-bold">{b.recovered}</td>
                  <td className="py-4 px-6">{b.rate}</td>
                  <td className="py-4 px-6">{b.cost}</td>
                  <td className="py-4 px-6 text-[11px] text-white/60">{b.churn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mandatory Disclaimer */}
      <div className="text-center font-mono text-[11px] text-white/40 max-w-[800px] mx-auto">
        NOTICE: The evaluation demonstrates performance in a simulated test environment
        and does not represent production metrics from real Razorpay merchants.
      </div>
    </section>
  );
}

