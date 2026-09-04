"use client";

import React from "react";

export default function SessionIntelligence() {
  const heuristics = [
    { code: "E1001", w: "w2", color: "rgba(69, 49, 124, 0.9)" },
    { code: "E1002", w: "w2", color: "rgba(69, 49, 124, 0.9)" },
    { code: "E1003", w: "w3", color: "rgba(62, 71, 135, 0.9)" },
    { code: "E1004", w: "w4", color: "rgba(54, 91, 139, 0.9)" },
    { code: "E1005", w: "w3", color: "rgba(62, 71, 135, 0.9)" },
    { code: "E1006", w: "w3", color: "rgba(62, 71, 135, 0.9)" },
    { code: "E1007", w: "w3", color: "rgba(62, 71, 135, 0.9)" },
    { code: "E1008", w: "w4", color: "rgba(54, 91, 139, 0.9)" },
    { code: "E1009", w: "w7", color: "rgba(34, 144, 139, 0.9)" },
    { code: "E1010", w: "w5", color: "rgba(46, 109, 142, 0.9)" },
    { code: "E1011", w: "w9", color: "rgba(48, 177, 124, 0.9)" },
    { code: "E1012", w: "w10", color: "rgba(77, 192, 107, 0.9)" },
    { code: "E1013", w: "w12", color: "rgba(159, 217, 56, 0.9)" },
    { code: "E1014", w: "w11", color: "rgba(114, 206, 85, 0.9)" },
    { code: "E1015", w: "w9", color: "rgba(48, 177, 124, 0.9)" },
    { code: "E1016", w: "w14", color: "rgba(0, 210, 255, 0.9)" },
    { code: "E1017", w: "w14", color: "rgba(0, 210, 255, 0.9)" },
    { code: "E1018", w: "w10", color: "rgba(77, 192, 107, 0.9)" },
  ];

  return (
    <section id="intelligence" className="flex flex-col items-center pb-[100px] lg:pb-[180px]">
      <div className="flex w-full max-w-[1200px] flex-col gap-[60px] px-gutter">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="flex flex-col items-start gap-5">
            <h2 className="t-h2 text-ink">
              Recovery intelligence
            </h2>
          </div>
          <a
            className="group relative inline-flex items-center justify-center rounded-pill t-ui whitespace-nowrap transition-[transform,box-shadow,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 text-white py-3 pl-5 pr-[46px] bg-ink-raised border border-white/10 shadow-[0_5px_14px_rgba(0,0,0,0.5)]"
            href="#surface"
          >
            <span>See the full record</span>
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

        {/* 2-Column Intelligence Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left: Failure Taxonomy Heatmap Matrix */}
          <div className="group relative flex min-h-[420px] flex-col justify-between overflow-hidden rounded-card p-[30px] lg:min-h-[500px] bg-plot border border-white/10">
            <div className="overflow-hidden bg-black absolute inset-0 size-full">
              <svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid meet" className="size-full" fill="none">
                <text x="20" y="28" fill="rgba(255,255,255,0.42)" fontSize="11" letterSpacing="2" style={{ fontFamily: "ui-monospace, monospace" }}>
                  L6 · FAILURE TAXONOMY COVERAGE
                </text>
                <text x="20" y="46" fill="rgba(255,255,255,0.28)" fontSize="9" style={{ fontFamily: "ui-monospace, monospace" }}>
                  33 weighted heuristics mapped deterministically
                </text>

                {/* Heatmap Grid Nodes */}
                {heuristics.map((h, idx) => {
                  const col = idx % 6;
                  const row = Math.floor(idx / 6);
                  const x = 20 + col * 58;
                  const y = 64 + row * 58;
                  return (
                    <g key={idx}>
                      <rect x={x} y={y} width="52" height="52" rx="3" fill={h.color} />
                      <text x={x + 26} y={y + 24} fill="#FFFFFF" fontSize="8" style={{ fontFamily: "ui-monospace, monospace" }} textAnchor="middle">
                        {h.code}
                      </text>
                      <text x={x + 26} y={y + 38} fill="rgba(255,255,255,0.7)" fontSize="9" style={{ fontFamily: "ui-monospace, monospace" }} textAnchor="middle">
                        {h.w}
                      </text>
                    </g>
                  );
                })}

                <text x="20" y="386" fill="rgba(255,255,255,0.3)" fontSize="9" style={{ fontFamily: "ui-monospace, monospace" }}>
                  colour = configured weight, not observed frequency
                </text>
              </svg>
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-[linear-gradient(0deg,rgba(5,5,6,0.95)_15%,transparent)]" />
            <span className="t-micro relative w-fit rounded-pill bg-white px-3.5 py-1.5 text-ink font-bold">
              Primary output
            </span>
            <div className="relative flex flex-col gap-3">
              <div className="t-body flex flex-wrap items-center gap-2 text-white/70">
                <span>Taxonomy</span>
                <span className="size-1 rounded-full bg-white/50" />
                <span>Deterministic</span>
              </div>
              <h3 className="t-h3 max-w-[24ch] text-white">
                The failure sequence is mapped to root causes before a single token is generated
              </h3>
            </div>
          </div>

          {/* Right Column: 2 Smaller Cards */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Card 1: Structured Indicators */}
            <div className="group flex flex-col gap-4">
              <div className="relative overflow-hidden bg-black aspect-[4/3] w-full rounded-[20px] ring-1 ring-inset ring-rule">
                <svg viewBox="0 0 260 195" preserveAspectRatio="xMidYMid meet" className="size-full" fill="none">
                  <text x="16" y="24" fill="rgba(255,255,255,0.42)" fontSize="9.5" letterSpacing="1.6" style={{ fontFamily: "ui-monospace, monospace" }}>
                    L6 · RECOVERY SIGNALS
                  </text>
                  <line x1="16" y1="34" x2="244" y2="34" stroke="rgba(255,255,255,0.13)" />
                  <g>
                    <rect x="16" y="46" width="228" height="24" rx="4" fill="rgba(255,255,255,0.05)" />
                    <text x="26" y="62" fill="#00D2FF" fontSize="9" style={{ fontFamily: "ui-monospace, monospace" }}>issuer_code</text>
                    <text x="234" y="62" fill="rgba(255,255,255,0.78)" fontSize="9" style={{ fontFamily: "ui-monospace, monospace" }} textAnchor="end">504_GATEWAY_TIMEOUT</text>
                  </g>
                  <g>
                    <rect x="16" y="78" width="228" height="24" rx="4" fill="rgba(255,255,255,0.05)" />
                    <text x="26" y="94" fill="#00D2FF" fontSize="9" style={{ fontFamily: "ui-monospace, monospace" }}>p_success</text>
                    <text x="234" y="94" fill="rgba(255,255,255,0.78)" fontSize="9" style={{ fontFamily: "ui-monospace, monospace" }} textAnchor="end">0.89 [RETRY]</text>
                  </g>
                  <g>
                    <rect x="16" y="110" width="228" height="24" rx="4" fill="rgba(255,255,255,0.05)" />
                    <text x="26" y="126" fill="#00D2FF" fontSize="9" style={{ fontFamily: "ui-monospace, monospace" }}>cooldown</text>
                    <text x="234" y="126" fill="rgba(255,255,255,0.78)" fontSize="9" style={{ fontFamily: "ui-monospace, monospace" }} textAnchor="end">14m window valid</text>
                  </g>
                  <g>
                    <rect x="16" y="142" width="228" height="24" rx="4" fill="rgba(255,255,255,0.05)" />
                    <text x="26" y="158" fill="#00D2FF" fontSize="9" style={{ fontFamily: "ui-monospace, monospace" }}>idemp_key</text>
                    <text x="234" y="158" fill="rgba(255,255,255,0.78)" fontSize="9" style={{ fontFamily: "ui-monospace, monospace" }} textAnchor="end">IDEMP-RV-99214</text>
                  </g>
                  <text x="16" y="186" fill="rgba(255,255,255,0.35)" fontSize="8.5" style={{ fontFamily: "ui-monospace, monospace" }}>
                    deterministic, no model actuator involved
                  </text>
                </svg>
              </div>
              <div className="t-body flex flex-wrap items-center gap-2 text-muted">
                <span>Telemetry</span>
                <span className="size-1 rounded-full bg-ink/30" />
                <span>Structured</span>
              </div>
              <h3 className="t-h3 !text-[20px] max-w-[22ch] text-ink">
                Error codes, customer priors and cooldown windows, lifted from the ledger
              </h3>
            </div>

            {/* Card 2: Clustered Cohorts */}
            <div className="group flex flex-col gap-4">
              <div className="relative overflow-hidden bg-black aspect-[4/3] w-full rounded-[20px] ring-1 ring-inset ring-rule">
                <svg viewBox="0 0 260 195" preserveAspectRatio="xMidYMid meet" className="size-full" fill="none">
                  <text x="16" y="24" fill="rgba(255,255,255,0.42)" fontSize="9.5" letterSpacing="1.6" style={{ fontFamily: "ui-monospace, monospace" }}>
                    L7 · PORTFOLIO CORRELATION
                  </text>
                  <g>
                    <circle cx="84" cy="92" r="40" stroke="rgba(255,255,255,0.13)" strokeDasharray="3 4" />
                    <circle cx="68" cy="108" r="3.4" fill="#00D2FF" />
                    <circle cx="60" cy="86" r="3.4" fill="#00D2FF" />
                    <circle cx="76" cy="69" r="3.4" fill="#00D2FF" />
                    <circle cx="100" cy="74" r="3.4" fill="#00D2FF" />
                    <circle cx="84" cy="92" r="5" fill="#050506" stroke="#00D2FF" strokeWidth="1.3" />
                    <text x="84" y="146" fill="rgba(255,255,255,0.42)" fontSize="8.5" style={{ fontFamily: "ui-monospace, monospace" }} textAnchor="middle">
                      cohort-upi-transient
                    </text>
                  </g>
                  <g>
                    <circle cx="182" cy="108" r="30" stroke="rgba(255,255,255,0.13)" strokeDasharray="3 4" />
                    <circle cx="199" cy="104" r="3.4" fill="#2563FF" />
                    <circle cx="185" cy="125" r="3.4" fill="#2563FF" />
                    <circle cx="164" cy="111" r="3.4" fill="#2563FF" />
                    <circle cx="182" cy="108" r="5" fill="#050506" stroke="#2563FF" strokeWidth="1.3" />
                    <text x="182" y="152" fill="rgba(255,255,255,0.42)" fontSize="8.5" style={{ fontFamily: "ui-monospace, monospace" }} textAnchor="middle">
                      cohort-card-liquidity
                    </text>
                  </g>
                  <text x="16" y="186" fill="rgba(255,255,255,0.35)" fontSize="8.5" style={{ fontFamily: "ui-monospace, monospace" }}>
                    issuer outage cluster + recovery window, not attribution
                  </text>
                </svg>
              </div>
              <div className="t-body flex flex-wrap items-center gap-2 text-muted">
                <span>Cohorts</span>
                <span className="size-1 rounded-full bg-ink/30" />
                <span>Correlated</span>
              </div>
              <h3 className="t-h3 !text-[20px] max-w-[22ch] text-ink">
                Payments clustered by issuer behavior and recovery window, never by crude rules
              </h3>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

