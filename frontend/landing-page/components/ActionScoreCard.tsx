"use client";

import React from "react";

export default function ActionScoreCard() {
  const actions = [
    {
      action: "SMART RETRY",
      probability: 89,
      method: "HDFC API (Coordinated Window)",
      confidence: "HIGH",
      expectedTime: "14 minutes",
      pColor: "text-revly-cyan",
      barColor: "bg-revly-cyan",
      why: "Transient bank network timeout with zero prior failures in 180 days.",
    },
    {
      action: "PAYMENT LINK",
      probability: 74,
      method: "SMS & WhatsApp One-Click",
      confidence: "MEDIUM-HIGH",
      expectedTime: "2 hours",
      pColor: "text-revly-blue",
      barColor: "bg-revly-blue",
      why: "High mobile interaction rate, active UPI intent on device.",
    },
    {
      action: "CUSTOMER REMINDER",
      probability: 61,
      method: "Push Notification / Email",
      confidence: "MODERATE",
      expectedTime: "6 hours",
      pColor: "text-white/70",
      barColor: "bg-white/40",
      why: "Non-urgent subscription billing with scheduled retry fallback.",
    },
    {
      action: "METHOD SWITCH",
      probability: 48,
      method: "VPA Update Request",
      confidence: "MODERATE",
      expectedTime: "24 hours",
      pColor: "text-white/50",
      barColor: "bg-white/20",
      why: "Requires customer manual entry of new card or bank mandate.",
    },
  ];

  return (
    <section className="relative py-16 px-4 sm:px-6 lg:px-8 max-w-[1440px] mx-auto">
      <div className="rounded-lg bg-surface border border-border p-6 sm:p-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08] mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-revly-cyan">
                05 · RECOVERABILITY ASSESSMENT
              </span>
              <span className="font-mono text-[10px] text-white/40 bg-white/[0.05] px-2 py-0.5 rounded">
                SIMULATED EVALUATION
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-semibold text-white">
              The best action is the one most likely to recover value.
            </h3>
            <p className="text-xs sm:text-sm text-white/60 mt-1">
              Not the one that is easiest to automate. Machine learning estimates P(success)
              per action before economic ranking.
            </p>
          </div>
          <div className="font-mono text-xs text-white/40 text-left sm:text-right shrink-0">
            MODEL: LOGISTIC REGRESSION v1.4
            <br />
            CALIBRATION: HELD-OUT POPULATION
          </div>
        </div>

        {/* Action Probability Rows */}
        <div className="space-y-4">
          {actions.map((item) => (
            <div
              key={item.action}
              className="p-4 sm:p-5 rounded bg-surface-raised border border-white/[0.04] flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="md:w-1/3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-semibold text-white">
                    {item.action}
                  </span>
                  <span className="font-mono text-[10px] text-white/50 bg-black/40 px-2 py-0.5 rounded border border-white/[0.06]">
                    {item.method}
                  </span>
                </div>
                <p className="text-xs text-white/50 mt-1 font-sans">
                  {item.why}
                </p>
              </div>

              {/* Progress Bar & Probability */}
              <div className="md:w-1/2 flex items-center gap-4">
                <div className="w-full bg-white/[0.06] h-2 rounded-full overflow-hidden">
                  <div
                    className={`${item.barColor} h-full rounded-full transition-all duration-700`}
                    style={{ width: `${item.probability}%` }}
                  />
                </div>
                <div className="font-mono text-right shrink-0 w-24">
                  <span className={`text-base font-bold ${item.pColor}`}>
                    {item.probability}%
                  </span>
                  <span className="text-[10px] text-white/40 block">
                    P(SUCCESS)
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

