"use client";

import React, { useState } from "react";

export default function ConversionSequence() {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      num: "01",
      title: "Detach",
      desc: "Suppress immediate blind retry. The gateway client halts rapid-fire retries, preventing issuer anti-fraud lockouts and customer decline notifications.",
    },
    {
      num: "02",
      title: "Enrich",
      desc: "Load customer lifetime value, prior attempt counters, and bank network telemetry. Model computes statistical P(success) across all candidate actions.",
    },
    {
      num: "03",
      title: "Optimize",
      desc: "Calculate Expected Recovery Value (ERV = P(success) × Amount − Fees − Friction). Sort candidates and enforce deterministic policy constraints.",
    },
    {
      num: "04",
      title: "Settle",
      desc: "Execute the winning action with unique PostgreSQL idempotency lock. Ambiguous timeouts are reconciled before authoritative ledger writes.",
    },
  ];

  const current = steps[activeStep];

  return (
    <section className="flex flex-col items-center pb-[100px] lg:pb-[180px]">
      <div className="grid w-full max-w-[1920px] grid-cols-1 gap-[30px] px-gutter lg:grid-cols-2">
        {/* Left Column: Event Store JSON Diagram */}
        <div className="flex flex-col justify-between gap-[50px] rounded-card bg-surface p-[40px] border border-white/10">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
            <h2 className="t-h2 max-w-[10ch] text-ink">
              How recovery runs.
            </h2>
            <p className="t-body max-w-[290px] text-muted sm:text-right">
              Four ordered operations, inside one bounded architecture that stays exactly where it is.
            </p>
          </div>

          <div className="flex flex-col gap-8">
            <div className="relative overflow-hidden bg-black h-[250px] w-full rounded-[20px] border border-white/[0.08] p-4 font-mono">
              <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" className="size-full" fill="none">
                <text x="20" y="26" fill="rgba(255,255,255,0.42)" fontSize="10" letterSpacing="2" style={{ fontFamily: "ui-monospace, monospace" }}>
                  EVENT STORE · REDIS STREAMS → POSTGRES
                </text>
                <line x1="20" y1="36" x2="380" y2="36" stroke="rgba(255,255,255,0.13)" />
                <text x="20" y="60" fill="rgba(255,255,255,0.5)" fontSize="10" style={{ fontFamily: "ui-monospace, monospace" }}>{"{"}</text>
                {[
                  { k: '"type":', v: '"REVENUE_RECOVERY_DECISION"', y: 80 },
                  { k: '"phase":', v: '"OPTIMIZED_EXECUTION"', y: 101 },
                  { k: '"payment_id":', v: '"pay_99214k"', y: 122 },
                  { k: '"erv_score":', v: "+7557.11", y: 143 },
                  { k: '"policy_verdict":', v: '"ALLOW"', y: 164 },
                  { k: '"idempotency_key":', v: '"IDEMP-RV-99214"', y: 185 },
                  { k: '"ledger_settled":', v: "true", y: 206 },
                  { k: '"egress_policy":', v: '"default-deny-unauthorized"', y: 227 },
                ].map((row, idx) => (
                  <g key={idx}>
                    <text x="34" y={row.y} fill="#00D2FF" fontSize="9.5" style={{ fontFamily: "ui-monospace, monospace" }}>{row.k}</text>
                    <text x="140" y={row.y} fill="rgba(255,255,255,0.78)" fontSize="9.5" style={{ fontFamily: "ui-monospace, monospace" }}>{row.v}</text>
                  </g>
                ))}
                <text x="20" y="250" fill="rgba(255,255,255,0.5)" fontSize="10" style={{ fontFamily: "ui-monospace, monospace" }}>{"}"}</text>
                <text x="20" y="280" fill="rgba(255,255,255,0.3)" fontSize="9" style={{ fontFamily: "ui-monospace, monospace" }}>
                  decision state transition authoritative in PostgreSQL
                </text>
              </svg>
            </div>

            <div className="flex flex-col items-end gap-2 text-right">
              <span className="t-display !text-[clamp(3rem,2rem+3vw,4.5rem)] leading-none text-ink font-mono font-bold">
                04
              </span>
              <p className="t-body max-w-[290px] text-muted">
                Ordered operations in the sequence. The payment gateway is never bypassed.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Step Sequence Card */}
        <div className="flex h-full min-h-[500px] flex-col items-center justify-center gap-10 rounded-[24px] bg-forest px-[8%] py-[60px] border border-white/10">
          <span className="t-ui font-mono uppercase tracking-[0.14em] text-white/60">
            Recovery sequence
          </span>

          <div className="relative flex w-full max-w-[420px] items-center justify-center">
            <div className="relative flex w-full flex-col items-center gap-5 rounded-[24px] px-8 pb-10 pt-12 text-center bg-lime text-ink shadow-[0_0_50px_rgba(0,210,255,0.25)]">
              <span className="t-ui absolute top-0 grid size-[56px] -translate-y-1/2 place-items-center rounded-full bg-white text-ink font-mono font-bold shadow-md">
                {current.num}
              </span>
              <h3 className="t-h3 text-ink font-bold text-2xl">
                {current.title}
              </h3>
              <p className="t-body max-w-[36ch] text-ink/80 text-sm font-sans">
                {current.desc}
              </p>
            </div>
          </div>

          {/* Stepper Dots / Bars */}
          <div className="flex items-center gap-3">
            {steps.map((s, idx) => (
              <button
                key={idx}
                type="button"
                aria-label={`Show step ${s.num}`}
                onClick={() => setActiveStep(idx)}
                className={`h-1 w-[54px] rounded-full transition-all duration-300 ${
                  activeStep === idx ? "bg-white" : "bg-white/20 hover:bg-white/40"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

