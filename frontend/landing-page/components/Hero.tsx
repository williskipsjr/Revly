"use client";

import React, { useState, useEffect, useRef } from "react";

export default function Hero() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [tProgress, setTProgress] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Animated 3D/Surface waveform canvas matching SentinelX
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let frame = 0;

    const render = () => {
      frame++;
      const width = (canvas.width = canvas.offsetWidth * 2);
      const height = (canvas.height = canvas.offsetHeight * 2);

      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1.5;

      const rows = 14;
      const cols = 28;
      const xSpacing = width / (cols - 1);
      const ySpacing = height / (rows + 4);

      for (let i = 0; i < rows; i++) {
        ctx.beginPath();
        const yBase = (i + 2) * ySpacing;
        const alpha = 0.15 + (i / rows) * 0.45;
        ctx.strokeStyle = `rgba(0, 210, 255, ${alpha})`;

        for (let j = 0; j < cols; j++) {
          const x = j * xSpacing;
          const distFromCenter = Math.abs(j - cols / 2) / (cols / 2);
          const distFromRow = Math.abs(i - rows / 2) / (rows / 2);
          const wave = Math.sin(j * 0.35 + frame * 0.04 + i * 0.4) * 14;
          const basin = Math.exp(-(distFromCenter * distFromCenter + distFromRow * distFromRow) * 2.5) * 45;
          const y = yBase + wave + basin;

          if (j === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <section className="flex flex-col items-center px-gutter pt-[80px] pb-[80px] lg:pt-[100px] lg:pb-[100px]">
      <div className="flex w-full max-w-[1920px] flex-col items-center gap-[50px]">
        {/* Top Header Block */}
        <div className="flex w-full flex-col items-center gap-[60px] lg:gap-[80px] px-2.5 pt-[60px] pb-[30px]">
          <div className="flex w-full max-w-[1080px] flex-col items-center gap-10">
            <div className="flex flex-col items-center gap-[24px]">
              {/* Eyebrow */}
              <span className="t-micro rounded-pill bg-white/[0.06] border border-white/10 px-4 py-1.5 text-white/70">
                Razorpay AI Buildathon · Track 03 // Bounded Revenue Recovery
              </span>

              {/* Exact SentinelX headline word-by-word mask presentation */}
              <h1 className="t-display !leading-[1.05] flex flex-wrap items-center justify-center gap-x-[0.24em] text-center text-ink">
                <span className="inline-flex overflow-hidden py-[0.06em]">
                  <span className="inline-block">What</span>
                </span>
                <span className="inline-flex overflow-hidden py-[0.06em]">
                  <span className="inline-block">if</span>
                </span>
                <span className="inline-flex overflow-hidden py-[0.06em]">
                  <span className="inline-block">revenue</span>
                </span>
                <span className="inline-flex overflow-hidden py-[0.06em]">
                  <span className="inline-block">never</span>
                </span>
                <span className="inline-flex overflow-hidden py-[0.06em]">
                  <span className="inline-block">slipped</span>
                </span>
                <span className="inline-flex overflow-hidden py-[0.06em]">
                  <span className="inline-block">through</span>
                </span>
                <span className="inline-flex overflow-hidden py-[0.06em] text-lime font-semibold">
                  <span className="inline-block">decisions?</span>
                </span>
              </h1>

              {/* Sub-copy */}
              <p className="t-body max-w-[56ch] text-center text-muted">
                Every payment failure sandboxed, continuously scored, and{" "}
                <span className="font-medium text-ink">recovered in place</span>.
                The customer keeps the flow, and Revly bounds the economic decision behind it.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-[24px] px-[20px]">
              <a
                className="group relative inline-flex items-center justify-center rounded-pill t-ui whitespace-nowrap transition-[transform,box-shadow,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 text-white py-[17px] pl-6 pr-[48px] bg-ink-raised border border-white/20 shadow-[0_5px_14px_rgba(0,0,0,0.5),0_14px_50px_rgba(0,0,0,0.5)]"
                href="#watch"
              >
                <span>Watch a recovery</span>
                <span className="absolute right-1.5 grid size-[32px] place-items-center rounded-full overflow-hidden transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:rotate-45 bg-white text-ink">
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

              <a
                className="group relative inline-flex items-center justify-center rounded-pill t-ui whitespace-nowrap transition-[transform,box-shadow,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 bg-transparent text-ink ring-1 ring-inset ring-[rgba(255,255,255,0.18)] px-6 py-[17px] hover:bg-white/[0.04]"
                href="#architecture"
              >
                <span>Read the architecture</span>
              </a>
            </div>
          </div>
        </div>

        {/* Dual Hero Technical Visualizations (655 / 500 ratio from SentinelX) */}
        <div className="flex w-full flex-col items-stretch gap-[30px] lg:flex-row">
          {/* Left Chart Card */}
          <div className="relative flex h-[420px] flex-1 flex-col justify-between overflow-hidden rounded-card bg-plot p-[30px] lg:h-[693px] lg:flex-[655] border border-white/[0.08]">
            <div className="relative flex items-start justify-between gap-4">
              <span className="font-mono text-[12.5px] uppercase leading-none tracking-[0.14em] text-white/55">
                L2 · RECOVERY PROBABILITY OVER TIME
              </span>
              <span className="font-mono text-[12.5px] uppercase leading-none tracking-[0.14em] text-lime">
                P(SUCCESS) 0–100
              </span>
            </div>

            {/* Exact SVG chart geometry from SentinelX reference */}
            <div className="relative my-auto">
              <svg
                viewBox="0 0 640 300"
                className="w-full"
                fill="none"
                role="img"
                aria-label="Payment recovery probability computed from 24 telemetry events crossing threshold of 70 at t+166s."
              >
                <defs>
                  <linearGradient id="revly-risk-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00D2FF" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#2563FF" stopOpacity="0" />
                  </linearGradient>
                  <clipPath id="revly-after">
                    <rect x="413.3" y="0" width="226.7" height="300" />
                  </clipPath>
                </defs>

                {/* Horizontal grid lines & Y labels */}
                {[
                  { y: 256, val: "0" },
                  { y: 198, val: "25" },
                  { y: 140, val: "50" },
                  { y: 82, val: "75" },
                  { y: 24, val: "100" },
                ].map((g) => (
                  <g key={g.y}>
                    <line x1="40" x2="618" y1={g.y} y2={g.y} stroke="rgba(255,255,255,0.07)" />
                    <text x="30" y={g.y + 3.5} textAnchor="end" className="font-mono" fontSize="11.5" fill="rgba(255,255,255,0.5)">
                      {g.val}
                    </text>
                  </g>
                ))}

                {/* Shaded post-threshold background block */}
                <rect x="413.3" y="24" width="204.7" height="232" fill="rgba(0,210,255,0.03)" />

                {/* Observation tick bars */}
                {[
                  { x: 53.5, y1: 256, y2: 251.4 },
                  { x: 78.2, y1: 247, y2: 242.4 },
                  { x: 114.2, y1: 236.5, y2: 227.2 },
                  { x: 156.9, y1: 222.6, y2: 215.6 },
                  { x: 199.7, y1: 211.8, y2: 202.5 },
                  { x: 255.9, y1: 196.4, y2: 180.1 },
                  { x: 327.9, y1: 171.5, y2: 150.6 },
                  { x: 381.9, y1: 139.9, y2: 116.7 },
                  { x: 413.3, y1: 124.0, y2: 70.6 },
                  { x: 465.1, y1: 55.2, y2: 29.7 },
                  { x: 521.3, y1: 35.3, y2: 24.0 },
                  { x: 618.0, y1: 36.2, y2: 24.0 },
                ].map((l, idx) => (
                  <line key={idx} x1={l.x} x2={l.x} y1={l.y1} y2={l.y2} stroke="rgba(0,210,255,0.6)" strokeWidth="1.5" />
                ))}

                {/* Threshold line at T = 70 (y = 93.6) */}
                <line x1="40" x2="618" y1="93.6" y2="93.6" stroke="#FFFFFF" strokeWidth="1.3" strokeDasharray="5 5" />
                <text x="618" y="85.6" textAnchor="end" className="font-mono" fontSize="11.5" letterSpacing="0.14em" fill="#FFFFFF">
                  THRESHOLD T = 70 (ERV &gt; 0)
                </text>

                {/* Trajectory Area Fill */}
                <path
                  d="M40.0 256.0 L53.5 256.0 L64.7 251.4 L78.2 247.0 L94.0 242.7 L114.2 236.5 L132.2 228.1 L156.9 222.6 L174.9 216.8 L199.7 211.8 L226.7 204.9 L255.9 196.4 L291.9 184.7 L327.9 171.5 L357.1 155.7 L381.9 139.9 L413.3 124.0 L440.3 79.0 L465.1 55.2 L492.1 39.9 L521.3 35.3 L552.8 36.2 L586.5 37.0 L618.0 36.2 L618 256 L40 256 Z"
                  fill="url(#revly-risk-fill)"
                />

                {/* Main trajectory path */}
                <path
                  d="M40.0 256.0 L53.5 256.0 L64.7 251.4 L78.2 247.0 L94.0 242.7 L114.2 236.5 L132.2 228.1 L156.9 222.6 L174.9 216.8 L199.7 211.8 L226.7 204.9 L255.9 196.4 L291.9 184.7 L327.9 171.5 L357.1 155.7 L381.9 139.9 L413.3 124.0 L440.3 79.0 L465.1 55.2 L492.1 39.9 L521.3 35.3 L552.8 36.2 L586.5 37.0 L618.0 36.2"
                  stroke="#00D2FF"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                />

                {/* White stroke overlay after threshold */}
                <path
                  d="M40.0 256.0 L53.5 256.0 L64.7 251.4 L78.2 247.0 L94.0 242.7 L114.2 236.5 L132.2 228.1 L156.9 222.6 L174.9 216.8 L199.7 211.8 L226.7 204.9 L255.9 196.4 L291.9 184.7 L327.9 171.5 L357.1 155.7 L381.9 139.9 L413.3 124.0 L440.3 79.0 L465.1 55.2 L492.1 39.9 L521.3 35.3 L552.8 36.2 L586.5 37.0 L618.0 36.2"
                  clipPath="url(#revly-after)"
                  stroke="#FFFFFF"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                />

                {/* Crossing Marker Marker */}
                <g>
                  <line x1="413.3" x2="413.3" y1="24" y2="256" stroke="rgba(255,255,255,0.45)" />
                  <circle cx="413.3" cy="70.6" r="6.5" fill="#050506" />
                  <circle cx="413.3" cy="70.6" r="4" fill="#00D2FF" />
                  <text x="403.3" y="36" textAnchor="end" className="font-mono" fontSize="11.5" fill="#FFFFFF">
                    t+166s → RECOVER ₹8,499
                  </text>
                </g>

                {/* Sub-labels */}
                <text x="40" y="276" className="font-mono" fontSize="11.5" letterSpacing="0.14em" fill="rgba(255,255,255,0.55)">
                  INGEST → ENRICH → ERV OPTIMIZE
                </text>
                <text x="618" y="276" textAnchor="end" className="font-mono" fontSize="11.5" letterSpacing="0.14em" fill="#00D2FF">
                  BOUNDED SETTLEMENT
                </text>
                <text x="40" y="292" className="font-mono" fontSize="11" fill="rgba(255,255,255,0.4)">
                  24 observations over 257s · half-life 180s · ERV positive
                </text>
              </svg>
            </div>

            <p className="t-body relative max-w-[38ch] text-white/55">
              The score decays. Telemetry evidence has to keep arriving.
            </p>
          </div>

          {/* Right Sidebar Card */}
          <div className="rounded-card bg-plot p-2.5 lg:w-[500px] lg:shrink-0 border border-white/[0.08]">
            <div className="flex h-full flex-col items-center justify-between gap-10 rounded-inner bg-plot p-[30px]">
              {/* Top Surface Canvas */}
              <div className="flex w-full flex-col items-center gap-[30px] pb-6">
                <div className="relative w-full overflow-hidden rounded-inner bg-black border border-white/[0.06]">
                  <div className="relative h-[210px] w-full">
                    <canvas ref={canvasRef} className="block size-full" />
                  </div>
                  <span className="font-mono text-[12.5px] uppercase leading-none tracking-[0.14em] text-white/55 absolute bottom-3 left-4">
                    L2 · ERV economic surface at dispatch
                  </span>
                </div>

                <div className="flex w-full items-end justify-between">
                  <span className="t-display !text-[clamp(3rem,2rem+3vw,5.125rem)] text-white">
                    100%
                  </span>
                  <span className="t-body pb-4 text-muted-invert">
                    of failed payments policy-gated
                  </span>
                </div>
              </div>

              {/* Lower Invariant Notice */}
              <div className="flex w-full flex-col items-start gap-[24px]">
                <h2 className="t-h3 text-white">
                  The payment gateway is never bypassed. The customer survives.
                </h2>
                <div className="flex w-full items-center justify-between">
                  <span className="t-body text-muted-invert">Direct LLM financial movement</span>
                  <span className="t-stat text-white font-mono bg-white/[0.08] px-3 py-1 rounded">
                    DENY
                  </span>
                </div>
                <div className="h-px w-full bg-rule-invert" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
