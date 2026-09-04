"use client";

import React, { useState } from "react";

export default function ExecutionState() {
  const [activeTab, setActiveTab] = useState<"standard" | "ambiguous">("standard");

  return (
    <section className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 max-w-[1440px] mx-auto border-t border-border">
      <div className="flex items-center gap-2 mb-6">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-revly-cyan">
          08 · DETERMINISTIC EXECUTION
        </span>
      </div>

      <div className="max-w-[1000px] mb-16">
        <h2 className="t-h2 text-white mb-6">
          Idempotent execution with
          <br />
          <span className="text-white/60">ambiguous-outcome reconciliation.</span>
        </h2>
        <p className="t-body max-w-[760px] text-base sm:text-lg">
          In distributed financial systems, network calls can time out or return vague
          errors. Revly explicitly separates definitive failure from unknown status —
          preventing duplicate charges and accidental multiple retries.
        </p>
      </div>

      {/* Mode Switcher */}
      <div className="flex gap-2 mb-8">
        <button
          onClick={() => setActiveTab("standard")}
          className={`px-4 py-2 rounded font-mono text-xs transition-colors border ${
            activeTab === "standard"
              ? "bg-surface-raised border-revly-blue text-white"
              : "bg-surface border-white/10 text-white/50 hover:text-white"
          }`}
        >
          SCENARIO 1: DETERMINISTIC APPROVAL
        </button>
        <button
          onClick={() => setActiveTab("ambiguous")}
          className={`px-4 py-2 rounded font-mono text-xs transition-colors border ${
            activeTab === "ambiguous"
              ? "bg-surface-raised border-revly-cyan text-white"
              : "bg-surface border-white/10 text-white/50 hover:text-white"
          }`}
        >
          SCENARIO 2: AMBIGUOUS TIMEOUT RECONCILIATION
        </button>
      </div>

      {/* State Machine Display */}
      {activeTab === "standard" ? (
        <div className="rounded-lg bg-surface border border-border p-6 sm:p-10">
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/[0.08]">
            <span className="font-mono text-xs text-revly-emerald uppercase tracking-wider">
              RECOVERY ACTION #ACT-9021 // DISPATCH STATE
            </span>
            <span className="font-mono text-[11px] text-revly-emerald bg-revly-emerald/10 px-2 py-0.5 rounded border border-revly-emerald/30">
              POLICY: ALLOW
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs mb-8">
            <div className="p-4 rounded bg-surface-raised border border-white/[0.06]">
              <div className="text-white/40 uppercase mb-1">TARGET ACTION</div>
              <div className="text-white font-bold text-sm">SCHEDULED RETRY</div>
              <div className="text-[10px] text-white/40 mt-1">Window: +14m delay</div>
            </div>

            <div className="p-4 rounded bg-surface-raised border border-white/[0.06]">
              <div className="text-white/40 uppercase mb-1">ATTEMPT COUNTER</div>
              <div className="text-revly-cyan font-bold text-sm">0 / 2 ATTEMPTS</div>
              <div className="text-[10px] text-white/40 mt-1">Below merchant ceiling</div>
            </div>

            <div className="p-4 rounded bg-surface-raised border border-white/[0.06]">
              <div className="text-white/40 uppercase mb-1">IDEMPOTENCY KEY</div>
              <div className="text-white font-bold text-sm truncate">IDEMP-RV-99214</div>
              <div className="text-[10px] text-white/40 mt-1">DB Unique Lock Active</div>
            </div>

            <div className="p-4 rounded bg-surface-raised border border-white/[0.06]">
              <div className="text-white/40 uppercase mb-1">POLICY VERDICT</div>
              <div className="text-revly-emerald font-bold text-sm">ALLOW (ALL RULES PASSED)</div>
              <div className="text-[10px] text-white/40 mt-1">Zero safety violations</div>
            </div>
          </div>

          <div className="p-4 rounded bg-black/40 border border-white/[0.04] font-mono text-xs text-white/70">
            <span className="text-revly-emerald">&gt;</span> Action dispatched via Go HTTP client with{" "}
            <code className="text-revly-cyan">X-Razorpay-Idempotency: IDEMP-RV-99214</code>. If redelivered, gateway acknowledges existing transaction without duplicate charge.
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-surface border border-border p-6 sm:p-10">
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/[0.08]">
            <span className="font-mono text-xs text-revly-amber uppercase tracking-wider">
              INCIDENT #INC-5510 // NETWORK AMBIGUITY HANDLING
            </span>
            <span className="font-mono text-[11px] text-revly-amber bg-revly-amber/10 px-2 py-0.5 rounded border border-revly-amber/30">
              STATE: PENDING_CONFIRMATION
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono text-xs mb-8">
            <div className="p-4 rounded bg-surface-raised border border-white/[0.06]">
              <span className="text-white/40 uppercase block mb-1">01. DISPATCHED</span>
              <span className="text-white font-semibold block">Gateway Call Sent</span>
              <span className="text-[10px] text-white/40 block mt-1">t = 0.00s</span>
            </div>

            <div className="p-4 rounded bg-surface-raised border border-revly-rose/30">
              <span className="text-revly-rose uppercase block mb-1">02. HTTP 504 TIMEOUT</span>
              <span className="text-white font-semibold block">Outcome Unknown</span>
              <span className="text-[10px] text-revly-rose block mt-1">Do NOT retry blindly</span>
            </div>

            <div className="p-4 rounded bg-surface-raised border border-white/[0.06]">
              <span className="text-white/40 uppercase block mb-1">03. RECONCILER</span>
              <span className="text-white font-semibold block">Polls Payment Status</span>
              <span className="text-[10px] text-white/40 block mt-1">t = +30.00s delay</span>
            </div>

            <div className="p-4 rounded bg-surface-raised border border-revly-emerald/30">
              <span className="text-revly-emerald uppercase block mb-1">04. FINAL OUTCOME</span>
              <span className="text-white font-semibold block">Transaction Captured</span>
              <span className="text-[10px] text-revly-emerald block mt-1">Settled in PostgreSQL</span>
            </div>
          </div>

          <div className="p-4 rounded bg-black/40 border border-white/[0.04] font-mono text-xs text-white/70">
            <span className="text-revly-amber">&gt;</span> Invariant respected: A timeout after HTTP dispatch is never retried immediately. The reconciliation worker queries Razorpay status API before mutating ledger state.
          </div>
        </div>
      )}
    </section>
  );
}

