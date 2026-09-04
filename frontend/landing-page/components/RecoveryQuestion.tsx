"use client";

import React, { useState } from "react";

export default function RecoveryQuestion() {
  const [activeAction, setActiveAction] = useState(0);

  const candidateActions = [
    {
      id: "smart_retry",
      name: "Smart Delayed Retry",
      label: "RETRY",
      type: "AUTOMATED",
      pSuccess: "89%",
      cost: "₹1.50",
      friction: "LOW (0.1)",
      bestFit: "Transient gateway 5xx timeouts or temporary issuer network blips.",
      policy: "Requires cooldown ≥30m. Maximum 2 attempts per 24h period.",
      code: "ACTION_SCHEDULED_RETRY",
    },
    {
      id: "payment_link",
      name: "Dynamic Payment Link",
      label: "PAYMENT LINK",
      type: "INTERACTIVE",
      pSuccess: "74%",
      cost: "₹0.80",
      friction: "MEDIUM (0.4)",
      bestFit: "Authentication drop-offs, expired 3DS sessions, or mobile checkout friction.",
      policy: "Single dispatch per incident. Token valid for 24 hours.",
      code: "ACTION_DISPATCH_PAYMENT_LINK",
    },
    {
      id: "soft_reminder",
      name: "Customer Soft Reminder",
      label: "REMIND",
      type: "MESSAGING",
      pSuccess: "61%",
      cost: "₹0.20",
      friction: "LOW (0.2)",
      bestFit: "Cart abandonment or invoices approaching due date with high loyalty score.",
      policy: "Customer daily action cap ≤1 message per 24 hours.",
      code: "ACTION_SEND_REMINDER",
    },
    {
      id: "method_switch",
      name: "Alternative Method Switch",
      label: "METHOD SWITCH",
      type: "ROUTING",
      pSuccess: "68%",
      cost: "₹1.20",
      friction: "MEDIUM (0.5)",
      bestFit: "Card expired or recurring mandate failure with active UPI fallback.",
      policy: "Auto-detects active customer VPA before requesting method update.",
      code: "ACTION_REQUEST_METHOD_UPDATE",
    },
    {
      id: "escalate_ops",
      name: "Operator Escalation",
      label: "ESCALATE",
      type: "HUMAN-IN-THE-LOOP",
      pSuccess: "82%",
      cost: "₹45.00",
      friction: "MINIMAL (0.05)",
      bestFit: "High-value B2B receivables (>₹50,000) with strategic enterprise accounts.",
      policy: "Mandatory for amounts exceeding merchant risk ceiling.",
      code: "ACTION_ESCALATE_HUMAN_REVIEW",
    },
    {
      id: "stop_rule",
      name: "Autonomous Stop",
      label: "STOP",
      type: "SAFETY TERMINATION",
      pSuccess: "0%",
      cost: "₹0.00",
      friction: "ZERO (0.0)",
      bestFit: "Chronic failure, fraud flag, or negative expected recovery value (ERV ≤ 0).",
      policy: "Immutable stop rule: preserves merchant reputation and customer trust.",
      code: "ACTION_TERMINATE_RECOVERY",
    },
  ];

  const current = candidateActions[activeAction];

  return (
    <section
      id="candidates"
      className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 max-w-[1440px] mx-auto border-t border-border"
    >
      <div className="flex items-center gap-2 mb-6">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-revly-cyan">
          02 · THE INTERVENTION SPACE
        </span>
      </div>

      <div className="max-w-[900px] mb-16">
        <h2 className="t-h2 text-white mb-6">
          So what should happen next?
        </h2>
        <p className="t-body max-w-[760px] text-base sm:text-lg">
          Blindly retrying everything is not intelligence. Every intervention incurs an
          operational gateway cost, risks customer irritation, and operates under strict
          safety boundaries. Revly balances this space deterministically.
        </p>
      </div>

      {/* Candidate Action Buttons Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {candidateActions.map((action, idx) => {
          const isActive = idx === activeAction;
          return (
            <button
              key={action.id}
              onClick={() => setActiveAction(idx)}
              className={`flex flex-col items-start p-4 rounded text-left transition-all duration-200 border ${
                isActive
                  ? "bg-surface-raised border-revly-blue text-white shadow-[0_0_20px_rgba(37,99,255,0.15)]"
                  : "bg-surface border-white/[0.06] text-white/60 hover:text-white hover:border-white/20"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <span className="font-mono text-[10px] text-white/40">0{idx + 1}</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isActive ? "bg-revly-cyan" : "bg-white/20"
                  }`}
                />
              </div>
              <span className="font-mono text-[12px] font-semibold tracking-wider uppercase">
                {action.label}
              </span>
              <span className="text-[11px] text-white/40 mt-1 truncate w-full">
                {action.type}
              </span>
            </button>
          );
        })}
      </div>

      {/* Detailed Action Profile Panel */}
      <div className="rounded-lg bg-surface border border-border p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/[0.08]">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-revly-cyan bg-revly-cyan/10 px-2 py-0.5 rounded border border-revly-cyan/20">
                {current.code}
              </span>
              <h3 className="text-xl sm:text-2xl font-semibold text-white">
                {current.name}
              </h3>
            </div>
            <p className="text-sm text-white/60 mt-2 max-w-[650px]">
              {current.bestFit}
            </p>
          </div>

          {/* Action Metrics Ticker */}
          <div className="grid grid-cols-3 gap-4 font-mono text-center">
            <div className="p-3 rounded bg-surface-raised border border-white/[0.06]">
              <div className="text-[10px] text-white/40 uppercase">P(SUCCESS)</div>
              <div className="text-lg font-bold text-revly-cyan mt-0.5">
                {current.pSuccess}
              </div>
            </div>
            <div className="p-3 rounded bg-surface-raised border border-white/[0.06]">
              <div className="text-[10px] text-white/40 uppercase">ACTION COST</div>
              <div className="text-lg font-bold text-white mt-0.5">
                {current.cost}
              </div>
            </div>
            <div className="p-3 rounded bg-surface-raised border border-white/[0.06]">
              <div className="text-[10px] text-white/40 uppercase">FRICTION</div>
              <div className="text-lg font-bold text-white/80 mt-0.5">
                {current.friction}
              </div>
            </div>
          </div>
        </div>

        {/* Policy & Safety Engine Constraints */}
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center gap-2 text-white/70">
            <span className="w-1.5 h-1.5 rounded-full bg-revly-emerald" />
            <span className="text-white/40 uppercase">DETERMINISTIC RULE:</span>
            <span className="text-white/90">{current.policy}</span>
          </div>
          <span className="text-white/40 text-[11px]">
            EVALUATED BY GO DECISION PLANE
          </span>
        </div>
      </div>
    </section>
  );
}

