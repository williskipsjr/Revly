"use client";

import React, { useState, useEffect } from "react";

export default function WatchItHappen() {
  const [step, setStep] = useState(0); // 0 to 4
  const [isPlaying, setIsPlaying] = useState(true);

  const steps = [
    { label: "INGEST", time: "t+00s", pty: "rzp_webhook: payment.failed id=pay_9924k amount=₹8,499.00", signal: 12, status: "INGESTION_ACTIVE" },
    { label: "DIAGNOSE", time: "t+45s", pty: "enrich context: history_success=0.99 prior_attempts=0 issuer_err=504", signal: 45, status: "CONTEXT_ATTACHED" },
    { label: "SCORE", time: "t+90s", pty: "ml_model.score: p(retry)=0.89 p(link)=0.74 p(remind)=0.61", signal: 68, status: "ML_SCORED" },
    { label: "GATE", time: "t+140s", pty: "policy.eval: max_retries=0/2 cooldown=valid -> ALLOW", signal: 82, status: "POLICY_APPROVED" },
    { label: "RECOVER", time: "t+195s", pty: "executor.dispatch: key=IDEMP-RV-99214 status=CAPTURED +₹8,499", signal: 98, status: "BOUNDED_SETTLED" },
  ];

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setStep((prev) => (prev >= 4 ? 0 : prev + 1));
    }, 3200);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const active = steps[step];
  const isPostThreshold = active.signal >= 70;

  return (
    <section id="watch" className="flex flex-col items-center px-gutter pb-[100px] lg:pb-[180px]">
      <div className="relative w-full max-w-[1920px] overflow-hidden rounded-card bg-plot px-gutter py-[80px] lg:py-[120px] border border-white/[0.08]">
        <div className="relative mx-auto flex w-full max-w-[1445px] flex-col gap-[60px]">
          {/* Section Header */}
          <div className="flex flex-col gap-[30px] lg:flex-row lg:items-end lg:justify-between">
            <h2 className="t-h2 max-w-[15ch] text-white">
              Watch it happen.
            </h2>
            <p className="t-body max-w-[52ch] text-white/50">
              One recorded payment failure, replayed against the live scoring rule. The commands,
              the weights and the moment the ERV crosses T are all read from the model. The playback
              only controls when each observation appears. Watch the right-hand column at the crossing:
              the decision swaps from naive retry to optimal bounded recovery, and nothing about the
              customer session drops.
            </p>
          </div>

          {/* Stepper Chips with connectors */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {steps.map((s, idx) => {
              const isActive = idx === step;
              const isPast = idx <= step;
              return (
                <span key={s.label} className="flex items-center gap-3">
                  {idx > 0 && <span className="h-px w-5 bg-white/15 hidden sm:block" />}
                  <button
                    onClick={() => {
                      setStep(idx);
                      setIsPlaying(false);
                    }}
                    className={`rounded-chip px-3.5 py-2 font-mono text-[12px] tracking-[0.1em] transition-all ${
                      isActive
                        ? "bg-lime text-ink font-bold shadow-[0_0_15px_rgba(0,210,255,0.4)]"
                        : isPast
                        ? "bg-white/[0.12] text-white"
                        : "bg-white/[0.06] text-white/40"
                    }`}
                  >
                    {s.label}
                  </button>
                </span>
              );
            })}
          </div>

          {/* Dual Split Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr]">
            {/* Left Column: L5 Live PTY Terminal */}
            <div className="flex flex-col gap-4 rounded-card bg-white/[0.03] p-6 ring-1 ring-inset ring-white/[0.07]">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[12.5px] uppercase leading-none tracking-[0.14em] text-white/55">
                  L5 · live PTY
                </span>
                <span className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-lime animate-pulse" />
                  <span className="font-mono text-[12.5px] uppercase leading-none tracking-[0.14em] text-lime">
                    RECOVERY ENGINE ACTIVE
                  </span>
                </span>
              </div>

              {/* Terminal Logs Stream */}
              <div className="flex h-[290px] flex-col justify-end gap-2 overflow-hidden font-mono text-[13px] bg-black/40 p-4 rounded-inner border border-white/[0.04]">
                {steps.slice(0, step + 1).map((log, idx) => (
                  <div key={idx} className="flex items-baseline gap-3 transition-all duration-300">
                    <span className="w-[38px] shrink-0 text-white/30 text-[11.5px]">{log.time}</span>
                    <span className="text-lime">$</span>
                    <span className="min-w-0 flex-1 truncate text-white/80">{log.pty}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: L2 Score & L4 Candidate Interventions */}
            <div className="flex flex-col gap-6">
              {/* Box 1: L2 Session Risk / Recovery Score */}
              <div className="flex flex-col gap-4 rounded-card bg-white/[0.03] p-6 ring-1 ring-inset ring-white/[0.07]">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[12.5px] uppercase leading-none tracking-[0.14em] text-white/55">
                    L2 · recovery signal
                  </span>
                  <span className="t-stat tabular-nums text-lime text-2xl font-bold">
                    {active.signal}
                  </span>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className="h-full rounded-full bg-lime transition-all duration-500"
                    style={{ width: `${active.signal}%` }}
                  />
                  <span className="absolute inset-y-0 w-px bg-white/70" style={{ left: "70%" }} />
                </div>
                <div className="flex justify-between font-mono text-[12.5px] uppercase leading-none tracking-[0.14em]">
                  <span className="text-white/55">0</span>
                  <span className="text-white/70">THRESHOLD T = 70</span>
                  <span className="text-white/55">100</span>
                </div>
              </div>

              {/* Box 2: L4 Action Optimization List */}
              <div
                className={`flex flex-col gap-4 rounded-card p-6 ring-1 ring-inset transition-colors duration-700 bg-white/[0.03] ${
                  isPostThreshold ? "ring-lime/40 bg-white/[0.05]" : "ring-white/[0.07]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[12.5px] uppercase leading-none tracking-[0.14em] text-white/55">
                    L4 · candidate interventions
                  </span>
                  <span className="font-mono text-[12px] text-lime">
                    {isPostThreshold ? "optimal_action_selected" : "scoring_active"}
                  </span>
                </div>

                <div className="flex flex-col gap-px overflow-hidden rounded-inner font-mono text-[13px]">
                  <div className="flex items-center justify-between gap-4 bg-white/[0.04] px-4 py-2.5">
                    <span className="text-white/70">Scheduled Delayed Retry</span>
                    <span className="font-medium text-lime">ERV +₹7,557 · ALLOW</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 bg-white/[0.04] px-4 py-2.5">
                    <span className="text-white/50">One-Click Payment Link</span>
                    <span className="text-white/80">ERV +₹6,280 · ALLOW</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 bg-white/[0.04] px-4 py-2.5">
                    <span className="text-white/50">Customer Soft Reminder</span>
                    <span className="text-white/80">ERV +₹4,120 · ALLOW</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 bg-white/[0.04] px-4 py-2.5">
                    <span className="text-white/50">Method Switch Request</span>
                    <span className="text-white/80">ERV +₹2,100 · ALLOW</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 bg-white/[0.04] px-4 py-2.5">
                    <span className="text-white/30">Blind Immediate Retry</span>
                    <span className="text-revly-rose font-medium">−₹120 · BLOCKED</span>
                  </div>
                </div>

                <p className="font-mono text-[12px] leading-[1.6] text-white/40">
                  {isPostThreshold
                    ? "Crossed threshold T. Scheduled delayed retry dispatched idempotently."
                    : "Accumulating priors. Nothing has crossed the threshold yet."}
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Scrubber */}
          <div className="flex flex-col gap-3">
            <div className="relative h-[3px] w-full rounded-full bg-white/10">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-lime transition-all duration-300"
                style={{ width: `${(step / 4) * 100}%` }}
              />
              <span className="absolute -top-1 h-[11px] w-px bg-white/50" style={{ left: "70%" }} />
            </div>
            <div className="flex justify-between font-mono text-[12.5px] uppercase leading-none tracking-[0.14em]">
              <span className="text-white/55">{active.time}</span>
              <span className="text-lime">{active.status}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

