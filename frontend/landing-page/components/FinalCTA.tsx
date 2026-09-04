"use client";

import React from "react";

export default function FinalCTA() {
  return (
    <section className="relative py-28 sm:py-36 px-4 sm:px-6 lg:px-8 max-w-[1440px] mx-auto border-t border-border overflow-hidden text-center flex flex-col items-center">
      {/* Background ambient gradient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-r from-revly-cyan/10 via-revly-blue/15 to-revly-violet/10 blur-[140px] pointer-events-none rounded-full" />

      <div className="flex items-center gap-2 mb-8">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-revly-cyan">
          THE RECOVERY PARADIGM
        </span>
      </div>

      <h2 className="t-display tracking-tight text-ink max-w-[900px] mb-8">
        Turn revenue at risk
        <br />
        <span className="text-white/60">into intelligent recovery.</span>
      </h2>

      <p className="t-body max-w-[640px] text-base sm:text-lg mb-12 leading-relaxed">
        Revly brings diagnosis, economics, and deterministic safety into the
        recovery loop — so merchants recover more value without intervening blindly.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-4">
        <a
          href="#pipeline"
          className="group relative inline-flex items-center justify-center rounded-pill text-sm font-medium bg-white hover:bg-neutral-200 text-black py-4 pl-6 pr-12 transition-all duration-300 shadow-[0_4px_30px_rgba(255,255,255,0.15)] hover:-translate-y-0.5"
        >
          <span>Revisit Recovery Loop</span>
          <span className="absolute right-2 grid size-[30px] place-items-center rounded-full bg-black text-white transition-transform duration-300 group-hover:rotate-45">
            <svg viewBox="0 0 10 10" fill="none" className="size-2.5">
              <path
                d="M1.5 8.5 8.5 1.5M8.5 1.5H3.2M8.5 1.5v5.3"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </a>

        <a
          href="#boundary"
          className="inline-flex items-center justify-center rounded-pill text-sm font-medium bg-surface-subtle hover:bg-white/[0.06] text-ink border border-white/10 px-6 py-4 transition-all duration-300 hover:-translate-y-0.5"
        >
          <span>Review Safety Invariants</span>
        </a>
      </div>
    </section>
  );
}

