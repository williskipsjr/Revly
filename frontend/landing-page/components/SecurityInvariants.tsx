"use client";

import React, { useState } from "react";

export default function SecurityInvariants() {
  const [activeInvariant, setActiveInvariant] = useState(0);

  const invariants = [
    {
      num: "01",
      title: "The Prompt-Injection & Money Movement Boundary",
      quote:
        "The LLM is strictly downstream and advisory. It interprets diagnostic context, classifies root causes, and proposes candidate actions into schema-validated JSON. It can never trigger a gateway charge, execute an external API call, or alter ledger balances. Webhooks and customer data are untrusted external inputs; allowing an LLM direct actuator authority over financial movement would be prompt injection wired straight to the merchant's balance sheet.",
      tag: "Advisory isolation",
      layer: "Plane 01 · Intelligence sandbox",
      badge: "Non-negotiable",
    },
    {
      num: "02",
      title: "Deterministic Safety Gate Overrides Economics",
      quote:
        "Economics ranks actions, but pure-function deterministic policy constrains them. The Policy/Safety Engine contains zero machine learning weights. It evaluates hard mathematical boundaries: maximum 2 retries per 24 hours, mandatory ≥30-minute cooldowns, merchant amount ceilings, and global kill switches. If an action fails any safety rule, it is blocked immediately, regardless of its projected expected recovery value.",
      tag: "Pure-function rules",
      layer: "Plane 02 · Go decision runtime",
      badge: "Deterministic",
    },
    {
      num: "03",
      title: "Idempotent Execution & Ambiguous-Outcome Reconciliation",
      quote:
        "Financial systems must assume network calls can time out. Revly maintains strict unique database locks on idempotency keys derived from external event IDs before any external HTTP call is made. If a payment API returns an ambiguous 504 timeout, the action enters PENDING_CONFIRMATION and polls status via the reconciliation loop. It is never retried blindly, guaranteeing zero duplicate charges.",
      tag: "At-least-once with reconciliation",
      layer: "Plane 03 · PostgreSQL authoritative truth",
      badge: "Idempotent",
    },
  ];

  const current = invariants[activeInvariant];

  return (
    <section id="invariants" className="flex flex-col items-center pb-[100px] lg:pb-[180px]">
      <div className="flex w-full max-w-[1200px] flex-col items-center gap-[60px] px-gutter">
        <div className="flex flex-col items-center gap-5 text-center">
          <h2 className="t-h2 text-ink">
            Financial & safety invariants
          </h2>
        </div>

        {/* Invariant Switcher Block */}
        <div className="flex w-full flex-col items-center gap-6 sm:flex-row sm:items-stretch sm:gap-10">
          {/* Left: 3 Large Square Numbered Buttons */}
          <div className="flex shrink-0 flex-row items-center gap-3 sm:flex-col sm:justify-center">
            {invariants.map((inv, idx) => {
              const isSelected = activeInvariant === idx;
              return (
                <button
                  key={inv.num}
                  type="button"
                  onClick={() => setActiveInvariant(idx)}
                  className={`grid size-[84px] sm:size-[92px] shrink-0 place-items-center rounded-[18px] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                    isSelected
                      ? "bg-lime text-ink font-bold shadow-[0_0_25px_rgba(0,210,255,0.4)]"
                      : "bg-surface text-muted border border-white/[0.06] hover:bg-white/[0.08] hover:text-ink"
                  }`}
                >
                  <span className="font-mono text-[22px] leading-none tabular-nums">
                    {inv.num}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right: Detailed Invariant Dossier Card */}
          <div className="flex flex-1 flex-col justify-between gap-8 rounded-card bg-surface p-[30px] sm:p-[44px] border border-white/10">
            <span className="font-mono text-[11px] uppercase leading-none tracking-[0.18em] text-muted">
              Invariant {current.num} / 03 · {current.title}
            </span>

            <blockquote className="t-h3 max-w-[56ch] text-ink font-sans leading-relaxed text-lg sm:text-[21px]">
              &ldquo;{current.quote}&rdquo;
            </blockquote>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.08] pt-6">
              <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                <span className="font-medium text-ink">{current.tag}</span>
                <span className="size-1 rounded-full bg-white/40" />
                <span className="text-muted">{current.layer}</span>
              </div>
              <span className="t-micro rounded-pill px-3.5 py-1.5 font-medium text-ink bg-lime font-mono font-bold">
                {current.badge}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

