"use client";

import React, { useState } from "react";

export default function RecoveryPipeline() {
  const [activeStage, setActiveStage] = useState(0);

  const stages = [
    {
      step: "01",
      name: "DETECT",
      title: "Revenue Event Ingestion",
      plane: "GO DECISION PLANE",
      summary: "Ingests raw Razorpay webhooks (payment.failed, order.unpaid, mandate.rejected) and derives a strict idempotency key.",
      code: `// Event Ingestor: Enforces idempotency
func (s *Service) IngestEvent(ctx context.Context, payload WebhookPayload) (*PaymentEvent, error) {
    key := deriveIdempotencyKey(payload.ExternalID, payload.EventTimestamp)
    if exists := s.db.HasProcessedEvent(key); exists {
        return nil, ErrDuplicateEventSuppressed
    }
    return s.db.PersistEvent(ctx, payload)
}`,
      state: "EVENT_INGESTED",
      eventLog: "09:41:02.104 [INGEST] payment.failed | ext_id=pay_N9mO42k | amount=₹8,499.00",
    },
    {
      step: "02",
      name: "DIAGNOSE",
      title: "Root-Cause Context Enrichment",
      plane: "INTELLIGENCE PLANE (ADVISORY)",
      summary: "Attaches customer payment history, issuer error taxonomy, and merchant policy parameters. Advisory classifier only.",
      code: `{
  "event_id": "evt_992418a",
  "issuer_code": "504_GATEWAY_TIMEOUT",
  "customer_risk_score": 0.08,
  "prior_attempts_24h": 0,
  "root_cause_diagnosis": "TRANSIENT_ISSUER_INTERRUPTION",
  "confidence": 0.94
}`,
      state: "DIAGNOSED",
      eventLog: "09:41:02.320 [DIAGNOSE] root_cause=TRANSIENT_ISSUER_INTERRUPTION | conf=0.94",
    },
    {
      step: "03",
      name: "SCORE",
      title: "ML Success Estimation",
      plane: "STATISTICAL MODEL SERVICE",
      summary: "A separate logistic regression model estimates P(success | context, a) for every candidate intervention.",
      code: `# Interpretable statistical scoring service (Python)
def predict_recoverability(features: dict, action_type: str) -> float:
    # Action type, cooldown hours, amount tier, past success features
    x = feature_vector(features, action_type)
    p_success = model_registry[action_type].predict_proba(x)[1]
    return float(np.clip(p_success, 0.01, 0.99))`,
      state: "ACTIONS_SCORED",
      eventLog: "09:41:02.485 [SCORE] P(retry)=0.89 | P(link)=0.74 | P(remind)=0.61",
    },
    {
      step: "04",
      name: "RANK",
      title: "ERV Economic Optimization",
      plane: "GO DECISION PLANE",
      summary: "Ranks actions by Expected Recovery Value: ERV = P(success) × Amount − Operational Cost − Customer Friction.",
      code: `// ERV Math Optimizer
for _, action := range candidates {
    gross := pSuccess[action.Type] * payment.Amount
    netERV := gross - action.MonetaryCost - (action.FrictionWeight * merchant.FrictionScale)
    rankedActions.Insert(action.Type, netERV)
}
// Best candidate: Scheduled Retry (ERV = +₹7,557.11)`,
      state: "ERV_RANKED",
      eventLog: "09:41:02.510 [ERV] candidate=SCHEDULED_RETRY | gross=₹7,564.11 | erv=+₹7,557.11",
    },
    {
      step: "05",
      name: "GATE",
      title: "Deterministic Safety Rules",
      plane: "DETERMINISTIC POLICY ENGINE",
      summary: "Evaluates hard constraints: max retries ceiling, cooldown enforcement, daily contact caps, and global kill switches.",
      code: `// Pure function rules engine: Zero ML inside
func EvaluatePolicy(a CandidateAction, ctx Context, pol MerchantPolicy) PolicyResult {
    if ctx.RetriesIn24h >= pol.MaxRetries {
        return PolicyResult{Decision: BLOCK, Reason: "MAX_RETRIES_EXCEEDED"}
    }
    if ctx.TimeSinceLastAttempt < pol.CooldownMinutes {
        return PolicyResult{Decision: BLOCK, Reason: "COOLDOWN_ACTIVE"}
    }
    return PolicyResult{Decision: ALLOW}
}`,
      state: "POLICY_ALLOWED",
      eventLog: "09:41:02.525 [POLICY] rules_checked=5 | decision=ALLOW | idempotency_token=KEY_RV_091",
    },
    {
      step: "06",
      name: "EXECUTE",
      title: "Idempotent Action Dispatch",
      plane: "GO EXECUTION PLANE",
      summary: "Locks Postgres row constraint, verifies external idempotency key, and executes the bounded action safely.",
      code: `// Execution plane: strict at-least-once with DB unique locks
tx := db.Begin()
if err := tx.Exec("INSERT INTO action_locks (idempotency_key) VALUES (?)", key).Error; err != nil {
    return ErrConcurrentExecutionSuppressed
}
resp, err := gatewayClient.DispatchWithKey(ctx, action, key)`,
      state: "ACTION_DISPATCHED",
      eventLog: "09:41:03.110 [EXEC] dispatching action=SCHEDULED_RETRY | idempotency_locked=true",
    },
    {
      step: "07",
      name: "OBSERVE",
      title: "Ambiguous Outcome Reconciliation",
      plane: "RECONCILIATION WORKER",
      summary: "Distinguishes ACTION_FAILED from OUTCOME_UNKNOWN. If a gateway times out, polls status before deciding next steps.",
      code: `// Reconciliation loop handles network ambiguity
if response.IsTimeout() || response.IsAmbiguous() {
    action.State = "PENDING_CONFIRMATION"
    scheduler.ScheduleReconciliation(action.ID, 30*time.Second)
    // NEVER retry blindly on timeout
    return
}`,
      state: "OUTCOME_VERIFIED",
      eventLog: "09:41:31.040 [RECONCILE] gateway status polled | transition=CAPTURED",
    },
    {
      step: "08",
      name: "RECOVER",
      title: "Authoritative Ledger Settlement",
      plane: "POSTGRESQL AUDIT STORE",
      summary: "Permanently writes recovered revenue to ledger, updates merchant financial recovery metrics, and halts workflow.",
      code: `INSERT INTO recovery_ledger (
    payment_id, recovered_amount, fee_incurred, net_recovered, completed_at
) VALUES (
    'pay_N9mO42k', 8499.00, 1.50, 8497.50, NOW()
);
-- Status: RECOVERY_SUCCESSFUL. Recovery loop terminated.`,
      state: "DONE / SETTLED",
      eventLog: "09:41:31.112 [LEDGER] settled=₹8,499.00 | net=+₹8,497.50 | cycle_complete=true",
    },
  ];

  const current = stages[activeStage];

  return (
    <section
      id="pipeline"
      className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 max-w-[1440px] mx-auto border-t border-border"
    >
      <div className="flex items-center gap-2 mb-6">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-revly-cyan">
          03 · THE RECOVERY ENGINE
        </span>
      </div>

      <div className="max-w-[1000px] mb-12">
        <h2 className="t-h2 text-white mb-6">
          The 8-Stage Recovery Loop.
        </h2>
        <p className="t-body max-w-[760px] text-base sm:text-lg">
          Revly operates as a closed-loop system. Each stage transitions through
          explicit state boundaries: LLM proposes, statistics score, policy approves, Go
          executes, and PostgreSQL permanently audits.
        </p>
      </div>

      {/* Horizontal Pipeline Track */}
      <div className="relative mb-12 overflow-x-auto pb-4 scrollbar-thin">
        {/* Connecting line */}
        <div className="absolute top-[22px] left-8 right-8 h-[2px] bg-white/[0.08] -z-0 hidden md:block" />

        <div className="flex items-center justify-between min-w-[760px] gap-2 relative z-10">
          {stages.map((st, idx) => {
            const isActive = idx === activeStage;
            const isCompleted = idx < activeStage;
            return (
              <button
                key={st.step}
                onClick={() => setActiveStage(idx)}
                className="flex flex-col items-center group focus:outline-none flex-1"
              >
                <div
                  className={`size-11 rounded-full flex items-center justify-center font-mono text-xs font-semibold transition-all duration-300 border ${
                    isActive
                      ? "bg-revly-blue text-white border-revly-cyan shadow-[0_0_20px_rgba(37,99,255,0.6)] scale-110"
                      : isCompleted
                      ? "bg-surface-raised text-revly-cyan border-revly-blue/40"
                      : "bg-surface text-white/40 border-white/10 group-hover:border-white/30"
                  }`}
                >
                  {st.step}
                </div>
                <span
                  className={`font-mono text-[11px] tracking-wider uppercase mt-3 transition-colors duration-200 ${
                    isActive ? "text-white font-semibold" : "text-white/40 group-hover:text-white/70"
                  }`}
                >
                  {st.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stage Detail Workstation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Stage Explanation & State Invariant */}
        <div className="lg:col-span-5 rounded-lg bg-surface border border-border p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/[0.08]">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-revly-cyan">
                STAGE {current.step} OF 08
              </span>
              <span className="font-mono text-[10px] text-white/60 bg-white/[0.05] px-2 py-0.5 rounded border border-white/10">
                {current.plane}
              </span>
            </div>

            <h3 className="text-2xl font-semibold text-white mb-3">
              {current.title}
            </h3>

            <p className="text-sm text-white/70 leading-relaxed mb-6 font-sans">
              {current.summary}
            </p>
          </div>

          <div className="pt-4 border-t border-white/[0.08] space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-white/40">STATE TRANSITION:</span>
              <span className="text-revly-emerald font-semibold">{current.state}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/40">FINANCIAL AUTHORITY:</span>
              <span className="text-white/80">
                {activeStage === 1 ? "NONE (ADVISORY ONLY)" : "DETERMINISTIC GATE"}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Code & Event Trace */}
        <div className="lg:col-span-7 rounded-lg bg-[#080808] border border-border p-6 flex flex-col justify-between font-mono text-xs overflow-hidden">
          <div>
            {/* Terminal Header */}
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/[0.08] text-white/40 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
                <span>revly-core // {current.name.toLowerCase()}.go</span>
              </div>
              <span>IMMUTABLE TRACE</span>
            </div>

            {/* Code Block */}
            <pre className="text-white/80 overflow-x-auto text-[11.5px] leading-relaxed p-2 bg-black/40 rounded border border-white/[0.04]">
              <code>{current.code}</code>
            </pre>
          </div>

          {/* Micro-Event Bus Stream */}
          <div className="mt-4 pt-3 border-t border-white/[0.08] text-[11px] text-revly-cyan truncate">
            &gt; {current.eventLog}
          </div>
        </div>
      </div>
    </section>
  );
}

