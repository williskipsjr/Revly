"use client";

import React, { useState } from "react";

export default function AuditTimeline() {
  const [filter, setFilter] = useState<string>("ALL");

  const auditEvents = [
    {
      time: "09:41:02.104",
      type: "INGEST",
      label: "PAYMENT_FAILED_RECEIVED",
      details: "Raw webhook ingested from Razorpay. External Event ID: evt_rzp_99214k. Idempotency key derived.",
      hash: "0x4a9b...1f02",
      status: "PERSISTED",
    },
    {
      time: "09:41:02.320",
      type: "DIAGNOSIS",
      label: "CONTEXT_ATTACHED & DIAGNOSED",
      details: "Customer historical profile loaded (99.2% success). Rule table identified Transient Issuer Gateway 504 blip.",
      hash: "0x8e12...b47a",
      status: "ADVISORY",
    },
    {
      time: "09:41:02.485",
      type: "MODEL",
      label: "RECOVERABILITY_SCORED",
      details: "Logistic regression model scored candidate actions: Retry (89%), Link (74%), Remind (61%).",
      hash: "0x3c71...99e8",
      status: "COMPUTED",
    },
    {
      time: "09:41:02.510",
      type: "ECONOMICS",
      label: "ERV_OPTIMIZED",
      details: "Gross value ₹7,564.11 − Fee ₹1.50 − Friction ₹5.50 = Net ERV +₹7,557.11. Scheduled retry ranked #1.",
      hash: "0x77fa...aa10",
      status: "RANKED",
    },
    {
      time: "09:41:02.525",
      type: "POLICY",
      label: "POLICY_ALLOWED",
      details: "Go Policy Engine evaluated: max_retries (0/2 < 2), cooldown (elapsed 4h), risk_ceiling (passed). ALLOW.",
      hash: "0x00f1...e455",
      status: "APPROVED",
    },
    {
      time: "09:41:03.110",
      type: "EXECUTION",
      label: "ACTION_DISPATCHED",
      details: "Go Executor locked DB unique key IDEMP-RV-99214. Scheduled retry queued for optimal window (+14m).",
      hash: "0x66bb...77d3",
      status: "DISPATCHED",
    },
    {
      time: "09:55:04.220",
      type: "EXECUTION",
      label: "RETRY_TRIGGERED",
      details: "Automated retry executed against HDFC gateway with customer VPA. Awaiting auth confirmation.",
      hash: "0x11ee...99a4",
      status: "IN_FLIGHT",
    },
    {
      time: "09:55:31.040",
      type: "OUTCOME",
      label: "RECOVERY_CONFIRMED",
      details: "Razorpay payment.captured webhook captured. ₹8,499.00 credited. Ledger settled in PostgreSQL.",
      hash: "0x55aa...33b1",
      status: "SETTLED",
    },
  ];

  const filtered = filter === "ALL" ? auditEvents : auditEvents.filter((e) => e.type === filter);

  return (
    <section
      id="audit"
      className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 max-w-[1440px] mx-auto border-t border-border"
    >
      <div className="flex items-center gap-2 mb-6">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-revly-cyan">
          11 · IMMUTABLE AUDIT TRAIL
        </span>
      </div>

      <div className="max-w-[1000px] mb-12">
        <h2 className="t-h2 text-white mb-6">
          Every decision reconstructible
          <br />
          <span className="text-white/60">down to the millisecond.</span>
        </h2>
        <p className="t-body max-w-[760px] text-base sm:text-lg">
          Financial recovery requires institutional trust. Revly logs every webhook
          ingestion, diagnosis rationale, statistical probability score, ERV calculation,
          and policy gate decision into an append-only PostgreSQL ledger.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-8">
        {["ALL", "INGEST", "DIAGNOSIS", "MODEL", "ECONOMICS", "POLICY", "EXECUTION", "OUTCOME"].map(
          (t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3 py-1.5 rounded font-mono text-[11px] transition-colors border ${
                filter === t
                  ? "bg-surface-raised border-revly-blue text-white"
                  : "bg-surface border-white/[0.06] text-white/50 hover:text-white"
              }`}
            >
              {t}
            </button>
          )
        )}
      </div>

      {/* Audit Stream Console */}
      <div className="rounded-lg bg-[#080808] border border-border p-6 sm:p-8 font-mono text-xs">
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/[0.08] text-white/40 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-revly-cyan animate-pulse" />
            <span>INCIDENT AUDIT LOG: RECOVERY_EVENT_RV-8491</span>
          </div>
          <span>POSTGRESQL AUDIT TABLE: append_only = TRUE</span>
        </div>

        <div className="space-y-4">
          {filtered.map((item, idx) => (
            <div
              key={idx}
              className="p-4 rounded bg-white/[0.02] hover:bg-white/[0.04] transition-colors border border-white/[0.04] flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              <div className="flex items-start md:items-center gap-3">
                <span className="text-white/40 text-[11px] shrink-0">{item.time}</span>
                <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider bg-white/[0.06] text-revly-cyan border border-white/10 shrink-0">
                  {item.type}
                </span>
                <div className="flex flex-col">
                  <span className="text-white font-semibold">{item.label}</span>
                  <span className="text-white/50 text-[11.5px] font-sans mt-0.5">
                    {item.details}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/[0.04]">
                <span className="text-white/30 text-[10px]">{item.hash}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    item.status === "SETTLED"
                      ? "bg-revly-emerald/20 text-revly-emerald border border-revly-emerald/30"
                      : item.status === "APPROVED"
                      ? "bg-revly-cyan/20 text-revly-cyan border border-revly-cyan/30"
                      : "bg-white/[0.06] text-white/70"
                  }`}
                >
                  {item.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

