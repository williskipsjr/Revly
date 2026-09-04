"use client";

import React from "react";

export default function ArchitectureBoundary() {
  return (
    <section
      id="boundary"
      className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 max-w-[1440px] mx-auto border-t border-border"
    >
      <div className="flex items-center gap-2 mb-6">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-revly-cyan">
          07 · ARCHITECTURAL INVARIANT
        </span>
      </div>

      <div className="max-w-[1000px] mb-16">
        <h2 className="t-h2 text-white mb-6">
          AI proposes.
          <br />
          <span className="text-white/60">The platform decides.</span>
        </h2>
        <p className="t-body max-w-[760px] text-base sm:text-lg">
          Revly is deliberately not an unrestricted autonomous agent. Financial
          infrastructure requires formal determinism, mathematical auditability, and
          strict isolation. The LLM is an advisor — never a cashier.
        </p>
      </div>

      {/* The Governing Invariant Callout */}
      <div className="p-6 rounded-lg bg-surface border border-revly-blue/30 mb-12 shadow-[0_0_30px_rgba(37,99,255,0.06)]">
        <div className="font-mono text-[10px] text-white/40 uppercase tracking-widest mb-3">
          PLATFORM INVARIANT RULE // STRICT EXECUTION FLOW
        </div>
        <div className="font-mono text-xs sm:text-sm md:text-base text-white font-medium flex flex-wrap items-center gap-2 sm:gap-3 leading-relaxed">
          <span className="px-2.5 py-1 rounded bg-white/[0.06] text-revly-cyan">
            LLM proposes
          </span>
          <span className="text-white/30">→</span>
          <span className="px-2.5 py-1 rounded bg-white/[0.06] text-revly-blue">
            ML scores
          </span>
          <span className="text-white/30">→</span>
          <span className="px-2.5 py-1 rounded bg-white/[0.06] text-revly-lavender">
            ERV ranks
          </span>
          <span className="text-white/30">→</span>
          <span className="px-2.5 py-1 rounded bg-white/[0.06] text-revly-emerald">
            Deterministic Policy approves
          </span>
          <span className="text-white/30">→</span>
          <span className="px-2.5 py-1 rounded bg-white/[0.06] text-white">
            Go executor acts
          </span>
          <span className="text-white/30">→</span>
          <span className="px-2.5 py-1 rounded bg-white/[0.06] text-white/80">
            PostgreSQL records
          </span>
        </div>
      </div>

      {/* The Three Planes Architecture Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        {/* Plane 1: Intelligence Plane */}
        <div className="rounded-lg bg-surface border border-white/10 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/[0.08]">
              <span className="font-mono text-xs text-revly-cyan uppercase tracking-wider">
                PLANE 01 // INTELLIGENCE
              </span>
              <span className="font-mono text-[10px] text-white/50 bg-black/40 px-2 py-0.5 rounded">
                PYTHON
              </span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Advisory Diagnosis & ML
            </h3>
            <p className="text-xs text-white/60 leading-relaxed mb-4">
              Context enrichment, failure reason classification, and logistic
              regression P(success) scoring.
            </p>
          </div>

          <div className="pt-4 border-t border-white/[0.08] font-mono text-[11px] space-y-2 text-white/50">
            <div>• Isolated container environment</div>
            <div>• Zero access to payment credentials</div>
            <div>• Schema-validated JSON outputs</div>
            <div className="text-revly-rose">• Failure mode: suggestion ignored</div>
          </div>
        </div>

        {/* Plane 2: Decision Plane */}
        <div className="rounded-lg bg-surface border border-white/10 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/[0.08]">
              <span className="font-mono text-xs text-revly-blue uppercase tracking-wider">
                PLANE 02 // DECISION
              </span>
              <span className="font-mono text-[10px] text-white/50 bg-black/40 px-2 py-0.5 rounded">
                GO RUNTIME
              </span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Economics & Safety Policy
            </h3>
            <p className="text-xs text-white/60 leading-relaxed mb-4">
              Pure-function rules engine. Calculates ERV, checks cooldowns,
              enforces retry ceilings, and halts on fraud.
            </p>
          </div>

          <div className="pt-4 border-t border-white/[0.08] font-mono text-[11px] space-y-2 text-white/50">
            <div>• Zero ML or LLM weights inside</div>
            <div>• Pure deterministic execution</div>
            <div>• Strict merchant ceiling overrides</div>
            <div className="text-revly-cyan">• ALLOW | BLOCK | HUMAN_REVIEW</div>
          </div>
        </div>

        {/* Plane 3: Execution Plane */}
        <div className="rounded-lg bg-surface border border-white/10 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/[0.08]">
              <span className="font-mono text-xs text-revly-emerald uppercase tracking-wider">
                PLANE 03 // EXECUTION
              </span>
              <span className="font-mono text-[10px] text-white/50 bg-black/40 px-2 py-0.5 rounded">
                GO + POSTGRES
              </span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Idempotent Dispatch & Ledger
            </h3>
            <p className="text-xs text-white/60 leading-relaxed mb-4">
              Enforces database unique locks before dispatching gateway calls.
              Captures webhook outcomes and settles ledger.
            </p>
          </div>

          <div className="pt-4 border-t border-white/[0.08] font-mono text-[11px] space-y-2 text-white/50">
            <div>• Postgres unique constraints</div>
            <div>• Gateway idempotency tokens</div>
            <div>• Ambiguous timeout reconciliation</div>
            <div className="text-revly-emerald">• Immutable audit append log</div>
          </div>
        </div>
      </div>

      {/* Strict Boundary Table: Can vs Cannot */}
      <div className="rounded-lg bg-surface border border-border p-6 sm:p-8">
        <div className="font-mono text-xs text-white/40 uppercase tracking-widest mb-6">
          BOUNDED AUTONOMY SPECIFICATION // PERMISSIONS MATRIX
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-mono text-xs">
          {/* What AI CAN do */}
          <div className="space-y-3">
            <div className="text-revly-cyan font-semibold pb-2 border-b border-white/[0.08] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-revly-cyan" />
              THE INTELLIGENCE LAYER CAN:
            </div>
            <div className="text-white/70 flex items-start gap-2">
              <span className="text-revly-cyan">✓</span>
              <span>Interpret raw webhook payloads and issuer response codes</span>
            </div>
            <div className="text-white/70 flex items-start gap-2">
              <span className="text-revly-cyan">✓</span>
              <span>Synthesize customer history into root-cause rationales</span>
            </div>
            <div className="text-white/70 flex items-start gap-2">
              <span className="text-revly-cyan">✓</span>
              <span>Propose candidate actions for economic ranking</span>
            </div>
            <div className="text-white/70 flex items-start gap-2">
              <span className="text-revly-cyan">✓</span>
              <span>Generate structured, schema-validated JSON explanations</span>
            </div>
          </div>

          {/* What AI CANNOT do */}
          <div className="space-y-3">
            <div className="text-revly-rose font-semibold pb-2 border-b border-white/[0.08] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-revly-rose" />
              THE INTELLIGENCE LAYER CAN NEVER:
            </div>
            <div className="text-white/70 flex items-start gap-2">
              <span className="text-revly-rose">✗</span>
              <span>Execute or authorize financial transactions directly</span>
            </div>
            <div className="text-white/70 flex items-start gap-2">
              <span className="text-revly-rose">✗</span>
              <span>Override merchant retry limits or safety cooldowns</span>
            </div>
            <div className="text-white/70 flex items-start gap-2">
              <span className="text-revly-rose">✗</span>
              <span>Bypass the deterministic Go Policy / Safety Engine</span>
            </div>
            <div className="text-white/70 flex items-start gap-2">
              <span className="text-revly-rose">✗</span>
              <span>Directly modify financial records or ledger balances</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

