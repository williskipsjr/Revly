"use client";

import React from "react";

export default function RelocationFingerprints() {
  const naivePoints = [
    "Duplicate charges triggered without verifying idempotent state",
    "Generic 'Payment Failed' spam sent when the bank's core banking is down",
    "Retries fired immediately against empty accounts before salary deposits",
    "Merchant hits gateway rate-limits and card network fraud velocity flags",
  ];

  const revlyPoints = [
    "Single idempotent lock: duplicate charges are structurally impossible",
    "Outage-aware backoff: waits for issuer 504 gateway recovery window",
    "Contextual channels: dynamic WhatsApp pay link or alternative UPI QR fallback",
    "Expected Recovery Value (ERV) engine halts before incurring net customer friction",
  ];

  return (
    <section className="flex flex-col items-center px-gutter pb-[100px] lg:pb-[180px]">
      <div className="relative flex w-full max-w-[1445px] flex-col items-center gap-[60px]">
        {/* Header */}
        <div className="relative flex flex-col items-center gap-5 text-center">
          <h2 className="t-h2 max-w-[20ch] text-white">
            Blind retries destroy customer trust.
          </h2>
          <p className="t-body max-w-[56ch] text-white/50">
            Re-submitting the same failed card token against an already-exhausted bank API isn&apos;t revenue recovery — it&apos;s chargeback risk. Revly swaps the intervention before customer frustration peaks.
          </p>
        </div>

        {/* Comparative Header with VS Badge */}
        <div className="relative flex w-full max-w-[1445px] flex-col gap-2.5 sm:flex-row">
          <div className="t-body flex flex-1 items-center justify-center rounded-[18px] bg-white/[0.06] px-6 py-6 font-medium text-white">
            Naive exponential retry loop
          </div>
          <span className="t-ui absolute left-1/2 top-1/2 z-10 hidden size-[68px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-ink font-medium text-white ring-8 ring-ink sm:grid">
            VS
          </span>
          <div className="flex flex-1 items-center justify-center gap-2.5 rounded-[18px] bg-lime px-6 py-6 text-ink">
            <svg viewBox="0 0 24 24" fill="none" className="size-6 text-ink">
              <path
                d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5zm-1 14.5l-3.5-3.5 1.41-1.41L11 13.67l5.09-5.09 1.41 1.41L11 16.5z"
                fill="currentColor"
              />
            </svg>
            <span className="t-h3 !text-[22px] font-semibold tracking-[-0.035em]">
              Revly Recovery
            </span>
          </div>
        </div>

        {/* Side by side bullet columns */}
        <div className="relative grid w-full max-w-[1445px] grid-cols-1 gap-x-2.5 gap-y-6 sm:grid-cols-2">
          {/* Left Column: Naive */}
          <div className="flex flex-col gap-6 px-2 sm:px-8">
            {naivePoints.map((pt, idx) => (
              <div key={idx} className="flex items-start gap-3.5">
                <svg
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                  className="mt-1 size-3.5 shrink-0 text-white/35"
                >
                  <path
                    d="M3 3l6 6M9 3l-6 6"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
                <p className="t-body text-white/45">{pt}</p>
              </div>
            ))}
          </div>

          {/* Right Column: Revly */}
          <div className="flex flex-col gap-6 px-2 sm:px-8">
            {revlyPoints.map((pt, idx) => (
              <div key={idx} className="flex items-start gap-3.5">
                <svg
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                  className="mt-1 size-3.5 shrink-0 text-lime"
                >
                  <path
                    d="m2 6.3 2.6 2.6L10 3.4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="t-body font-medium text-white">{pt}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
