"use client";

import React from "react";

export default function ContinuitySection() {
  return (
    <section id="continuity" className="flex flex-col items-center py-[100px] lg:py-[180px]">
      <div className="flex w-full max-w-[850px] flex-col items-center gap-[60px] px-gutter">
        {/* Header */}
        <div className="flex max-w-[700px] flex-col items-center gap-5 text-center">
          <h2 className="t-h2 text-ink">
            Continuity you can inspect.
          </h2>
          <p className="t-body text-muted">
            Every recovery action is written to the immutable event log with the system
            state before and after. None of it is reconstructed later for the timeline.
          </p>
        </div>

        {/* 3-Card Layout */}
        <div className="grid w-full max-w-[790px] grid-cols-1 gap-2.5 sm:grid-cols-2">
          {/* Card 1: Preserved Amount */}
          <div className="flex min-h-[349px] flex-col justify-between rounded-card bg-surface p-[30px] border border-white/[0.06]">
            <span className="inline-flex items-center justify-center rounded-pill t-micro whitespace-nowrap px-3 py-1 bg-ink-chip text-white border border-white/10 w-fit">
              Preserved
            </span>
            <div className="flex flex-col gap-2.5">
              <span className="t-h2 text-ink font-mono font-semibold">₹8,499.00</span>
              <p className="t-body text-ink/70">
                The exact transaction amount, captured without customer friction
              </p>
            </div>
          </div>

          {/* Card 2: Swapped Action Window */}
          <div className="flex min-h-[349px] flex-col gap-6 rounded-card bg-surface p-[30px] border border-white/[0.06]">
            <div className="flex items-start justify-between gap-6">
              <p className="t-body max-w-[120px] text-muted">Action routing</p>
              <span className="inline-flex items-center justify-center rounded-pill t-micro whitespace-nowrap px-3 py-1 bg-white text-ink font-semibold">
                At threshold T
              </span>
            </div>
            <span className="t-h2 text-ink font-semibold">SWAPPED</span>

            {/* Bar Visualizer */}
            <div className="flex h-[60px] items-end gap-1.5" aria-hidden="true">
              <span className="flex-1 rounded-[4px] bg-ink/15 h-[34px]" />
              <span className="flex-1 rounded-[4px] bg-ink/15 h-[40px]" />
              <span className="flex-1 rounded-[4px] bg-ink/15 h-[36px]" />
              <span className="flex-1 rounded-[4px] bg-ink/15 h-[44px]" />
              <span className="flex-1 rounded-[4px] bg-lime h-[58px]" />
              <span className="flex-1 rounded-[4px] bg-lime h-[56px]" />
              <span className="flex-1 rounded-[4px] bg-ink/15 h-[30px]" />
              <span className="flex-1 rounded-[4px] bg-ink/15 h-[26px]" />
              <span className="flex-1 rounded-[4px] bg-ink/15 h-[24px]" />
              <span className="flex-1 rounded-[4px] bg-ink/15 h-[28px]" />
            </div>

            <p className="t-body text-muted">
              immediate_retry detached, optimal_window attached, customer experience untouched
            </p>
          </div>

          {/* Card 3: Full-width oval container card */}
          <div className="sm:col-span-2">
            <div className="flex flex-col items-center gap-[30px] rounded-card bg-plot p-[30px] sm:flex-row sm:gap-[50px] border border-white/[0.08]">
              {/* Oval container badge */}
              <div className="relative w-full shrink-0 overflow-hidden rounded-[999px] bg-surface border border-white/10 sm:w-[340px]">
                <div className="flex aspect-[340/260] flex-col items-center justify-center gap-2">
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">
                    IDEMPOTENCY LOCK
                  </span>
                  <span className="t-h3 text-white font-mono">IDEMP-RV-99214</span>
                  <span className="font-mono text-[11px] text-lime">unchanged</span>
                </div>
              </div>

              {/* Right content */}
              <div className="flex flex-1 flex-col gap-[36px]">
                <div className="flex flex-col gap-2.5">
                  <p className="t-body text-muted-invert">
                    Real payment credentials exposed to LLM
                  </p>
                  <span className="t-h2 text-lime font-mono font-bold">NONE</span>
                </div>

                <a
                  className="group relative inline-flex items-center justify-center rounded-pill t-ui whitespace-nowrap transition-[transform,box-shadow,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 bg-white text-ink py-3 pl-5 pr-[46px] w-fit shadow-[0_4px_20px_rgba(255,255,255,0.2)]"
                  href="#architecture"
                >
                  <span>Read the safety specification</span>
                  <span className="absolute right-1.5 grid size-[30px] place-items-center rounded-full overflow-hidden transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:rotate-45 bg-ink text-white">
                    <svg viewBox="0 0 10 10" fill="none" aria-hidden="true" className="size-2.5">
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

