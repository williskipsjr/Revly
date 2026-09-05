import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Shield, ShieldCheck, ShieldAlert } from 'lucide-react';
import { DeterministicPolicyCheck, PolicyCheckResult } from '../types/domain';
import { DecisionStatus } from './DecisionStatus';

interface PolicyCheckListProps {
  id?: string;
  policyResult: PolicyCheckResult;
  policyVersion: string;
  checks: DeterministicPolicyCheck[];
}

export const PolicyCheckList: React.FC<PolicyCheckListProps> = ({
  id,
  policyResult,
  policyVersion,
  checks
}) => {
  const passedCount = checks.filter(c => c.passed).length;
  const totalCount = checks.length;

  return (
    <div id={id} className="bg-[#151722] border border-[#222533] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#222533] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#1e2232] border border-[#2d3249] flex items-center justify-center text-zinc-200">
            <Shield size={16} />
          </div>
          <div>
            <span className="text-xs uppercase font-medium tracking-wider text-zinc-400">
              Deterministic Safety Authority
            </span>
            <h3 className="text-base font-semibold text-[#fafafa] mt-0.5">
              Merchant Policy Verification
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-xs text-zinc-400 font-mono">
            {passedCount} / {totalCount} passed
          </span>
          <DecisionStatus type="policy" value={policyResult} size="md" />
        </div>
      </div>

      <div className="text-xs text-zinc-400 bg-[#10121a] border border-[#222533] rounded-xl p-3">
        <span className="font-semibold text-zinc-300">Policy Hierarchy:</span> While statistical ERV ranks economic efficiency, deterministic policy checks have absolute safety veto authority. No action executes without passing all merchant policy bounds.
      </div>

      {/* Checks list */}
      <div className="space-y-2.5">
        {checks.map(chk => (
          <div
            key={chk.id}
            className={`p-3.5 rounded-xl border transition-all text-xs ${
              chk.passed
                ? 'bg-[#10121a] border-[#222533] hover:border-zinc-700'
                : 'bg-rose-950/20 border-rose-800/40'
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                {chk.passed ? (
                  <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                ) : (
                  <XCircle size={15} className="text-rose-400 shrink-0" />
                )}
                <span className="font-semibold text-zinc-200">{chk.name}</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-[#1c1e2b] text-zinc-400 border border-[#2b3044]">
                  {chk.category}
                </span>
              </div>

              <span
                className={`font-semibold font-mono text-[11px] ${
                  chk.passed ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {chk.passed ? 'PASSED' : 'FAILED'}
              </span>
            </div>

            <p className="text-zinc-400 text-xs mb-2 pl-6 leading-relaxed">{chk.details}</p>

            <div className="flex flex-wrap items-center gap-4 pl-6 text-[11px] font-mono text-zinc-400 pt-1.5 border-t border-[#1f222e]">
              <span>
                Actual: <strong className="text-zinc-200">{chk.actual_value}</strong>
              </span>
              <span>
                Threshold: <strong className="text-zinc-300">{chk.threshold}</strong>
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
        <span>Policy engine build: <code className="font-mono text-zinc-300">{policyVersion}</code></span>
        <span>Deterministic rules: zero LLM execution authority</span>
      </div>
    </div>
  );
};
