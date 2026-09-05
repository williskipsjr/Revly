import React, { useState } from 'react';
import {
  ArrowLeft,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  HelpCircle,
  Copy,
  ExternalLink,
  ChevronRight,
  User,
  CreditCard,
  Building2,
  Calendar,
  Check
} from 'lucide-react';
import { Decision, CandidateActionType, AuditEvent as AuditEventType } from '../types/domain';
import { formatPaise, formatPercentage } from '../lib/money';
import { DecisionStatus } from '../components/DecisionStatus';
import { DiagnosisCard } from '../components/DiagnosisCard';
import { CandidateAction } from '../components/CandidateAction';
import { ErvBreakdown } from '../components/ErvBreakdown';
import { PolicyCheckList } from '../components/PolicyCheckList';
import { RecoveryTimeline } from '../components/RecoveryTimeline';
import { AuditEvent } from '../components/AuditEvent';
import { OverrideDialog } from '../components/OverrideDialog';

interface DecisionInvestigationViewProps {
  decision: Decision;
  auditTrail: AuditEventType[];
  onBack: () => void;
  onOverride: (action: CandidateActionType, reason: string) => Promise<void>;
  onSelectPaymentDecision?: (decisionId: string) => void;
}

export const DecisionInvestigationView: React.FC<DecisionInvestigationViewProps> = ({
  decision,
  auditTrail,
  onBack,
  onOverride,
  onSelectPaymentDecision
}) => {
  const [isOverrideOpen, setIsOverrideOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const selectedCandidate =
    decision.candidate_actions.find(a => a.is_winner || a.action_type === decision.chosen_action) ||
    decision.candidate_actions[0];

  const handleCopyId = () => {
    navigator.clipboard?.writeText(decision.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="cursor-pointer flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors px-3 py-1.5 rounded-lg bg-[#151722] border border-[#222533] hover:border-zinc-700 shadow-2xs"
        >
          <ArrowLeft size={15} />
          <span>Back to Recovery Feed</span>
        </button>

        <div className="flex items-center gap-2.5">
          <DecisionStatus type="state" value={decision.recovery_state} size="md" />
          <button
            onClick={() => setIsOverrideOpen(true)}
            className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#222533] bg-[#151722] hover:bg-[#1a1d2b] hover:border-zinc-700 text-xs font-medium text-zinc-200 transition-all shadow-2xs"
          >
            <Edit3 size={13} className="text-amber-400" />
            <span>Manual Override</span>
          </button>
        </div>
      </div>

      {/* Hero Header Card */}
      <div className="bg-[#151722] border border-[#222533] rounded-2xl p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-mono text-zinc-400 tracking-wider">
                Decision Investigation
              </span>
              <span className="text-zinc-600">·</span>
              <button
                onClick={handleCopyId}
                className="cursor-pointer flex items-center gap-1.5 font-mono text-xs font-semibold text-zinc-300 hover:text-white transition-colors px-2 py-0.5 rounded-md bg-[#10121a] border border-[#222533]"
              >
                <span>{decision.id}</span>
                {copiedId ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              </button>
            </div>

            <div className="flex items-baseline gap-3">
              <h1 className="text-3xl sm:text-4xl font-bold font-mono text-[#fafafa] tabular-nums tracking-tight">
                {formatPaise(decision.payment.amount)}
              </h1>
              <span className="text-xs text-zinc-400 font-medium">
                ({decision.payment.currency})
              </span>
            </div>

            <p className="text-sm text-zinc-300 font-medium">
              Failure Code: <span className="text-amber-300 font-mono">{decision.payment.failure_code}</span> — {decision.payment.failure_reason}
            </p>
          </div>

          {/* Decision Summary Stat Blocks */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[#10121a] border border-[#222533] p-4 rounded-xl text-xs font-mono">
            <div>
              <span className="text-[11px] text-zinc-400 block font-sans uppercase font-medium">Chosen Action</span>
              <span className="text-sm font-bold text-zinc-100 uppercase block mt-1">
                {decision.chosen_action.replace('_', ' ')}
              </span>
              <span className="text-[10px] text-zinc-400 font-sans mt-0.5 block">Ranked #1 by ERV</span>
            </div>

            <div>
              <span className="text-[11px] text-zinc-400 block font-sans uppercase font-medium">Expected ERV</span>
              <span className="text-sm font-bold text-emerald-400 block mt-1">
                {formatPaise(decision.erv_at_decision)}
              </span>
              <span className="text-[10px] text-zinc-400 font-sans mt-0.5 block">Net of cost &amp; friction</span>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <span className="text-[11px] text-zinc-400 block font-sans uppercase font-medium">Policy Result</span>
              <div className="mt-1.5">
                <DecisionStatus type="policy" value={decision.policy_result} size="sm" />
              </div>
              <span className="text-[10px] text-zinc-400 font-sans block mt-1">Deterministic Pass</span>
            </div>
          </div>
        </div>

        {/* Override notification banner if overridden */}
        {decision.override_reason && (
          <div className="mt-5 p-3.5 rounded-xl bg-amber-950/20 border border-amber-600/40 text-xs text-amber-200 flex items-start gap-3">
            <Edit3 size={15} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-100">
                Manually Overridden by {decision.overridden_by || 'Operator'}:
              </span>{' '}
              "{decision.override_reason}" at{' '}
              {decision.overridden_at && new Date(decision.overridden_at).toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {/* 2-Column Core Layout: Left = Context & Diagnosis & Actions, Right = ERV & Policy & Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Payment Context, Diagnosis, Candidate Actions */}
        <div className="lg:col-span-7 space-y-6">
          {/* Payment Context Card */}
          <div className="bg-[#151722] border border-[#222533] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="border-b border-[#222533] pb-4 flex items-center justify-between">
              <div>
                <span className="text-xs uppercase font-medium tracking-wider text-zinc-400">
                  Transaction Facts
                </span>
                <h3 className="text-base font-semibold text-[#fafafa] mt-0.5">Payment Context</h3>
              </div>
              <span className="text-xs font-mono text-zinc-400 px-2 py-0.5 rounded-md bg-[#10121a] border border-[#222533]">{decision.payment_id}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-[#10121a] border border-[#222533] p-3.5 rounded-xl">
                <span className="text-zinc-400 block text-[11px] mb-1 font-medium">Customer</span>
                <span className="font-semibold text-zinc-200 block">{decision.payment.customer.name}</span>
                <span className="text-[11px] text-zinc-400 font-mono truncate block mt-0.5">{decision.payment.customer.email}</span>
              </div>

              <div className="bg-[#10121a] border border-[#222533] p-3.5 rounded-xl">
                <span className="text-zinc-400 block text-[11px] mb-1 font-medium">Customer Track Record</span>
                <span className="font-mono font-bold text-emerald-400 block">
                  {formatPercentage(decision.payment.customer.historical_success_rate)}
                </span>
                <span className="text-[11px] text-zinc-400 font-mono mt-0.5 block">
                  {decision.payment.customer.total_transactions} historical txns
                </span>
              </div>

              <div className="bg-[#10121a] border border-[#222533] p-3.5 rounded-xl">
                <span className="text-zinc-400 block text-[11px] mb-1 font-medium">Payment Method</span>
                <span className="font-semibold text-zinc-200 uppercase font-mono block">
                  {decision.payment.method}
                </span>
                <span className="text-[11px] text-zinc-400 truncate block mt-0.5">
                  {decision.payment.method_details || 'Standard'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between text-[11px] text-zinc-400 pt-2 border-t border-[#222533]">
              <span>
                Attempt: <strong className="text-zinc-200">{decision.payment.attempt_count} of 3</strong>
              </span>
              <span>
                Occurred: <strong className="text-zinc-300 font-mono">{new Date(decision.payment.occurred_at).toLocaleString()}</strong>
              </span>
            </div>
          </div>

          {/* Diagnosis Card */}
          <DiagnosisCard diagnosis={decision.diagnosis} />

          {/* Candidate Actions Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs uppercase font-medium tracking-wider text-zinc-400">
                  Bounded Action Space
                </span>
                <h3 className="text-base font-semibold text-[#fafafa] mt-0.5">
                  Candidate Recovery Actions
                </h3>
              </div>
              <span className="text-xs text-zinc-400">
                Evaluated by P(success) &amp; ERV
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {decision.candidate_actions.map(action => (
                <CandidateAction
                  key={action.action_type}
                  action={action}
                  isSelected={action.action_type === decision.chosen_action}
                />
              ))}
            </div>
          </div>

          {/* Execution & Outcome Card */}
          {decision.execution && (
            <div className="bg-[#151722] border border-[#222533] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-[#222533] pb-4">
                <div>
                  <span className="text-xs uppercase font-medium tracking-wider text-zinc-400">
                    Execution &amp; Reconciliation
                  </span>
                  <h3 className="text-base font-semibold text-[#fafafa] mt-0.5">
                    Idempotent Action Execution
                  </h3>
                </div>
                <DecisionStatus type="action_status" value={decision.execution.status} size="sm" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
                <div className="bg-[#10121a] border border-[#222533] p-3 rounded-xl">
                  <span className="text-[11px] text-zinc-400 block font-sans font-medium">Idempotency Key</span>
                  <span className="text-zinc-200 text-[11px] truncate block mt-1">
                    {decision.execution.idempotency_key}
                  </span>
                </div>

                <div className="bg-[#10121a] border border-[#222533] p-3 rounded-xl">
                  <span className="text-[11px] text-zinc-400 block font-sans font-medium">External Reference</span>
                  <span className="text-zinc-300 text-[11px] truncate block mt-1">
                    {decision.execution.external_reference || 'N/A'}
                  </span>
                </div>

                <div className="bg-[#10121a] border border-[#222533] p-3 rounded-xl">
                  <span className="text-[11px] text-zinc-400 block font-sans font-medium">Dispatch Time</span>
                  <span className="text-zinc-300 text-[11px] block mt-1">
                    {new Date(decision.execution.executed_at).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              {/* Outcome status notice */}
              {decision.outcome && (
                <div
                  className={`p-4 rounded-xl border text-xs leading-relaxed ${
                    decision.outcome.result === 'RECOVERED'
                      ? 'bg-emerald-950/20 border-emerald-700/40 text-emerald-200'
                      : decision.outcome.result === 'PENDING_CONFIRMATION'
                      ? 'bg-amber-950/20 border-amber-600/40 text-amber-200'
                      : 'bg-[#10121a] border-[#222533] text-zinc-300'
                  }`}
                >
                  <div className="font-semibold mb-1 flex items-center gap-2">
                    {decision.outcome.result === 'RECOVERED' && <CheckCircle2 size={16} className="text-emerald-400" />}
                    {decision.outcome.result === 'PENDING_CONFIRMATION' && <HelpCircle size={16} className="text-amber-400" />}
                    <span>Final Outcome: {decision.outcome.result}</span>
                    {decision.outcome.recovered_amount > 0 && (
                      <span className="font-mono">({formatPaise(decision.outcome.recovered_amount)})</span>
                    )}
                  </div>
                  <p className="text-[11px] opacity-90">{decision.outcome.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column (5 cols): ERV Breakdown, Policy Checks, State Progression, Audit Trail */}
        <div className="lg:col-span-5 space-y-6">
          {/* ERV Mathematical Explanation */}
          <ErvBreakdown
            selectedAction={selectedCandidate}
            candidateActions={decision.candidate_actions}
            totalAmount={decision.payment.amount}
          />

          {/* Deterministic Policy Check List */}
          <PolicyCheckList
            policyResult={decision.policy_result}
            policyVersion={decision.policy_version}
            checks={decision.policy_checks}
          />

          {/* Recovery State Machine Timeline */}
          <RecoveryTimeline decision={decision} />

          {/* Payment-Scoped Audit Trail */}
          <div className="bg-[#151722] border border-[#222533] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="border-b border-[#222533] pb-4">
              <span className="text-xs uppercase font-medium tracking-wider text-zinc-400">
                Immutable Ledger
              </span>
              <h3 className="text-base font-semibold text-[#fafafa] mt-0.5">
                Decision Audit Trail
              </h3>
            </div>

            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {auditTrail.length === 0 ? (
                <p className="text-xs text-zinc-400 py-6 text-center">
                  No audit events recorded for this payment yet.
                </p>
              ) : (
                auditTrail.map(event => <AuditEvent key={event.id} event={event} />)
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Manual Override Dialog */}
      <OverrideDialog
        decision={decision}
        isOpen={isOverrideOpen}
        onClose={() => setIsOverrideOpen(false)}
        onConfirm={async (action, reason) => {
          await onOverride(action, reason);
        }}
      />
    </div>
  );
};
