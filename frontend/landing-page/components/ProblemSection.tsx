"use client";

import React from "react";

export default function ProblemSection() {
  return (
    <section
      id="problem"
      className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 max-w-[1440px] mx-auto border-t border-border"
    >
      {/* Eyebrow */}
      <div className="flex items-center gap-2 mb-6">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-revly-cyan">
          01 · THE MECHANISM OF LOSS
        </span>
      </div>

      {/* Main Statement */}
      <div className="max-w-[1000px] mb-16">
        <h2 className="t-h2 text-white mb-6">
          A failed payment is an event.
          <br />
          <span className="text-white/60">Revenue recovery is a decision.</span>
        </h2>
        <p className="t-body max-w-[760px] text-base sm:text-lg">
          Revenue does not disappear in a single catastrophic failure. It slips away
          through naive automation: a payment drops, a script blindly retries, the bank
          rejects it again, the customer gets spammed with decline alerts, and the checkout
          is abandoned forever.
        </p>
      </div>

      {/* Comparative Technical Anatomy: Naive Retry vs. Revly Intelligent Loop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        {/* Left Card: The Naive Script */}
        <div className="rounded-lg bg-surface border border-white/10 p-6 sm:p-8 flex flex-col justify-between relative">
          <div>
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-revly-rose" />
                <span className="font-mono text-xs uppercase tracking-wider text-white/70">
                  NAIVE AUTOMATION · BLIND RETRY
                </span>
              </div>
              <span className="font-mono text-[10px] text-revly-rose/90 uppercase tracking-widest bg-revly-rose/10 px-2 py-0.5 rounded border border-revly-rose/20">
                HIGH FRICTION
              </span>
            </div>

            <p className="text-sm text-white/60 mb-6 font-mono">
              // The default gateway loop: retry every 4 hours until limit reached.
            </p>

            <div className="space-y-4 font-mono text-xs">
              <div className="p-3.5 rounded bg-surface-raised border border-white/[0.04] flex items-start gap-3">
                <span className="text-white/30 shrink-0">01</span>
                <div>
                  <div className="text-white font-medium">Payment Failed: ₹8,499</div>
                  <div className="text-white/40 text-[11px] mt-0.5">
                    Reason: Insufficient funds (Decline code 51)
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded bg-surface-raised border border-white/[0.04] flex items-start gap-3">
                <span className="text-revly-rose shrink-0">02</span>
                <div>
                  <div className="text-white font-medium">Blind Immediate Retry #1</div>
                  <div className="text-white/40 text-[11px] mt-0.5">
                    Zero latency delay · Customer balance hasn’t changed · Declined
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded bg-surface-raised border border-white/[0.04] flex items-start gap-3">
                <span className="text-revly-rose shrink-0">03</span>
                <div>
                  <div className="text-white font-medium">Blind Scheduled Retry #2</div>
                  <div className="text-white/40 text-[11px] mt-0.5">
                    Triggered at 03:00 AM · Bank fraud rule activates · Card blocked
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded bg-surface-raised border border-white/[0.04] flex items-start gap-3">
                <span className="text-white/30 shrink-0">04</span>
                <div>
                  <div className="text-white font-medium">Customer Disengagement</div>
                  <div className="text-white/40 text-[11px] mt-0.5">
                    Customer receives 3 decline SMS alerts · Trust eroded · Subscription canceled
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-white/[0.08] flex items-center justify-between font-mono text-xs">
            <span className="text-white/50">OUTCOME</span>
            <span className="text-revly-rose font-semibold">₹0 RECOVERED · CHURN ACCELERATED</span>
          </div>
        </div>

        {/* Right Card: The Revly Bounded Decision System */}
        <div className="rounded-lg bg-surface border border-revly-blue/40 p-6 sm:p-8 flex flex-col justify-between relative shadow-[0_0_40px_rgba(37,99,255,0.08)]">
          <div>
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-revly-cyan" />
                <span className="font-mono text-xs uppercase tracking-wider text-white font-medium">
                  REVLY · BOUNDED INTELLIGENCE
                </span>
              </div>
              <span className="font-mono text-[10px] text-revly-cyan uppercase tracking-widest bg-revly-cyan/10 px-2 py-0.5 rounded border border-revly-cyan/30">
                ECONOMIC MAXIMIZATION
              </span>
            </div>

            <p className="text-sm text-white/60 mb-6 font-mono">
              // Multi-signal diagnosis, ML success scoring, and ERV ranking.
            </p>

            <div className="space-y-4 font-mono text-xs">
              <div className="p-3.5 rounded bg-surface-raised border border-white/[0.04] flex items-start gap-3">
                <span className="text-white/30 shrink-0">01</span>
                <div>
                  <div className="text-white font-medium">Contextual Event Ingestion</div>
                  <div className="text-white/40 text-[11px] mt-0.5">
                    Captured raw webhook · Enriched with customer history (0 declines in 180 days)
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded bg-surface-raised border border-white/[0.04] flex items-start gap-3">
                <span className="text-revly-cyan shrink-0">02</span>
                <div>
                  <div className="text-white font-medium">Root-Cause Diagnosis & Gating</div>
                  <div className="text-white/40 text-[11px] mt-0.5">
                    Diagnosis: End-of-month liquidity gap · Suppress immediate retry
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded bg-surface-raised border border-white/[0.04] flex items-start gap-3">
                <span className="text-revly-cyan shrink-0">03</span>
                <div>
                  <div className="text-white font-medium">ERV Economic Optimization</div>
                  <div className="text-white/40 text-[11px] mt-0.5">
                    ERV(Payment Link) = +₹6,840 &gt; ERV(Retry Now) = -₹120
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded bg-surface-raised border border-white/[0.04] flex items-start gap-3">
                <span className="text-revly-emerald shrink-0">04</span>
                <div>
                  <div className="text-white font-medium">Deterministic Action Dispatch</div>
                  <div className="text-white/40 text-[11px] mt-0.5">
                    Policy checked · SMS/WhatsApp one-click payment link dispatched idempotently
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-white/[0.08] flex items-center justify-between font-mono text-xs">
            <span className="text-white/50">OUTCOME</span>
            <span className="text-revly-emerald font-semibold">₹8,499 RECOVERED · FRICTION MINIMIZED</span>
          </div>
        </div>
      </div>
    </section>
  );
}

