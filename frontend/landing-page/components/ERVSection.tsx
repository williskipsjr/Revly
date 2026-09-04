"use client";

import React, { useState } from "react";

export default function ERVSection() {
  const [activeCase, setActiveCase] = useState<"act" | "stop">("act");

  const caseData = {
    act: {
      title: "Case A · High-Value / Transient Blip",
      amount: 8499,
      pSuccess: 0.89,
      cost: 1.5,
      friction: 5.0,
      decision: "ACT (DISPATCH RETRY)",
      decisionColor: "text-revly-emerald bg-revly-emerald/10 border-revly-emerald/30",
      description: "High recoverable amount with transient failure code. Gross expected value easily overcomes negligible gateway fee and low friction cost.",
    },
    stop: {
      title: "Case B · Low-Value / Chronic Decline",
      amount: 199,
      pSuccess: 0.15,
      cost: 1.2,
      friction: 35.0,
      decision: "STOP (PRESERVE GOODWILL)",
      decisionColor: "text-revly-rose bg-revly-rose/10 border-revly-rose/30",
      description: "Repeated previous failures with high customer fatigue. Intervention friction destroys net value, resulting in negative ERV. System halts.",
    },
  };

  const current = caseData[activeCase];
  const grossExpected = current.pSuccess * current.amount;
  const netERV = grossExpected - current.cost - current.friction;

  return (
    <section
      id="erv"
      className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 max-w-[1440px] mx-auto border-t border-border"
    >
      <div className="flex items-center gap-2 mb-6">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-revly-cyan">
          06 · ECONOMIC OPTIMIZATION
        </span>
      </div>

      <div className="max-w-[1000px] mb-16">
        <h2 className="t-h2 text-white mb-6">
          Recovery is an economic decision,
          <br />
          <span className="text-white/60">not an automation contest.</span>
        </h2>
        <p className="t-body max-w-[760px] text-base sm:text-lg">
          Every recovery attempt has a balance sheet: the recoverable amount weighted by
          probability, minus direct gateway fees, minus customer trust erosion. Revly
          ranks actions by Expected Recovery Value (ERV) — and refuses to intervene when
          economics turn negative.
        </p>
      </div>

      {/* The ERV Mathematical Formula Box */}
      <div className="mb-12 p-6 sm:p-8 rounded-lg bg-surface border border-white/10 font-mono">
        <div className="text-[11px] uppercase tracking-widest text-white/40 mb-4">
          THE GOVERNING ERV EQUATION
        </div>

        <div className="text-lg sm:text-2xl text-white font-semibold flex flex-wrap items-center gap-x-3 gap-y-2 leading-relaxed">
          <span className="text-revly-cyan">ERV(a | context)</span>
          <span className="text-white/40">=</span>
          <span className="text-white">
            P(success | a) <span className="text-white/40">×</span> Amount
          </span>
          <span className="text-white/40">−</span>
          <span className="text-white/70">Cost(a)</span>
          <span className="text-white/40">−</span>
          <span className="text-revly-rose/90">Friction(a)</span>
        </div>

        <div className="mt-4 pt-4 border-t border-white/[0.06] grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-white/50">
          <div>
            <strong className="text-white/80 block mb-0.5">Learned Probability:</strong>
            Statistical model trained on held-out outcome population.
          </div>
          <div>
            <strong className="text-white/80 block mb-0.5">Direct Action Cost:</strong>
            SMS gateway, WhatsApp fee, or card processing cost.
          </div>
          <div>
            <strong className="text-white/80 block mb-0.5">Customer Friction:</strong>
            Penalizes aggressive repeated contacts and brand annoyance.
          </div>
        </div>
      </div>

      {/* Interactive Economic Case Comparison */}
      <div className="rounded-lg bg-surface border border-border p-6 sm:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-8 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-white/40 uppercase tracking-widest">
              SIMULATED ECONOMIC SCENARIO:
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveCase("act")}
                className={`px-3.5 py-1.5 rounded font-mono text-xs transition-colors border ${
                  activeCase === "act"
                    ? "bg-revly-blue text-white border-revly-cyan"
                    : "bg-surface-raised text-white/50 border-white/10 hover:text-white"
                }`}
              >
                CASE A: ACT
              </button>
              <button
                onClick={() => setActiveCase("stop")}
                className={`px-3.5 py-1.5 rounded font-mono text-xs transition-colors border ${
                  activeCase === "stop"
                    ? "bg-revly-rose/30 text-white border-revly-rose"
                    : "bg-surface-raised text-white/50 border-white/10 hover:text-white"
                }`}
              >
                CASE B: STOP
              </button>
            </div>
          </div>

          <span
            className={`font-mono text-xs uppercase px-3 py-1 rounded border font-semibold ${current.decisionColor}`}
          >
            DECISION: {current.decision}
          </span>
        </div>

        {/* Live Calculation Visualizer */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 font-mono text-center mb-8">
          <div className="p-4 rounded bg-surface-raised border border-white/[0.06]">
            <span className="text-[11px] text-white/40 uppercase block">RECOVERABLE AMOUNT</span>
            <span className="text-2xl font-bold text-white mt-1 block">
              ₹{current.amount.toLocaleString()}
            </span>
            <span className="text-[10px] text-white/40 mt-1 block">At stake</span>
          </div>

          <div className="p-4 rounded bg-surface-raised border border-white/[0.06]">
            <span className="text-[11px] text-white/40 uppercase block">GROSS EXPECTED VALUE</span>
            <span className="text-2xl font-bold text-revly-cyan mt-1 block">
              ₹{grossExpected.toFixed(2)}
            </span>
            <span className="text-[10px] text-white/40 mt-1 block">
              P(success) = {(current.pSuccess * 100).toFixed(0)}%
            </span>
          </div>

          <div className="p-4 rounded bg-surface-raised border border-white/[0.06]">
            <span className="text-[11px] text-white/40 uppercase block">TOTAL PENALTY (COST+FRICTION)</span>
            <span className="text-2xl font-bold text-revly-rose mt-1 block">
              −₹{(current.cost + current.friction).toFixed(2)}
            </span>
            <span className="text-[10px] text-white/40 mt-1 block">
              ₹{current.cost} fee + ₹{current.friction} friction
            </span>
          </div>

          <div className="p-4 rounded bg-surface-raised border border-revly-blue/40 shadow-[0_0_20px_rgba(37,99,255,0.1)]">
            <span className="text-[11px] text-white/40 uppercase block">NET ERV SCORE</span>
            <span
              className={`text-2xl font-bold mt-1 block ${
                netERV > 0 ? "text-revly-emerald" : "text-revly-rose"
              }`}
            >
              {netERV > 0 ? `+₹${netERV.toFixed(2)}` : `−₹${Math.abs(netERV).toFixed(2)}`}
            </span>
            <span className="text-[10px] text-white/40 mt-1 block">
              {netERV > 0 ? "SURVIVES THRESHOLD" : "TERMINATES LOOP"}
            </span>
          </div>
        </div>

        <p className="text-sm text-white/60 font-sans text-center max-w-[800px] mx-auto">
          {current.description}
        </p>
      </div>
    </section>
  );
}

