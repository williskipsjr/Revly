"use client";

import React from "react";

export default function ThreeMechanisms() {
  const mechanisms = [
    {
      layer: "L1 · Webhook Ingestion",
      sublayer: "Before any verdict",
      title: "Universal containment",
      desc: "Sandbox first, decide later. Recovery optimization only works because the failure event already lives somewhere controllable. We never wait to evaluate customer value before establishing idempotency.",
      stat: "100%",
      statDesc: "payment failures sandboxed on receipt",
      badge: "L1 · Ingestion",
      svg: (
        <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" className="size-full" fill="none">
          <text x="24" y="34" fill="rgba(255,255,255,0.42)" fontSize="11" letterSpacing="2" style={{ fontFamily: "ui-monospace, monospace" }}>
            L1 · UNIVERSAL SANDBOXING
          </text>
          {[
            { id: "evt_rzp_11a", y: 78 },
            { id: "evt_rzp_22b", y: 124 },
            { id: "evt_rzp_33c", y: 170 },
            { id: "evt_rzp_44d", y: 216 },
          ].map((item, idx) => (
            <g key={idx}>
              <line x1="24" y1={item.y + 14} x2="118" y2={item.y + 14} stroke="rgba(255,255,255,0.13)" strokeWidth="1" strokeDasharray="3 3" />
              <text x="24" y={item.y + 8} fill="rgba(255,255,255,0.42)" fontSize="9" style={{ fontFamily: "ui-monospace, monospace" }}>
                10.0.0.{idx + 10}
              </text>
              <rect x="130" y={item.y} width="150" height="28" rx="5" fill={idx === 2 ? "rgba(0,210,255,0.12)" : "rgba(255,255,255,0.04)"} stroke={idx === 2 ? "#00D2FF" : "rgba(255,255,255,0.1)"} strokeWidth={idx === 2 ? 1.6 : 1} />
              <text x="142" y={item.y + 18} fill={idx === 2 ? "#00D2FF" : "rgba(255,255,255,0.5)"} fontSize="10" style={{ fontFamily: "ui-monospace, monospace" }}>
                {item.id}
              </text>
            </g>
          ))}
          <line x1="300" y1="65" x2="300" y2="260" stroke="rgba(255,255,255,0.13)" strokeWidth="1" />
          <text x="316" y="160" fill="rgba(255,255,255,0.42)" fontSize="10" letterSpacing="1.5" style={{ fontFamily: "ui-monospace, monospace" }} transform="rotate(90 316 160)" textAnchor="middle">
            POSTGRESQL UNIQUE LOCK
          </text>
        </svg>
      ),
    },
    {
      layer: "L2 · Statistical Model",
      sublayer: "Continuous + request-level",
      title: "A score that decays",
      desc: "Telemetry signals raise the recoverability score; elapsed time and customer contact fatigue lower it again. Cumulative scoring tracks the delayed payment window; synchronous rules catch chronic declines instantly.",
      stat: "~30",
      statDesc: "weighted heuristics scoring every payment",
      badge: "L2 · Logistic Regression",
      svg: (
        <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" className="size-full" fill="none">
          <text x="20" y="26" fill="rgba(255,255,255,0.42)" fontSize="10" letterSpacing="2" style={{ fontFamily: "ui-monospace, monospace" }}>
            L2 · HEURISTIC TRANSCRIPT
          </text>
          <text x="380" y="26" fill="rgba(255,255,255,0.42)" fontSize="10" letterSpacing="1" style={{ fontFamily: "ui-monospace, monospace" }} textAnchor="end">
            SCORE
          </text>
          <line x1="20" y1="36" x2="380" y2="36" stroke="rgba(255,255,255,0.13)" />
          {[
            { t: "010s", cmd: "context_enrich: past_success_rate", delta: "+15", score: "35" },
            { t: "045s", cmd: "issuer_telemetry: gateway_504_blip", delta: "+24", score: "59" },
            { t: "080s", cmd: "customer_contact: zero_attempts_24h", delta: "+12", score: "71" },
            { t: "120s", cmd: "erv_compute: gross_minus_friction", delta: "+18", score: "89" },
          ].map((row, idx) => (
            <g key={idx}>
              <text x="20" y={62 + idx * 28} fill="rgba(255,255,255,0.3)" fontSize="9" style={{ fontFamily: "ui-monospace, monospace" }}>{row.t}</text>
              <text x="54" y={62 + idx * 28} fill="#00D2FF" fontSize="9.5" style={{ fontFamily: "ui-monospace, monospace" }}>$</text>
              <text x="68" y={62 + idx * 28} fill="rgba(255,255,255,0.7)" fontSize="9.5" style={{ fontFamily: "ui-monospace, monospace" }}>{row.cmd}</text>
              <text x="352" y={62 + idx * 28} fill="#00D2FF" fontSize="9" style={{ fontFamily: "ui-monospace, monospace" }} textAnchor="end">{row.delta}</text>
              <text x="380" y={62 + idx * 28} fill="#FFFFFF" fontSize="9.5" style={{ fontFamily: "ui-monospace, monospace" }} textAnchor="end">{row.score}</text>
            </g>
          ))}
        </svg>
      ),
    },
    {
      layer: "L4 · Decision Swap",
      sublayer: "In place, mid-incident",
      title: "The decision swap",
      desc: "Four ordered operations inside one running container. The payment gateway is never bypassed, which is exactly why the checkout experience on the customer screen never stutters or drops.",
      stat: "0",
      statDesc: "unauthorized money moves or retries",
      badge: "L4 · Policy Settle",
      svg: (
        <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" className="size-full" fill="none">
          <text x="20" y="26" fill="rgba(255,255,255,0.42)" fontSize="10" letterSpacing="2" style={{ fontFamily: "ui-monospace, monospace" }}>
            L4 · IN-PLACE DECISION SWAP
          </text>
          <rect x="140" y="48" width="120" height="30" rx="15" fill="rgba(0,210,255,0.1)" stroke="#00D2FF" />
          <text x="200" y="67" fill="#00D2FF" fontSize="10" style={{ fontFamily: "ui-monospace, monospace" }} textAnchor="middle">
            policy_engine
          </text>
          <line x1="200" y1="78" x2="200" y2="118" stroke="#00D2FF" strokeWidth="1.5" />
          <text x="208" y="102" fill="rgba(255,255,255,0.42)" fontSize="8.5" style={{ fontFamily: "ui-monospace, monospace" }}>
            deterministic
          </text>
          <rect x="128" y="118" width="144" height="58" rx="8" fill="rgba(255,255,255,0.05)" stroke="#FFFFFF" strokeWidth="1.4" />
          <text x="200" y="142" fill="#FFFFFF" fontSize="11" style={{ fontFamily: "ui-monospace, monospace" }} textAnchor="middle">
            IDEMP-RV-99214
          </text>
          <text x="200" y="160" fill="rgba(255,255,255,0.42)" fontSize="8.5" style={{ fontFamily: "ui-monospace, monospace" }} textAnchor="middle">
            ₹8,499 · scheduled_retry
          </text>
        </svg>
      ),
    },
  ];

  return (
    <section className="flex flex-col items-center pb-[100px] lg:pb-[180px]">
      <div className="flex w-full max-w-[1200px] flex-col gap-[60px] px-gutter">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <h2 className="t-h2 text-ink">
            The three mechanisms
          </h2>
          <a
            className="group relative inline-flex items-center justify-center rounded-pill t-ui whitespace-nowrap transition-[transform,box-shadow,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 text-white py-3 pl-5 pr-[46px] bg-ink-raised border border-white/10 shadow-[0_5px_14px_rgba(0,0,0,0.5)]"
            href="#surface"
          >
            <span>All eight stages</span>
            <span className="absolute right-1.5 grid size-[30px] place-items-center rounded-full overflow-hidden transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:rotate-45 bg-white text-ink">
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

        {/* Mechanism Article Cards */}
        <div className="flex flex-col gap-6 lg:gap-[60px]">
          {mechanisms.map((m, idx) => (
            <article
              key={idx}
              className="group grid overflow-hidden rounded-card bg-plot border border-white/10 lg:grid-cols-[1.45fr_1fr]"
            >
              {/* Left Schematic */}
              <div className="relative min-h-[300px] overflow-hidden lg:min-h-[460px] bg-black border-b lg:border-b-0 lg:border-r border-white/10">
                <div className="overflow-hidden bg-black absolute inset-0 size-full p-4">
                  {m.svg}
                </div>
              </div>

              {/* Right Details */}
              <div className="flex flex-col gap-8 p-[30px] lg:p-[40px] justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="t-micro rounded-pill bg-white/10 px-3.5 py-1.5 font-mono text-white">
                    {m.layer}
                  </span>
                  <span className="t-micro rounded-pill bg-white/10 px-3.5 py-1.5 text-white/70">
                    {m.sublayer}
                  </span>
                </div>

                <div className="flex flex-col gap-3">
                  <h3 className="t-h2 text-white !text-[28px] sm:!text-[32px]">
                    {m.title}
                  </h3>
                  <p className="t-body max-w-[34ch] text-white/55">
                    {m.desc}
                  </p>
                </div>

                <div className="mt-auto flex flex-col gap-6">
                  <span className="h-px w-full bg-white/10" />
                  <div className="flex items-end justify-between gap-4">
                    <span className="t-display !text-[clamp(2.5rem,1.5rem+2.5vw,3.5rem)] leading-none text-lime font-mono font-bold">
                      {m.stat}
                    </span>
                    <span className="t-body pb-1 text-white/55 text-right max-w-[22ch]">
                      {m.statDesc}
                    </span>
                  </div>

                  <a
                    href="#architecture"
                    className="t-ui flex items-center justify-between gap-3 rounded-pill bg-white py-2.5 pl-6 pr-2 text-ink font-semibold transition-transform hover:-translate-y-0.5"
                  >
                    <span>Read the layer spec</span>
                    <span className="grid size-[36px] shrink-0 place-items-center rounded-full bg-ink text-white transition-transform duration-300 group-hover:rotate-45">
                      <svg viewBox="0 0 10 10" fill="none" aria-hidden="true" className="size-3">
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
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

