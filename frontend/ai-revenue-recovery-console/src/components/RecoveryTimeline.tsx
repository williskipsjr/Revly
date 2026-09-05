import React from 'react';
import { Clock, CheckCircle2, AlertCircle, ArrowDown, Activity } from 'lucide-react';
import { Decision } from '../types/domain';
import { DecisionStatus } from './DecisionStatus';
import { formatPaise } from '../lib/money';

interface RecoveryTimelineProps {
  id?: string;
  decision: Decision;
}

export const RecoveryTimeline: React.FC<RecoveryTimelineProps> = ({ id, decision }) => {
  const steps: Array<{
    state: string;
    label: string;
    timestamp: string;
    details: string;
    isCompleted: boolean;
    isCurrent: boolean;
    isFailedOrStopped?: boolean;
  }> = [
    {
      state: 'FAILED',
      label: 'Payment Ingestion & Failure',
      timestamp: decision.payment.occurred_at,
      details: `${decision.payment.failure_code}: ${decision.payment.failure_reason}`,
      isCompleted: true,
      isCurrent: false
    },
    {
      state: 'DIAGNOSED',
      label: 'Root Cause Diagnosis',
      timestamp: decision.diagnosis.diagnosed_at,
      details: `${decision.diagnosis.root_cause} (${Math.round(decision.diagnosis.confidence * 100)}% confidence)`,
      isCompleted: true,
      isCurrent: false
    },
    {
      state: 'RECOVERY_ELIGIBLE',
      label: 'Candidate Action & ERV Ranking',
      timestamp: decision.created_at,
      details: `${decision.candidate_actions.length} candidate actions ranked. Top ERV: ${formatPaise(decision.erv_at_decision)}`,
      isCompleted: true,
      isCurrent: decision.recovery_state === 'RECOVERY_ELIGIBLE'
    },
    {
      state: 'ACTION_SELECTED',
      label: 'Policy Authorization Check',
      timestamp: decision.created_at,
      details: `Policy result: ${decision.policy_result}. Action "${decision.chosen_action}" approved`,
      isCompleted: decision.recovery_state !== 'RECOVERY_ELIGIBLE',
      isCurrent: decision.recovery_state === 'ACTION_SELECTED'
    },
    {
      state: 'ACTION_PENDING',
      label: 'Idempotent Action Execution',
      timestamp: decision.execution?.executed_at || decision.updated_at,
      details: decision.execution
        ? `Dispatched via ${decision.execution.channel || 'Gateway'}. Status: ${decision.execution.status}. (IdempotencyKey: ${decision.execution.idempotency_key})`
        : 'Action dispatched or pending window',
      isCompleted: ['RECOVERED', 'DONE', 'STOPPED', 'FAILED'].includes(decision.recovery_state),
      isCurrent: decision.recovery_state === 'ACTION_PENDING'
    }
  ];

  // Final resolution step
  if (decision.recovery_state === 'RECOVERED' || decision.recovery_state === 'DONE') {
    steps.push({
      state: 'RECOVERED',
      label: 'Outcome Confirmed & Reconciled',
      timestamp: decision.outcome?.observed_at || decision.updated_at,
      details: `Successfully recovered ${formatPaise(decision.outcome?.recovered_amount || decision.payment.amount)}. ${decision.outcome?.notes || ''}`,
      isCompleted: true,
      isCurrent: true
    });
  } else if (decision.recovery_state === 'STOPPED') {
    steps.push({
      state: 'STOPPED',
      label: 'Recovery Terminated by Policy',
      timestamp: decision.outcome?.observed_at || decision.updated_at,
      details: decision.outcome?.notes || 'Terminated to protect merchant reputation and prevent excessive retries.',
      isCompleted: true,
      isCurrent: true,
      isFailedOrStopped: true
    });
  } else if (decision.recovery_state === 'FAILED') {
    steps.push({
      state: 'FAILED',
      label: 'Recovery Exhausted',
      timestamp: decision.outcome?.observed_at || decision.updated_at,
      details: decision.outcome?.notes || 'Intervention could not recover revenue.',
      isCompleted: true,
      isCurrent: true,
      isFailedOrStopped: true
    });
  }

  return (
    <div id={id} className="bg-[#151722] border border-[#222533] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
      <div className="flex items-center justify-between border-b border-[#222533] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#1e2232] border border-[#2d3249] flex items-center justify-center text-zinc-200">
            <Activity size={16} />
          </div>
          <div>
            <span className="text-xs uppercase font-medium tracking-wider text-zinc-400">
              Causal State Machine
            </span>
            <h3 className="text-base font-semibold text-[#fafafa] mt-0.5">
              Recovery State Progression
            </h3>
          </div>
        </div>

        <DecisionStatus type="state" value={decision.recovery_state} size="sm" />
      </div>

      <div className="relative pl-6 space-y-5 pt-2 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-[#222533]">
        {steps.map((step, idx) => (
          <div key={idx} className="relative group">
            {/* Timeline bullet icon */}
            <div
              className={`absolute -left-6 top-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all ${
                step.isCurrent
                  ? 'bg-zinc-100 border-white text-zinc-950 ring-4 ring-zinc-700/30'
                  : step.isFailedOrStopped
                  ? 'bg-rose-950 border-rose-600 text-rose-300'
                  : step.isCompleted
                  ? 'bg-[#181c2b] border-emerald-500/60 text-emerald-400'
                  : 'bg-[#10121a] border-[#222533] text-zinc-500'
              }`}
            >
              {step.isCompleted ? '✓' : idx + 1}
            </div>

            <div className="bg-[#10121a] border border-[#222533] rounded-xl p-3.5 space-y-1.5 hover:border-zinc-700 transition-colors">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <DecisionStatus type="state" value={step.state} size="sm" showIcon={false} />
                  <span className="text-xs font-semibold text-zinc-200">{step.label}</span>
                </div>
                <span className="text-[11px] font-mono text-zinc-400">
                  {new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed pt-0.5">{step.details}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
