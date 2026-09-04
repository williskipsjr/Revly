"use client";

import React, { useState } from "react";

export default function DiagnosisCard() {
  const [selectedCase, setSelectedCase] = useState(0);

  const cases = [
    {
      id: "RV-28491",
      amount: "₹8,499.00",
      channel: "UPI AutoPay / HDFC",
      failureCode: "504_GATEWAY_TIMEOUT",
      diagnosis: "Temporary Bank Decline",
      rationale: "Sudden gateway blip following a cluster of successful merchant settlements. Customer has 99.2% lifetime completion.",
      signals: [
        { label: "Historical Success", val: "99.2%", badge: "HIGH TRUST" },
        { label: "Prior Attempts (24h)", val: "0 / 2", badge: "SAFE" },
        { label: "Friction Sensitivity", val: "LOW", badge: "RECEPTIVE" },
        { label: "Network Issuer", val: "HDFC_NET", badge: "TRANSIENT" },
      ],
      recommendedAction: "Smart Delayed Retry (+14m)",
      ervScore: "+₹7,557.11",
    },
    {
      id: "RV-31048",
      amount: "₹1,250.00",
      channel: "Cards / Visa Debit",
      failureCode: "51_INSUFFICIENT_FUNDS",
      diagnosis: "End-of-Month Liquidity Gap",
      rationale: "Repeated soft decline matching customer 28th-of-month pay cycle. Blind retries will fail and incur bank chargebacks.",
      signals: [
        { label: "Historical Success", val: "84.5%", badge: "MODERATE" },
        { label: "Prior Attempts (24h)", val: "1 / 2", badge: "CAUTION" },
        { label: "Friction Sensitivity", val: "HIGH", badge: "DANGER" },
        { label: "Salary Anchor Window", val: "1st of Month", badge: "SCHEDULE" },
      ],
      recommendedAction: "One-Click WhatsApp Payment Link",
      ervScore: "+₹925.40",
    },
    {
      id: "RV-49912",
      amount: "₹14,800.00",
      channel: "e-NACH Mandate",
      failureCode: "MANDATE_EXPIRED",
      diagnosis: "Expired Recurring Mandate",
      rationale: "Underlying bank mandate reached validity ceiling. Mathematical probability of retry success is strictly zero.",
      signals: [
        { label: "Historical Success", val: "100%", badge: "ENTERPRISE" },
        { label: "Prior Attempts (24h)", val: "0 / 2", badge: "CLEAN" },
        { label: "Retry Feasibility", val: "0.0%", badge: "BLOCKED" },
        { label: "Customer Relationship", val: "VIP Tier", badge: "WHITE-GLOVE" },
      ],
      recommendedAction: "Automated Mandate Update Request",
      ervScore: "+₹14,755.00",
    },
  ];

  const active = cases[selectedCase];

  return (
    <section
      id="diagnosis"
      className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 max-w-[1440px] mx-auto border-t border-border"
    >
      <div className="flex items-center gap-2 mb-6">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-revly-cyan">
          04 · DIAGNOSTIC INTELLIGENCE
        </span>
      </div>

      <div className="max-w-[900px] mb-16">
        <h2 className="t-h2 text-white mb-6">
          Revly doesn’t treat every failure the same.
        </h2>
        <p className="t-body max-w-[760px] text-base sm:text-lg">
          A transient 504 gateway timeout requires a different intervention than an
          insufficient funds notice or an expired recurring mandate. Revly enriches
          every transaction with deep behavioral context before deciding.
        </p>
      </div>

      {/* Case Selector Tabs */}
      <div className="flex flex-wrap gap-2 mb-8">
        {cases.map((c, idx) => (
          <button
            key={c.id}
            onClick={() => setSelectedCase(idx)}
            className={`px-4 py-2.5 rounded font-mono text-xs transition-all border ${
              selectedCase === idx
                ? "bg-surface-raised border-revly-blue text-white shadow-[0_0_15px_rgba(37,99,255,0.15)]"
                : "bg-surface border-white/[0.06] text-white/50 hover:text-white hover:border-white/20"
            }`}
          >
            CASE {idx + 1}: #{c.id} ({c.amount})
          </button>
        ))}
      </div>

      {/* Main Diagnostic Dossier */}
      <div className="rounded-lg bg-surface border border-border p-6 sm:p-10 relative overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Transaction Metadata */}
          <div className="lg:col-span-4 flex flex-col gap-6 lg:border-r lg:border-white/[0.08] lg:pr-8">
            <div className="pb-4 border-b border-white/[0.08]">
              <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
                INCIDENT TRANSACTION
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-3xl font-mono font-bold text-white">
                  {active.amount}
                </span>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-revly-rose/10 text-revly-rose border border-revly-rose/20">
                  FAILED
                </span>
              </div>
              <div className="font-mono text-xs text-white/50 mt-1">
                ID: {active.id} · {active.channel}
              </div>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-white/40">ERROR CODE:</span>
                <span className="text-white/80">{active.failureCode}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/40">DIAGNOSIS:</span>
                <span className="text-revly-cyan font-medium">{active.diagnosis}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/40">BEST ACTION:</span>
                <span className="text-revly-emerald font-medium truncate max-w-[170px]">
                  {active.recommendedAction}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Signal Matrix & Rationale */}
          <div className="lg:col-span-8 flex flex-col justify-between">
            <div className="mb-6">
              <div className="font-mono text-xs text-white/40 uppercase tracking-widest mb-2">
                CONTEXTUAL RATIONALE (ADVISORY SCHEMA)
              </div>
              <p className="text-white/80 text-sm leading-relaxed">
                {active.rationale}
              </p>
            </div>

            {/* Signals Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {active.signals.map((sig) => (
                <div
                  key={sig.label}
                  className="p-3 rounded bg-surface-raised border border-white/[0.06] flex flex-col justify-between"
                >
                  <span className="font-mono text-[10px] text-white/40 uppercase">
                    {sig.label}
                  </span>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="font-mono text-sm font-semibold text-white">
                      {sig.val}
                    </span>
                    <span className="font-mono text-[9px] text-revly-cyan bg-revly-cyan/10 px-1 py-0.5 rounded">
                      {sig.badge}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Invariant Footer */}
            <div className="p-3.5 rounded bg-black/40 border border-white/[0.04] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-2 text-white/60">
                <span className="w-1.5 h-1.5 rounded-full bg-revly-cyan" />
                <span>DECISION ENGINE RANKING:</span>
                <span className="text-revly-emerald font-semibold">{active.recommendedAction}</span>
              </div>
              <span className="text-revly-cyan font-bold">
                EXPECTED VALUE: {active.ervScore}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

