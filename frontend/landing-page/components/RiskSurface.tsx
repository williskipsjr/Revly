"use client";

import React, { useEffect, useRef } from "react";

function WaveCanvas({ intensity = 1, accentColor = "#00D2FF" }: { intensity?: number; accentColor?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
      ctx.lineWidth = 1.3;

      const lines = 10;
      const points = 24;
      const xGap = width / (points - 1);
      const yGap = height / (lines + 2);

      for (let l = 0; l < lines; l++) {
        ctx.beginPath();
        const yBase = (l + 1.5) * yGap;
        ctx.strokeStyle = accentColor;
        ctx.globalAlpha = 0.2 + (l / lines) * 0.6;

        for (let p = 0; p < points; p++) {
          const x = p * xGap;
          const distFromCenter = Math.abs(p - points / 2) / (points / 2);
          const dip = Math.exp(-distFromCenter * distFromCenter * 3) * (intensity * 35);
          const ripple = Math.sin(p * 0.4 + frame * 0.03 + l * 0.5) * 8;
          const y = yBase + ripple + dip;

          if (p === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [intensity, accentColor]);

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-inner bg-black">
      <canvas ref={canvasRef} className="block size-full" />
    </div>
  );
}

export default function RiskSurface() {
  return (
    <section id="surface" className="flex flex-col items-center px-gutter pb-[100px] lg:pb-[180px]">
      <div className="relative w-full max-w-[1920px] overflow-hidden rounded-card bg-plot px-gutter py-[80px] lg:py-[120px] border border-white/[0.08]">
        <div className="relative mx-auto flex w-full max-w-[1445px] flex-col gap-[70px]">
          {/* Section Header */}
          <div className="flex flex-col gap-[30px] lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col items-start gap-5">
              <h2 className="t-h2 max-w-[16ch] text-white">
                Recovery is a surface, not a switch.
              </h2>
            </div>
            <div>
              <p className="t-body max-w-[52ch] text-white/50">
                A failed payment&apos;s score is a point moving over a field of weighted
                telemetry evidence. Early on the field is noise, because nothing has converged
                and nothing should. As diagnostic signals accumulate and economic recoverability
                crystallizes, the surface deepens into an ERV basin, and the trajectory falls into it.
              </p>
            </div>
          </div>

          {/* 3 Figures Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Figure 1: Normal / Noise */}
            <figure className="flex h-full flex-col gap-5 rounded-card p-5 bg-white/[0.03] ring-1 ring-inset ring-lime/25">
              <figcaption className="flex items-center justify-between gap-3">
                <span className="font-mono text-[12px] uppercase leading-none tracking-[0.2em] text-lime">
                  NORMAL
                </span>
                <span className="font-mono text-[12.5px] uppercase leading-none tracking-[0.14em] text-white/55">
                  t+40s · ERV −₹420
                </span>
              </figcaption>
              <WaveCanvas intensity={0.4} accentColor="rgba(0, 210, 255, 0.45)" />
              <code className="block truncate rounded-chip bg-white/[0.05] px-3 py-2.5 font-mono text-[12.5px] text-white/60">
                $ webhook payment.failed id=pay_8499
              </code>
              <p className="t-micro leading-[1.5] text-white/45">
                Broadband noise, no basin. Weak passive priors only: issuer gateway timeout,
                card BIN, amount tier. None of it is a verdict.
              </p>
            </figure>

            {/* Figure 2: Diagnosed / Minimum forming */}
            <figure className="flex h-full flex-col gap-5 rounded-card p-5 bg-white/[0.03] ring-1 ring-inset ring-teal/35">
              <figcaption className="flex items-center justify-between gap-3">
                <span className="font-mono text-[12px] uppercase leading-none tracking-[0.2em] text-teal">
                  DIAGNOSED
                </span>
                <span className="font-mono text-[12.5px] uppercase leading-none tracking-[0.14em] text-white/55">
                  t+130s · ERV +₹2,140
                </span>
              </figcaption>
              <WaveCanvas intensity={1.2} accentColor="rgba(37, 99, 255, 0.65)" />
              <code className="block truncate rounded-chip bg-white/[0.05] px-3 py-2.5 font-mono text-[12.5px] text-white/60">
                $ enrich customer_history --attempts 0/2
              </code>
              <p className="t-micro leading-[1.5] text-white/45">
                Telemetry accumulating faster than it decays. A minimum is forming, but the session
                keeps full deterministic safety constraints.
              </p>
            </figure>

            {/* Figure 3: Decisive Basin / Recovery */}
            <figure className="flex h-full flex-col gap-5 rounded-card p-5 bg-white/[0.03] ring-1 ring-inset ring-white/35">
              <figcaption className="flex items-center justify-between gap-3">
                <span className="font-mono text-[12px] uppercase leading-none tracking-[0.2em] text-white">
                  RECOVERED
                </span>
                <span className="font-mono text-[12.5px] uppercase leading-none tracking-[0.14em] text-white/55">
                  t+195s · ERV +₹7,557
                </span>
              </figcaption>
              <WaveCanvas intensity={2.2} accentColor="rgba(255, 255, 255, 0.9)" />
              <code className="block truncate rounded-chip bg-white/[0.05] px-3 py-2.5 font-mono text-[12.5px] text-white/60">
                $ dispatch --action delayed_retry --window 14m
              </code>
              <p className="t-micro leading-[1.5] text-white/45">
                The basin is decisive and the trajectory has crossed T. Autonomous dispatch fires,
                and PostgreSQL ledger recording carries on afterwards.
              </p>
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}

