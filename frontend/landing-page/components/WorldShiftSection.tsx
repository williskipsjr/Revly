"use client";

import React, { useState } from "react";

export default function WorldShiftSection() {
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    {
      num: "01",
      title: "Universal sandboxing & Ingestion",
      desc: "Every failed webhook is sandboxed and keyed before anything is evaluated. The financial boundary is not something switched on once an error looks dangerous.",
      svgTitle: "L1 · UNIVERSAL SANDBOXING",
      subtext: "containerise first, decide later",
    },
    {
      num: "02",
      title: "Contextual diagnosis & Scoring",
      desc: "Failure reasons are cross-referenced with customer history and issuer behavior. Logistic regression predicts P(success) without exposing funds to LLM hallucinations.",
      svgTitle: "L2 · STATISTICAL SUCCESS SCORING",
      subtext: "ML estimates, LLM advises, neither touches money",
    },
    {
      num: "03",
      title: "In-place ERV economic ranking",
      desc: "Net value equals gross recoverable revenue minus direct gateway fees minus customer friction. Actions with ERV ≤ 0 are terminated immediately.",
      svgTitle: "L3 · ERV OPTIMIZATION SURFACE",
      subtext: "economics ranks, safety constrains",
    },
    {
      num: "04",
      title: "Deterministic execution & Audit",
      desc: "The Go decision plane enforces strict max-retry ceilings, cooldowns, and PostgreSQL unique idempotency locks before external dispatch.",
      svgTitle: "L4 · DETERMINISTIC DISPATCH & AUDIT",
      subtext: "immutable audit append-only log",
    },
  ];

  const active = tabs[activeTab];

  return (
    <section className="flex flex-col items-center px-gutter pb-[100px] lg:pb-[180px]">
      <div className="w-full max-w-[1920px] rounded-card border border-white/10 bg-plot">
        <div className="relative flex flex-col items-center overflow-hidden rounded-card px-gutter py-[100px] lg:py-[180px]">
          {/* Exact SentinelX vertical hairline grid guide lines */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="mx-auto flex h-full max-w-[1445px] justify-between">
              <span className="w-px bg-white/[0.04]" />
              <span className="w-px bg-white/[0.04]" />
              <span className="w-px bg-white/[0.04]" />
              <span className="w-px bg-white/[0.04]" />
              <span className="w-px bg-white/[0.04]" />
            </div>
          </div>

          <div className="relative flex w-full max-w-[1445px] flex-col gap-[100px] lg:gap-[160px]">
            {/* Massive Callout Statement */}
            <div className="flex flex-col items-start gap-[40px] lg:gap-[60px]">
              <div className="flex flex-col items-start gap-5">
                <h2 className="t-h2 flex flex-wrap gap-x-[0.28em] text-white">
                  <span>Most</span>
                  <span>systems</span>
                  <span>retry</span>
                  <span>the</span>
                  <span>payment</span>
                  <span>blindly,</span>
                  <span>or</span>
                  <span>abandon</span>
                  <span>it</span>
                  <span>completely.</span>
                  <span className="text-lime">Revly</span>
                  <span className="text-lime">changes</span>
                  <span className="text-lime">the</span>
                  <span className="text-lime">decision</span>
                  <span className="text-lime">instead.</span>
                  <span>Same</span>
                  <span>transaction,</span>
                  <span>same</span>
                  <span>customer,</span>
                  <span>same</span>
                  <span>gateway,</span>
                  <span>but</span>
                  <span>an</span>
                  <span>economically</span>
                  <span>bounded</span>
                  <span>path</span>
                  <span>to</span>
                  <span>recover.</span>
                </h2>
              </div>
              <div className="w-full max-w-[800px]">
                <p className="t-body max-w-[62ch] text-muted-invert">
                  Blind automation leaks. Card lockouts, repetitive bank declines, and spam notifications:
                  any one of them destroys customer goodwill. Leaving the customer undisturbed when
                  ERV ≤ 0 is the intelligence.
                </p>
              </div>
            </div>

            {/* Behind the Recovery: 4-Tab Interactive Switcher */}
            <div className="flex flex-col gap-[60px] lg:flex-row lg:items-start lg:gap-[100px]">
              {/* Left Column: Headline & 4 Tabs */}
              <div className="flex flex-1 flex-col gap-[40px]">
                <h3 className="t-h2 max-w-[12ch] text-white">
                  What happens behind the recovery?
                </h3>

                <div className="flex flex-col gap-2">
                  {tabs.map((t, idx) => {
                    const isSelected = activeTab === idx;
                    return (
                      <button
                        key={t.num}
                        type="button"
                        onClick={() => setActiveTab(idx)}
                        className={`group flex items-center gap-6 rounded-[18px] px-6 py-5 text-left transition-all duration-300 ${
                          isSelected
                            ? "bg-white/[0.08] ring-1 ring-inset ring-white/20"
                            : "hover:bg-white/[0.03]"
                        }`}
                      >
                        <span className="t-ui w-6 shrink-0 tabular-nums text-lime font-mono">
                          {t.num}
                        </span>
                        <span
                          className={`t-h3 transition-colors duration-300 text-lg sm:text-xl ${
                            isSelected ? "text-white" : "text-white/40 group-hover:text-white/70"
                          }`}
                        >
                          {t.title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Architectural Blueprint Diagram */}
              <div className="flex w-full flex-col gap-6 lg:w-[46%]">
                <div className="relative aspect-square w-full overflow-hidden rounded-card border border-white/10 bg-black">
                  <svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid meet" className="size-full" fill="none">
                    <text
                      x="24"
                      y="34"
                      fill="rgba(255,255,255,0.42)"
                      fontSize="11"
                      letterSpacing="2"
                      style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
                    >
                      {active.svgTitle}
                    </text>

                    {/* Step Connectors & Containers */}
                    {[
                      { ip: "10.0.0.17", id: "evt_rzp_99214k", active: activeTab === 0, y: 78 },
                      { ip: "10.0.1.30", id: "context_enrich_02", active: activeTab === 1, y: 124 },
                      { ip: "10.0.2.43", id: "erv_optimizer_03", active: activeTab === 2, y: 170 },
                      { ip: "10.0.3.56", id: "policy_gate_allow", active: activeTab === 3, y: 216 },
                      { ip: "10.0.4.69", id: "postgres_ledger_ok", active: false, y: 262 },
                      { ip: "10.0.5.82", id: "idempotency_locked", active: false, y: 308 },
                    ].map((row, idx) => (
                      <g key={idx}>
                        <line
                          x1="24"
                          y1={row.y + 14}
                          x2="118"
                          y2={row.y + 14}
                          stroke="rgba(255,255,255,0.13)"
                          strokeWidth="1"
                          strokeDasharray="3 3"
                        />
                        <text
                          x="24"
                          y={row.y + 8}
                          fill="rgba(255,255,255,0.42)"
                          fontSize="9"
                          style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
                        >
                          {row.ip}
                        </text>
                        <rect
                          x="130"
                          y={row.y}
                          width="160"
                          height="28"
                          rx="5"
                          fill={row.active ? "rgba(0, 210, 255, 0.12)" : "rgba(255,255,255,0.03)"}
                          stroke={row.active ? "#00D2FF" : "rgba(255,255,255,0.1)"}
                          strokeWidth={row.active ? 1.6 : 1}
                        />
                        <text
                          x="142"
                          y={row.y + 18}
                          fill={row.active ? "#00D2FF" : "rgba(255,255,255,0.42)"}
                          fontSize="10"
                          style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
                        >
                          {row.id}
                        </text>
                      </g>
                    ))}

                    <line x1="310" y1="70" x2="310" y2="352" stroke="rgba(255,255,255,0.13)" strokeWidth="1" />
                    <text
                      x="326"
                      y="216"
                      fill="rgba(255,255,255,0.42)"
                      fontSize="10"
                      letterSpacing="1.5"
                      style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
                      transform="rotate(90 326 216)"
                      textAnchor="middle"
                    >
                      POSTGRESQL DURABLE AUDIT
                    </text>
                    <text
                      x="24"
                      y="382"
                      fill="rgba(255,255,255,0.3)"
                      fontSize="10"
                      style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
                    >
                      {active.subtext}
                    </text>
                  </svg>
                </div>
                <p className="t-body max-w-[52ch] text-muted-invert">
                  {active.desc}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

