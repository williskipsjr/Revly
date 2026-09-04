"use client";

import React from "react";

export default function ShapeOfSystem() {
  return (
    <section className="flex flex-col items-center pb-[100px] lg:pb-[180px]">
      <div className="flex w-full max-w-[1200px] flex-col items-center gap-[50px] px-gutter">
        <h2 className="t-h3 text-ink">
          The shape of the system
        </h2>

        <div className="grid w-full grid-cols-1 gap-12 sm:grid-cols-3">
          {/* Stat 1: 100% */}
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="t-display !text-[clamp(3rem,2rem+3.5vw,4.75rem)] text-ink">
              <span className="tabular-nums">
                100<span className="text-lime">%</span>
              </span>
            </span>
            <p className="t-body text-muted max-w-[28ch]">
              Of failed payment events sandboxed and scored before any action is authorized
            </p>
          </div>

          {/* Stat 2: 64.8% */}
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="t-display !text-[clamp(3rem,2rem+3.5vw,4.75rem)] text-ink">
              <span className="tabular-nums">
                64.8<span className="text-lime">%</span>
              </span>
            </span>
            <p className="t-body text-muted max-w-[28ch]">
              Recovery rate across held-out evaluation population (vs. 31.2% for naive retries)
            </p>
          </div>

          {/* Stat 3: 0 */}
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="t-display !text-[clamp(3rem,2rem+3.5vw,4.75rem)] text-ink">
              <span className="tabular-nums">0</span>
            </span>
            <p className="t-body text-muted max-w-[28ch]">
              Direct money movement calls granted to LLM. Advisory only, never an actuator.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

