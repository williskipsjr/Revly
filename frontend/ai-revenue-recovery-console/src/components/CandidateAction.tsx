import React from 'react';
import { Check, ShieldAlert, ArrowRight, Trophy } from 'lucide-react';
import { CandidateActionItem } from '../types/domain';
import { formatPaise, formatPercentage } from '../lib/money';
import { DecisionStatus } from './DecisionStatus';

interface CandidateActionProps {
  id?: string;
  action: CandidateActionItem;
  isSelected?: boolean;
  onSelect?: () => void;
  interactive?: boolean;
}

export const CandidateAction: React.FC<CandidateActionProps> = ({
  id,
  action,
  isSelected = false,
  onSelect,
  interactive = false
}) => {
  const isWinner = action.is_winner;
  const isBlocked = action.policy_result === 'BLOCK';

  return (
    <div
      id={id}
      onClick={interactive ? onSelect : undefined}
      className={`relative rounded-xl border p-4 transition-all ${
        isWinner
          ? 'bg-[#181c2b] border-[#313a57] shadow-xs ring-1 ring-[#3b4566]'
          : isBlocked
          ? 'bg-[#10121a]/60 border-[#1e202c] opacity-75'
          : 'bg-[#10121a] border-[#222533] hover:border-zinc-600'
      } ${interactive ? 'cursor-pointer' : ''}`}
    >
      {/* Header ribbon for winner */}
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          {isWinner && (
            <span className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#202538] text-zinc-200 border border-[#343b59] uppercase tracking-wider">
              <Trophy size={11} className="text-amber-400" />
              Selected Action
            </span>
          )}
          <span className="text-xs uppercase font-mono text-zinc-400">
            {action.action_type}
          </span>
        </div>

        <DecisionStatus type="policy" value={action.policy_result} size="sm" />
      </div>

      <div className="mb-3">
        <h4 className="text-sm font-semibold text-[#fafafa] flex items-center gap-1.5">
          {action.action_label}
        </h4>
        <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
          {action.description}
        </p>
      </div>

      {/* Grid of financial/probabilistic terms */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-[#222533] text-xs">
        <div>
          <span className="text-[11px] text-zinc-400 block font-medium">P(success)</span>
          <span className="text-sm font-semibold text-emerald-400 font-mono">
            {formatPercentage(action.p_success)}
          </span>
        </div>

        <div>
          <span className="text-[11px] text-zinc-400 block font-medium">Action Cost</span>
          <span className="text-sm font-medium text-zinc-300 font-mono">
            {formatPaise(action.cost)}
          </span>
        </div>

        <div>
          <span className="text-[11px] text-zinc-400 block font-medium">Friction</span>
          <span className="text-sm font-medium text-amber-300 font-mono">
            {formatPaise(action.friction_penalty)}
          </span>
        </div>

        <div className="text-right sm:text-left">
          <span className="text-[11px] text-zinc-400 block font-medium">ERV</span>
          <span
            className={`text-sm font-bold font-mono ${
              action.erv > 0 ? 'text-[#fafafa]' : 'text-zinc-500'
            }`}
          >
            {formatPaise(action.erv)}
          </span>
        </div>
      </div>

      {action.policy_notes && (
        <div className="mt-3 text-[11px] text-zinc-400 italic flex items-center gap-1 bg-[#0c0d14] px-2.5 py-1.5 rounded-lg border border-[#222533]">
          <span className="text-zinc-400 not-italic font-medium">Policy:</span>
          <span>{action.policy_notes}</span>
        </div>
      )}
    </div>
  );
};
