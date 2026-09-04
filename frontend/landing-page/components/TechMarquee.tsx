"use client";

import React from "react";

export default function TechMarquee() {
  const stack = [
    "Go Decision Plane",
    "Postgres Ledger",
    "Redis Streams",
    "Logistic Regression",
    "Razorpay Webhooks",
    "Idempotency Locks",
    "Deterministic Policy",
    "ERV Optimizer",
    "Python Intelligence",
    "Ambiguous Reconciler",
  ];

  return (
    <div className="flex w-full max-w-[1140px] mx-auto flex-col items-center gap-4 py-8 px-gutter">
      <p className="t-micro text-muted">Eight stages, L0 webhook through L7 authoritative ledger</p>
      <div className="mask-rail group relative overflow-hidden w-full py-2">
        <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused]">
          <div className="flex shrink-0 items-center">
            {stack.map((item, idx) => (
              <span
                key={idx}
                className="px-7 font-mono text-[13px] whitespace-nowrap text-white/30 transition-colors duration-300 hover:text-white/70"
              >
                {item}
              </span>
            ))}
          </div>
          <div className="flex shrink-0 items-center" aria-hidden="true">
            {stack.map((item, idx) => (
              <span
                key={`repeat-${idx}`}
                className="px-7 font-mono text-[13px] whitespace-nowrap text-white/30 transition-colors duration-300 hover:text-white/70"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

