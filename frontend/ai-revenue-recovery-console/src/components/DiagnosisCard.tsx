import React from 'react';
import { Sparkles, Shield, AlertCircle, Info } from 'lucide-react';
import { Diagnosis } from '../types/domain';
import { formatPercentage } from '../lib/money';

interface DiagnosisCardProps {
  id?: string;
  diagnosis: Diagnosis;
}

export const DiagnosisCard: React.FC<DiagnosisCardProps> = ({ id, diagnosis }) => {
  const isAi = diagnosis.source === 'AI-assisted';

  return (
    <div
      id={id}
      className="bg-[#151722] border border-[#222533] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#222533] pb-4">
        <div className="flex items-center gap-3">
          {isAi ? (
            <div className="w-8 h-8 rounded-xl bg-[#1e2232] border border-[#2d3249] flex items-center justify-center text-zinc-200">
              <Sparkles size={16} />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-amber-950/30 border border-amber-700/40 flex items-center justify-center text-amber-400">
              <Shield size={16} />
            </div>
          )}
          <div>
            <span className="text-xs uppercase font-medium tracking-wider text-zinc-400">
              Root Cause Diagnosis
            </span>
            <h3 className="text-base sm:text-lg font-semibold text-[#fafafa] mt-0.5">
              {diagnosis.root_cause}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-zinc-400 font-medium">
              Diagnosis Confidence
            </div>
            <div className="text-xl font-bold font-mono text-[#fafafa] mt-0.5">
              {formatPercentage(diagnosis.confidence)}
            </div>
          </div>

          <div
            className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
              isAi
                ? 'bg-[#1e2232] text-zinc-200 border-[#2d3249]'
                : 'bg-amber-950/40 text-amber-300 border-amber-800/40'
            }`}
          >
            {diagnosis.source}
          </div>
        </div>
      </div>

      {/* Distinction notice */}
      <div className="flex items-start gap-2.5 text-xs bg-[#10121a] border border-[#222533] rounded-xl p-3 text-zinc-300">
        <Info size={15} className="text-zinc-400 mt-0.5 shrink-0" />
        <div>
          <span className="font-semibold text-zinc-100">
            Diagnosis Confidence ({formatPercentage(diagnosis.confidence)})
          </span>{' '}
          reflects certainty in identifying <em>why the failure occurred</em>. It is distinct from{' '}
          <span className="font-semibold text-emerald-400">P(success)</span>, which is the probability of recovering revenue through a specific candidate action.
        </div>
      </div>

      {/* Rationale explanation */}
      <div className="space-y-1.5">
        <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-medium">
          Causal Rationale
        </span>
        <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed bg-[#10121a] border border-[#222533] p-3.5 rounded-xl">
          {diagnosis.rationale}
        </p>
      </div>

      {/* Metadata */}
      <div className="flex flex-wrap items-center justify-between text-[11px] text-zinc-400 pt-1">
        <span>
          Model / Engine: <code className="text-zinc-300 font-mono">{diagnosis.model_version || 'deterministic-v2'}</code>
        </span>
        <span>
          Diagnosed at: <span className="text-zinc-300 font-mono">{new Date(diagnosis.diagnosed_at).toLocaleTimeString()}</span>
        </span>
      </div>
    </div>
  );
};
