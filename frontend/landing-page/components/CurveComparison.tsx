"use client";

import React, { useEffect, useRef } from "react";

interface SurfaceProps {
  type: "spike" | "flat" | "decay" | "saddle" | "peak" | "ripple";
  accentColor?: string;
}

function SurfaceWireframe({ type, accentColor = "rgba(255, 255, 255, 0.7)" }: SurfaceProps) {
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

      ctx.clearRect(0, width, height, width);
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1.1;

      const rows = 14;
      const cols = 22;
      const xSpacing = width / (cols + 4);
      const ySpacing = height / (rows + 8);

      for (let r = 0; r < rows; r++) {
        ctx.beginPath();
        const yBase = height * 0.28 + r * ySpacing * 0.9;
        ctx.strokeStyle = accentColor;
        ctx.globalAlpha = 0.15 + (r / rows) * 0.65;

        for (let c = 0; c < cols; c++) {
          const x = width * 0.12 + c * xSpacing;
          const u = (c - cols / 2) / (cols / 2);
          const v = (r - rows / 2) / (rows / 2);

          let z = 0;
          if (type === "spike") {
            z = Math.exp(-(u * u * 18 + v * v * 18)) * 80;
          } else if (type === "flat") {
            z = Math.sin(c * 0.8 + frame * 0.02) * 3;
          } else if (type === "decay") {
            z = Math.exp(-c * 0.18) * 90 + Math.sin(frame * 0.04 + r) * 4;
          } else if (type === "saddle") {
            z = (u * u - v * v) * 35 + Math.sin(frame * 0.03) * 6;
          } else if (type === "peak") {
            z = Math.exp(-(u * u * 4 + v * v * 4)) * (55 + Math.sin(frame * 0.05) * 8);
          } else if (type === "ripple") {
            const dist = Math.sqrt(u * u + v * v);
            z = Math.sin(dist * 9 - frame * 0.06) * 22 * Math.exp(-dist * 1.5);
          }

          const y = yBase - z;
          if (c === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [type, accentColor]);

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-inner bg-black">
      <canvas ref={canvasRef} className="block size-full" />
    </div>
  );
}

export default function CurveComparison() {
  const cards: {
    title: string;
    rules: string;
    peak: string;
    type: SurfaceProps["type"];
    color: string;
  }[] = [
    {
      title: "Terminal Decline",
      rules: "0 retries",
      peak: "peak T0 · Card Expired / Stolen · synchronous abort",
      type: "spike",
      color: "#FF5555",
    },
    {
      title: "Gateway 504 Timeout",
      rules: "3 retries",
      peak: "peak T+45s · HDFC / SBI netbanking blip · w14",
      type: "peak",
      color: "#00D2FF",
    },
    {
      title: "Liquidity Exhaustion",
      rules: "Delayed",
      peak: "peak T+8h · Low balance · salary cycle window",
      type: "saddle",
      color: "#7C3AED",
    },
    {
      title: "Mandate De-sync",
      rules: "1 retry",
      peak: "peak T+2h · Pre-debit notification · NPCI token",
      type: "ripple",
      color: "#2563FF",
    },
    {
      title: "UPI App Drop",
      rules: "Instant",
      peak: "peak T+3m · WhatsApp smart pay link fallback",
      type: "decay",
      color: "#00D2FF",
    },
    {
      title: "Merchant Velocity Lock",
      rules: "2 retries",
      peak: "peak T+1h · Cooldown wait · Dynamic route swap",
      type: "flat",
      color: "rgba(255, 255, 255, 0.7)",
    },
  ];

  return (
    <section className="flex flex-col items-center px-gutter pb-[100px] lg:pb-[180px]">
      <div className="flex w-full max-w-[1200px] flex-col gap-[60px]">
        {/* Section Header */}
        <div className="flex flex-col gap-[30px] lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col items-start gap-5">
            <h2 className="t-h2 max-w-[16ch] text-white">
              Some failures never climb the curve.
            </h2>
          </div>
          <div>
            <p className="t-body max-w-[52ch] text-white/50">
              A terminal decline (lost card, invalid credentials) can finish before cumulative behaviour
              has moved the score at all. Those are caught synchronously, per webhook, alongside the
              continuous score. Each surface below is the same recovery probability field with only one
              failure mode&apos;s heuristics active.
            </p>
          </div>
        </div>

        {/* 6 Grid Figures */}
        <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c, idx) => (
            <figure key={idx} className="flex flex-col gap-4">
              <div className="overflow-hidden rounded-inner bg-black ring-1 ring-inset ring-white/[0.06]">
                <SurfaceWireframe type={c.type} accentColor={c.color} />
              </div>
              <figcaption className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-[12.5px] uppercase leading-none tracking-[0.14em] text-white/70">
                    {c.title}
                  </span>
                  <span className="font-mono text-[12.5px] uppercase leading-none tracking-[0.14em] text-white/55">
                    {c.rules}
                  </span>
                </div>
                <p className="font-mono text-[12.5px] leading-[1.5] text-white/45">
                  {c.peak}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
