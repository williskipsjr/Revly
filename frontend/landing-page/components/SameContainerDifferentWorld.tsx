"use client";

import React from "react";

export default function SameContainerDifferentWorld() {
  return (
    <section className="flex flex-col items-center px-gutter pb-[100px] lg:pb-[180px]">
      <div className="relative w-full max-w-[1920px] overflow-hidden rounded-card bg-plot px-gutter py-[80px] lg:py-[120px] border border-white/[0.08]">
        <div className="relative mx-auto flex w-full max-w-[1445px] flex-col gap-[70px]">
          {/* Header */}
          <div className="flex flex-col gap-[30px] lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col items-start gap-5">
              <h2 className="t-h2 max-w-[14ch] text-white">
                Same transaction. Different world.
              </h2>
            </div>
            <p className="t-body max-w-[46ch] text-white/50">
              Nothing about the customer&apos;s active session changes. The decision architecture
              behind the gateway is swapped deliberately, so the transaction recovers without friction.
            </p>
          </div>

          {/* 3-Column Comparative Anatomy (1fr auto 1fr from SentinelX) */}
          <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-[1fr_auto_1fr]">
            {/* Left: BEFORE (Naive Blind Loop) */}
            <div className="flex flex-col gap-6 rounded-card p-6 ring-1 ring-inset bg-white/[0.03] ring-white/[0.08]">
              <header className="flex items-center justify-between gap-3">
                <span className="font-mono text-[12px] uppercase leading-none tracking-[0.2em] text-revly-rose">
                  BEFORE
                </span>
                <span className="font-mono text-[12.5px] uppercase leading-none tracking-[0.14em] text-white/55">
                  naive_loop + blind_retries
                </span>
              </header>

              <div className="flex flex-col gap-px overflow-hidden rounded-inner font-mono">
                <div className="flex items-center justify-between gap-4 bg-white/[0.04] px-4 py-3 text-[13px]">
                  <span className="text-white/50">Immediate retry</span>
                  <span className="font-medium text-revly-rose">Blind Trigger (504 Timeout)</span>
                </div>
                <div className="flex items-center justify-between gap-4 bg-white/[0.04] px-4 py-3 text-[13px]">
                  <span className="text-white/50">Scheduled retry #2</span>
                  <span className="font-medium text-revly-rose">Failed (Decline 51)</span>
                </div>
                <div className="flex items-center justify-between gap-4 bg-white/[0.04] px-4 py-3 text-[13px]">
                  <span className="text-white/50">Customer alerts</span>
                  <span className="font-medium text-revly-rose">3 Decline SMS Sent</span>
                </div>
                <div className="flex items-center justify-between gap-4 bg-white/[0.04] px-4 py-3 text-[13px]">
                  <span className="text-white/50">Bank card status</span>
                  <span className="font-medium text-revly-rose">Flagged Suspicious</span>
                </div>
                <div className="flex items-center justify-between gap-4 bg-white/[0.04] px-4 py-3 text-[13px]">
                  <span className="text-white/50">Outcome</span>
                  <span className="font-medium text-revly-rose">Permanent Churn</span>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-white/[0.08] pt-5">
                <span className="font-mono text-[12.5px] uppercase leading-none tracking-[0.14em] text-white/55">
                  Resulting telemetry
                </span>
                <ul className="flex flex-wrap gap-1.5">
                  <li><span className="inline-flex items-center gap-1.5 rounded-chip px-2.5 py-1.5 font-mono text-[12px] bg-white/[0.05] text-white/50">3 Attempts Wasted</span></li>
                  <li><span className="inline-flex items-center gap-1.5 rounded-chip px-2.5 py-1.5 font-mono text-[12px] bg-white/[0.05] text-white/50">Fee Penalties Incurred</span></li>
                  <li><span className="inline-flex items-center gap-1.5 rounded-chip px-2.5 py-1.5 font-mono text-[12px] bg-white/[0.05] text-white/50">Customer Trust Broken</span></li>
                  <li><span className="inline-flex items-center gap-1.5 rounded-chip px-2.5 py-1.5 font-mono text-[12px] bg-revly-rose/15 text-revly-rose ring-1 ring-inset ring-revly-rose/30">₹0 RECOVERED</span></li>
                </ul>
              </div>
            </div>

            {/* Center: Sequence Connector */}
            <div className="flex flex-row items-center justify-center gap-4 lg:w-[240px] lg:flex-col">
              <div className="hidden h-full w-px flex-1 bg-gradient-to-b from-transparent via-white/15 to-transparent lg:block" />
              <ol className="flex w-full flex-col gap-2 font-mono">
                <li className="flex flex-col gap-1 rounded-chip bg-white/[0.05] px-3 py-2.5 ring-1 ring-inset ring-white/[0.07]">
                  <span className="text-[11px] uppercase text-white/45">01 · webhook sandbox</span>
                  <span className="text-[13px] text-lime">idempotency_key</span>
                </li>
                <li className="flex flex-col gap-1 rounded-chip bg-white/[0.05] px-3 py-2.5 ring-1 ring-inset ring-white/[0.07]">
                  <span className="text-[11px] uppercase text-white/45">02 · diagnose context</span>
                  <span className="text-[13px] text-lime">telemetry_priors</span>
                </li>
                <li className="flex flex-col gap-1 rounded-chip bg-white/[0.05] px-3 py-2.5 ring-1 ring-inset ring-white/[0.07]">
                  <span className="text-[11px] uppercase text-white/45">03 · ERV optimize</span>
                  <span className="text-[13px] text-lime">maximize_net_value</span>
                </li>
                <li className="flex flex-col gap-1 rounded-chip bg-white/[0.05] px-3 py-2.5 ring-1 ring-inset ring-white/[0.07]">
                  <span className="text-[11px] uppercase text-white/45">04 · policy gate</span>
                  <span className="text-[13px] text-lime">allow_or_stop</span>
                </li>
              </ol>
              <div className="hidden h-full w-px flex-1 bg-gradient-to-b from-transparent via-white/15 to-transparent lg:block" />
            </div>

            {/* Right: AFTER (Revly Bounded Recovery) */}
            <div className="flex flex-col gap-6 rounded-card p-6 ring-1 ring-inset bg-white/[0.06] ring-white/30">
              <header className="flex items-center justify-between gap-3">
                <span className="font-mono text-[12px] uppercase leading-none tracking-[0.2em] text-lime">
                  AFTER
                </span>
                <span className="font-mono text-[12.5px] uppercase leading-none tracking-[0.14em] text-white/60">
                  revly_decision_plane + bounded_dispatch
                </span>
              </header>

              <div className="flex flex-col gap-px overflow-hidden rounded-inner font-mono">
                <div className="flex items-center justify-between gap-4 bg-white/[0.04] px-4 py-3 text-[13px]">
                  <span className="text-white/50">Immediate retry</span>
                  <span className="font-medium text-white/90">Suppressed (ERV ≤ 0)</span>
                </div>
                <div className="flex items-center justify-between gap-4 bg-white/[0.04] px-4 py-3 text-[13px]">
                  <span className="text-white/50">Delayed retry window</span>
                  <span className="font-medium text-lime">Scheduled (+14m Cooldown)</span>
                </div>
                <div className="flex items-center justify-between gap-4 bg-white/[0.04] px-4 py-3 text-[13px]">
                  <span className="text-white/50">Customer contact</span>
                  <span className="font-medium text-white/90">Daily Cap Respected (0/1)</span>
                </div>
                <div className="flex items-center justify-between gap-4 bg-white/[0.04] px-4 py-3 text-[13px]">
                  <span className="text-white/50">Policy verification</span>
                  <span className="font-medium text-lime">ALLOW (All Invariants Met)</span>
                </div>
                <div className="flex items-center justify-between gap-4 bg-white/[0.04] px-4 py-3 text-[13px]">
                  <span className="text-white/50">Ledger settlement</span>
                  <span className="font-medium text-lime">Captured in PostgreSQL</span>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-white/[0.08] pt-5">
                <span className="font-mono text-[12.5px] uppercase leading-none tracking-[0.14em] text-white/55">
                  Resulting telemetry
                </span>
                <ul className="flex flex-wrap gap-1.5">
                  <li><span className="inline-flex items-center gap-1.5 rounded-chip px-2.5 py-1.5 font-mono text-[12px] bg-white/[0.05] text-white/50">1 Optimal Attempt</span></li>
                  <li><span className="inline-flex items-center gap-1.5 rounded-chip px-2.5 py-1.5 font-mono text-[12px] bg-white/[0.05] text-white/50">Zero Customer Friction</span></li>
                  <li><span className="inline-flex items-center gap-1.5 rounded-chip px-2.5 py-1.5 font-mono text-[12px] bg-white/[0.05] text-white/50">Idempotency Guaranteed</span></li>
                  <li><span className="inline-flex items-center gap-1.5 rounded-chip px-2.5 py-1.5 font-mono text-[12px] bg-lime/15 text-lime ring-1 ring-inset ring-lime/30">₹8,499 RECOVERED</span></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

