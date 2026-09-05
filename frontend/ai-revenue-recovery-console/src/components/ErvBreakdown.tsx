import React from 'react';
import { Calculator, TrendingUp, AlertCircle } from 'lucide-react';
import { CandidateActionItem } from '../types/domain';
import { formatPaise, formatPercentage } from '../lib/money';

interface ErvBreakdownProps {
  id?: string;
  selectedAction: CandidateActionItem;
  candidateActions: CandidateActionItem[];
  totalAmount: number;
}

export const ErvBreakdown: React.FC<ErvBreakdownProps> = ({
  id,
  selectedAction,
  candidateActions,
  totalAmount
}) => {
  // Expected recovery gross = p_success * recoverable_amount
  const grossExpected = Math.round(selectedAction.p_success * selectedAction.recoverable_amount);
  const maxErv = Math.max(...candidateActions.map(a => Math.max(0, a.erv)), 1);

  return (
    <div id={id} className="bg-[#151722] border border-[#222533] rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#222533] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#1e2232] border border-[#2d3249] flex items-center justify-center text-zinc-200">
            <Calculator size={16} />
          </div>
          <div>
            <span className="text-xs uppercase font-medium tracking-wider text-zinc-400">
              Economic Decision Model
            </span>
            <h3 className="text-base font-semibold text-[#fafafa] mt-0.5">
              Expected Recovery Value (ERV) Breakdown
            </h3>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs text-zinc-400 block font-medium">Net ERV (Selected)</span>
          <span className="text-xl font-bold font-mono text-emerald-400 mt-0.5 block">
            {formatPaise(selectedAction.erv)}
          </span>
        </div>
      </div>

      {/* Arithmetic formula demonstration */}
      <div className="bg-[#10121a] border border-[#222533] rounded-xl p-4 space-y-3">
        <div className="text-xs text-zinc-400 font-medium uppercase tracking-wider">
          Step-by-Step Economic Arithmetic
        </div>

        <div className="font-mono text-xs sm:text-sm space-y-2 text-zinc-300">
          <div className="flex items-center justify-between pb-1.5 border-b border-[#1f222e]">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-semibold">
                {formatPercentage(selectedAction.p_success)}
              </span>
              <span className="text-zinc-400">×</span>
              <span>{formatPaise(selectedAction.recoverable_amount)}</span>
              <span className="text-[11px] text-zinc-400 font-sans hidden sm:inline">
                (P(success) × Recoverable Amount)
              </span>
            </div>
            <span className="font-semibold text-[#fafafa]">
              {formatPaise(grossExpected)}
            </span>
          </div>

          <div className="flex items-center justify-between text-rose-300/90 py-0.5">
            <div className="flex items-center gap-2">
              <span className="font-bold">−</span>
              <span>{formatPaise(selectedAction.cost)}</span>
              <span className="text-[11px] text-zinc-400 font-sans hidden sm:inline">
                (Action execution cost)
              </span>
            </div>
            <span>−{formatPaise(selectedAction.cost)}</span>
          </div>

          <div className="flex items-center justify-between text-amber-300/90 pb-2 border-b border-[#1f222e]">
            <div className="flex items-center gap-2">
              <span className="font-bold">−</span>
              <span>{formatPaise(selectedAction.friction_penalty)}</span>
              <span className="text-[11px] text-zinc-400 font-sans hidden sm:inline">
                (Customer friction penalty weight)
              </span>
            </div>
            <span>−{formatPaise(selectedAction.friction_penalty)}</span>
          </div>

          <div className="flex items-center justify-between pt-1 text-sm sm:text-base font-bold text-emerald-400">
            <span className="font-sans font-semibold text-zinc-200">
              Final Expected Recovery Value (ERV)
            </span>
            <span className="underline decoration-emerald-500/50 underline-offset-4">
              {formatPaise(selectedAction.erv)}
            </span>
          </div>
        </div>

        <div className="text-[11px] text-zinc-400 pt-1">
          <span className="font-medium text-zinc-300">Note:</span> ERV maximizes merchant economic recovery while penalizing customer friction and API execution costs. Policy gates authorization after ERV ranking.
        </div>
      </div>

      {/* Horizontal candidate action comparison bars */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
          <span>Candidate Actions Ranked by ERV</span>
          <span>Relative ERV</span>
        </div>

        <div className="space-y-2">
          {candidateActions.map(candidate => {
            const isWinner = candidate.is_winner;
            const pct = Math.max(2, Math.min(100, Math.round((Math.max(0, candidate.erv) / maxErv) * 100)));
            const isBlocked = candidate.policy_result === 'BLOCK';

            return (
              <div
                key={candidate.action_type}
                className={`p-3 rounded-xl border text-xs transition-all ${
                  isWinner
                    ? 'bg-[#181c2b] border-[#313a57] ring-1 ring-[#3b4566]'
                    : isBlocked
                    ? 'bg-[#10121a] border-[#1f222e] opacity-60'
                    : 'bg-[#10121a] border-[#222533]'
                }`}
              >
                <div className="flex items-center justify-between mb-2 font-medium">
                  <div className="flex items-center gap-2">
                    <span className={`font-mono ${isWinner ? 'text-zinc-100 font-bold' : 'text-zinc-300'}`}>
                      {candidate.action_label}
                    </span>
                    {isWinner && (
                      <span className="text-[10px] uppercase tracking-wider bg-[#202538] text-zinc-200 px-2 py-0.5 rounded-full font-semibold border border-[#343b59]">
                        Winner
                      </span>
                    )}
                    {isBlocked && (
                      <span className="text-[10px] uppercase tracking-wider bg-rose-950/80 text-rose-400 px-2 py-0.5 rounded-full font-semibold border border-rose-800/50">
                        Blocked by policy
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 font-mono">
                    <span className="text-zinc-400 text-[11px]">
                      P(succ): {formatPercentage(candidate.p_success)}
                    </span>
                    <span className={isWinner ? 'text-emerald-400 font-bold' : 'text-zinc-300'}>
                      {formatPaise(candidate.erv)}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-[#1c1e2b] rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isWinner
                        ? 'bg-emerald-400'
                        : isBlocked
                        ? 'bg-zinc-700'
                        : 'bg-zinc-600'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
