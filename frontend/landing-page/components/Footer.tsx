"use client";

import React from "react";

export default function Footer() {
  return (
    <footer className="flex flex-col items-center px-gutter pb-[30px]">
      <div className="relative w-full max-w-[1920px] overflow-hidden rounded-card bg-plot px-gutter pb-[40px] pt-[120px] lg:pt-[180px] border border-white/[0.08]">
        {/* Background vertical architectural lines */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="mx-auto flex h-full max-w-[1445px] justify-between">
            <span className="w-px bg-white/[0.04]"></span>
            <span className="w-px bg-white/[0.04]"></span>
            <span className="w-px bg-white/[0.04]"></span>
            <span className="w-px bg-white/[0.04]"></span>
            <span className="w-px bg-white/[0.04]"></span>
          </div>
        </div>

        <div className="relative mx-auto flex w-full max-w-[1445px] flex-col gap-[100px]">
          {/* Top CTA Statement */}
          <div className="flex flex-col items-center gap-10 text-center">
            <h2 className="t-display !text-[clamp(2.75rem,1rem+7vw,6rem)] text-white">
              Watch the revenue recover.
            </h2>
            <a
              className="group relative inline-flex items-center gap-3 rounded-pill bg-lime py-2 pl-7 pr-2 text-ink transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 shadow-[0_0_60px_rgba(158,252,101,0.45)]"
              href="#watch"
            >
              <span className="t-ui font-semibold">Launch Recovery Walkthrough</span>
              <span className="grid size-[46px] place-items-center rounded-full bg-ink text-white transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:rotate-45">
                <svg viewBox="0 0 10 10" fill="none" aria-hidden="true" className="size-3.5">
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

          {/* 4 Column Footer Navigation */}
          <div className="grid grid-cols-1 gap-[60px] lg:grid-cols-[1.2fr_1fr_1fr_1.2fr]">
            {/* Col 1: Follow telemetry */}
            <div className="flex flex-col gap-5">
              <h3 className="t-h3 text-white">Follow the telemetry</h3>
              <p className="t-body max-w-[340px] text-muted-invert">
                Notes on checkout webhook ingestion, logistic regression score decay, and deterministic policy gates as each layer gets proven.
              </p>
              <form
                className="flex items-center gap-2 rounded-pill bg-white/[0.07] p-2 pl-6"
                onSubmit={(e) => e.preventDefault()}
              >
                <label htmlFor="newsletter-email" className="sr-only">
                  Email address
                </label>
                <input
                  id="newsletter-email"
                  type="email"
                  required
                  placeholder="merchant@domain.com"
                  className="t-body min-w-0 flex-1 bg-transparent text-white outline-none placeholder:text-white/45"
                />
                <button
                  type="submit"
                  aria-label="Subscribe"
                  className="grid size-[46px] shrink-0 place-items-center rounded-full bg-ink text-white transition-transform duration-300 hover:scale-105"
                >
                  <svg viewBox="0 0 10 10" fill="none" aria-hidden="true" className="size-3.5 rotate-45">
                    <path
                      d="M1.5 8.5 8.5 1.5M8.5 1.5H3.2M8.5 1.5v5.3"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </form>
            </div>

            {/* Col 2: Pages */}
            <div className="flex flex-col gap-5">
              <span className="t-ui font-medium text-white">Navigation</span>
              <ul className="flex flex-col gap-4">
                <li>
                  <a className="t-h3 !text-[20px] transition-colors duration-300 text-lime" href="#">
                    Overview
                  </a>
                </li>
                <li>
                  <a className="t-h3 !text-[20px] transition-colors duration-300 text-white hover:text-muted-invert" href="#surface">
                    Recovery Surface
                  </a>
                </li>
                <li>
                  <a className="t-h3 !text-[20px] transition-colors duration-300 text-white hover:text-muted-invert" href="#watch">
                    Live Session Replay
                  </a>
                </li>
                <li>
                  <a className="t-h3 !text-[20px] transition-colors duration-300 text-white hover:text-muted-invert" href="#invariants">
                    Safety Invariants
                  </a>
                </li>
              </ul>
            </div>

            {/* Col 3: Layers */}
            <div className="flex flex-col gap-5">
              <span className="t-ui font-medium text-white">System Layers</span>
              <ul className="flex flex-col gap-4">
                <li>
                  <a className="t-h3 !text-[20px] transition-colors duration-300 text-white hover:text-muted-invert" href="#architecture">
                    L1 · Webhook Ingestion
                  </a>
                </li>
                <li>
                  <a className="t-h3 !text-[20px] transition-colors duration-300 text-white hover:text-muted-invert" href="#architecture">
                    L2 · Statistical Model
                  </a>
                </li>
                <li>
                  <a className="t-h3 !text-[20px] transition-colors duration-300 text-white hover:text-muted-invert" href="#architecture">
                    L3 · LLM Strategy Proposer
                  </a>
                </li>
                <li>
                  <a className="t-h3 !text-[20px] transition-colors duration-300 text-white hover:text-muted-invert" href="#architecture">
                    L4 · Deterministic Policy
                  </a>
                </li>
                <li>
                  <a className="t-h3 !text-[20px] transition-colors duration-300 text-white hover:text-muted-invert" href="#architecture">
                    L5 · Hot-Swap Executor
                  </a>
                </li>
              </ul>
            </div>

            {/* Col 4: Get in Touch & Deployment */}
            <div className="flex flex-col gap-5">
              <span className="t-ui font-medium text-white">Buildathon Track 03</span>
              <ul className="flex flex-col gap-4">
                <li>
                  <a href="mailto:team@revly.dev" className="t-h3 !text-[20px] text-white transition-colors duration-300 hover:text-muted-invert">
                    team@revly.dev
                  </a>
                </li>
                <li>
                  <a href="https://github.com" target="_blank" rel="noreferrer" className="t-h3 !text-[20px] text-white transition-colors duration-300 hover:text-muted-invert">
                    github.com/revly-ai
                  </a>
                </li>
              </ul>
              <div className="flex flex-col gap-1 pt-2">
                <span className="t-ui font-medium text-white">Deployment Boundary</span>
                <p className="t-body max-w-[280px] text-muted-invert">
                  Self-hosted edge runner adjacent to merchant checkout. Every failed webhook terminates in an idempotency lock before any financial actuator moves.
                </p>
              </div>
            </div>
          </div>

          {/* Giant Wordmark */}
          <div className="flex flex-col items-center gap-[4%] text-white sm:flex-row sm:justify-center">
            <img
              src="/revly-icon-white@4x.png"
              alt="Revly Icon"
              className="w-[11%] max-w-[170px] min-w-[64px] h-auto object-contain shrink-0 select-none"
            />
            <span
              className="t-display font-semibold leading-none tracking-[-0.04em] text-white select-none"
              style={{ fontSize: "clamp(3.5rem, 14vw, 15rem)" }}
            >
              Revly
            </span>
          </div>

          {/* Bottom Credits and Tech Badges */}
          <div className="flex flex-col gap-8 border-t border-white/10 pt-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <span className="t-body text-white">© 2026 Revly · Autonomous Revenue Recovery</span>
              <div className="flex flex-col gap-4 sm:flex-row sm:gap-12">
                <div className="flex flex-col gap-1.5">
                  <span className="font-mono text-[11.5px] uppercase tracking-[0.16em] text-white/35">
                    Engineered for
                  </span>
                  <span className="t-ui text-white">Razorpay AI Buildathon · Track 03</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="font-mono text-[11.5px] uppercase tracking-[0.16em] text-white/35">
                    Execution Stack
                  </span>
                  <span className="t-ui text-white">FastAPI · Go Executor · PostgreSQL · Gemini 2.5</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <span className="t-micro rounded-[10px] bg-white px-5 py-3 font-medium text-ink">
                Razorpay API
              </span>
              <span className="t-micro rounded-[10px] bg-white px-5 py-3 font-medium text-ink">
                Deterministic Policy Gate
              </span>
              <span className="t-micro rounded-[10px] bg-white px-5 py-3 font-medium text-ink">
                Redis Streams
              </span>
              <span className="t-micro rounded-[10px] bg-white px-5 py-3 font-medium text-ink">
                PostgreSQL Event Store
              </span>
              <span className="t-micro rounded-[10px] bg-white px-5 py-3 font-medium text-ink">
                Expected Recovery Value (ERV)
              </span>
            </div>

            <p className="t-micro max-w-[1100px] leading-[1.6] text-white/45">
              Revly is an autonomous revenue recovery demonstration system engineered for the Razorpay AI Buildathon Track 03. The architecture described on this page enforces strict isolation: LLMs propose recovery candidate strategies, ML models compute Expected Recovery Value (ERV), but deterministic policy rules and signed idempotency keys retain absolute veto authority. Figures describe properties of the simulated evaluation test bench (64.8% simulated recovery rate, 0 unauthorized money moves) rather than a commercial benchmark. Razorpay is a registered trademark of Razorpay Software Private Limited.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
