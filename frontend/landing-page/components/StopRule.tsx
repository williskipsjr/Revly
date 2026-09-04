"use client";

import React from "react";

export default function StopRule() {
  return (
    <section className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 max-w-[1440px] mx-auto border-t border-border">
      <div className="flex items-center gap-2 mb-6">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-revly-cyan">
          09 · THE RESTRAINT PRINCIPLE
        </span>
      </div>

      <div className="max-w-[1000px] mb-16">
        <h2 className="t-h2 text-white mb-6">
          Recovery without restraint
          <br />
          <span className="text-white/60">becomes friction.</span>
        </h2>
        <p className="t-body max-w-[760px] text-base sm:text-lg">
          Naive recovery systems obsess over persistence. Revly obsesses over net
          economic value. When further interventions risk customer harassment, brand
          damage, or payment gateway penalties, Revly halts automatically.
        </p>
      </div>

      {/* The 4 Hard Restraint Guards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <div className="p-6 rounded-lg bg-surface border border-white/10 flex flex-col justify-between">
          <div>
            <div className="font-mono text-2xl font-bold text-white mb-1">
              ≤ 2 Retries
            </div>
            <div className="font-mono text-[11px] text-revly-cyan uppercase tracking-wider mb-3">
              MAX RETRY CEILING
            </div>
            <p className="text-xs text-white/60 leading-relaxed">
              Strict per-incident limit over 24 hours. Prevents card locking and issuer
              anti-fraud penalties.
            </p>
          </div>
          <div className="mt-6 pt-3 border-t border-white/[0.08] font-mono text-[10px] text-white/40">
            ENFORCED BY POLICY ENGINE
          </div>
        </div>

        <div className="p-6 rounded-lg bg-surface border border-white/10 flex flex-col justify-between">
          <div>
            <div className="font-mono text-2xl font-bold text-white mb-1">
              ≥ 30 Minutes
            </div>
            <div className="font-mono text-[11px] text-revly-cyan uppercase tracking-wider mb-3">
              MANDATORY COOLDOWN
            </div>
            <p className="text-xs text-white/60 leading-relaxed">
              Guarantees time for bank network recovery and prevents rapid duplicate
              auth attempts.
            </p>
          </div>
          <div className="mt-6 pt-3 border-t border-white/[0.08] font-mono text-[10px] text-white/40">
            REDIS / POSTGRES TIME LOCK
          </div>
        </div>

        <div className="p-6 rounded-lg bg-surface border border-white/10 flex flex-col justify-between">
          <div>
            <div className="font-mono text-2xl font-bold text-revly-rose mb-1">
              ERV ≤ 0 Cutoff
            </div>
            <div className="font-mono text-[11px] text-revly-rose uppercase tracking-wider mb-3">
              NEGATIVE VALUE HALT
            </div>
            <p className="text-xs text-white/60 leading-relaxed">
              If expected recovered value is lower than customer annoyance cost,
              the action is suppressed.
            </p>
          </div>
          <div className="mt-6 pt-3 border-t border-white/[0.08] font-mono text-[10px] text-white/40">
            AUTOMATIC RESTRAINT
          </div>
        </div>

        <div className="p-6 rounded-lg bg-surface border border-white/10 flex flex-col justify-between">
          <div>
            <div className="font-mono text-2xl font-bold text-revly-amber mb-1">
              Hard Kill Switch
            </div>
            <div className="font-mono text-[11px] text-revly-amber uppercase tracking-wider mb-3">
              OPERATOR OVERRIDE
            </div>
            <p className="text-xs text-white/60 leading-relaxed">
              Immediate merchant-wide or customer-specific kill switch that halts all
              autonomous actions instantly.
            </p>
          </div>
          <div className="mt-6 pt-3 border-t border-white/[0.08] font-mono text-[10px] text-white/40">
            MANUAL OVERRIDE CAPABILITY
          </div>
        </div>
      </div>

      {/* Narrative Quote Banner */}
      <div className="p-6 rounded-lg bg-surface border border-white/[0.06] text-center font-mono text-xs sm:text-sm text-white/70">
        &ldquo;The goal isn’t to intervene more. It’s to recover smarter.&rdquo;
      </div>
    </section>
  );
}

