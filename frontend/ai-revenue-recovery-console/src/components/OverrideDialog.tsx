import React, { useState } from 'react';
import { Edit3, AlertCircle, ArrowRight, ShieldCheck, X } from 'lucide-react';
import { CandidateActionType, Decision } from '../types/domain';
import { formatPaise } from '../lib/money';

interface OverrideDialogProps {
  decision: Decision;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (action: CandidateActionType, reason: string) => Promise<void>;
}

export const OverrideDialog: React.FC<OverrideDialogProps> = ({
  decision,
  isOpen,
  onClose,
  onConfirm
}) => {
  const [selectedAction, setSelectedAction] = useState<CandidateActionType>(decision.chosen_action);
  const [operatorReason, setOperatorReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorReason.trim()) {
      setError('An explicit operator reason is mandatory for audit trail compliance.');
      return;
    }
    try {
      setIsSubmitting(true);
      setError('');
      await onConfirm(selectedAction, operatorReason);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit decision override');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-[#151722] border border-[#222533] rounded-2xl p-6 max-w-lg w-full space-y-5 shadow-2xl relative">
        <button
          onClick={onClose}
          className="cursor-pointer absolute top-4 right-4 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-start gap-3 border-b border-[#222533] pb-4">
          <div className="w-9 h-9 rounded-xl bg-amber-950/30 text-amber-400 border border-amber-700/40 flex items-center justify-center shrink-0">
            <Edit3 size={18} />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
              Audited Operator Control
            </span>
            <h3 className="text-base font-semibold text-[#fafafa] mt-0.5">
              Manual Decision Override
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Decision <strong className="text-zinc-200 font-mono">{decision.id}</strong> ({formatPaise(decision.payment.amount)})
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current vs Replacement */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-[#10121a] p-3.5 rounded-xl border border-[#222533]">
            <div>
              <span className="text-zinc-400 block mb-1">Current Action</span>
              <span className="font-mono font-semibold text-zinc-200 uppercase">
                {decision.chosen_action}
              </span>
              <span className="text-[11px] text-zinc-400 block mt-0.5 font-mono">
                ERV: {formatPaise(decision.erv_at_decision)}
              </span>
            </div>

            <div>
              <span className="text-zinc-300 block mb-1 font-medium">Replacement Action</span>
              <span className="font-mono font-bold text-emerald-400 uppercase">
                {selectedAction}
              </span>
              <span className="text-[11px] text-zinc-400 block mt-0.5">
                Will be re-evaluated
              </span>
            </div>
          </div>

          {/* Action selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 block">
              Select Replacement Candidate Action
            </label>
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
              {decision.candidate_actions.map(action => (
                <label
                  key={action.action_type}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all text-xs ${
                    selectedAction === action.action_type
                      ? 'bg-[#181c2b] border-[#313a57] text-zinc-100 ring-1 ring-[#3b4566]'
                      : 'bg-[#10121a] border-[#222533] hover:border-zinc-700 text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="override_action"
                      value={action.action_type}
                      checked={selectedAction === action.action_type}
                      onChange={() => setSelectedAction(action.action_type)}
                      className="accent-zinc-300"
                    />
                    <div>
                      <span className="font-medium text-zinc-200">{action.action_label}</span>
                      <span className="text-[11px] text-zinc-400 block font-mono mt-0.5">
                        P(succ): {Math.round(action.p_success * 100)}% · ERV: {formatPaise(action.erv)}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                      action.policy_result === 'ALLOW'
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/40'
                        : 'bg-amber-950/80 text-amber-300 border border-amber-800/40'
                    }`}
                  >
                    {action.policy_result}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Mandatory reason */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 block">
              Mandatory Operator Audit Justification <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={operatorReason}
              onChange={e => {
                setOperatorReason(e.target.value);
                setError('');
              }}
              rows={3}
              placeholder="e.g. Customer contacted VIP support desk via WhatsApp requesting direct checkout link rather than delayed automated retry."
              className="w-full bg-[#10121a] border border-[#222533] rounded-xl p-3 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 font-sans"
            />
            {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[#222533]">
            <span className="text-[11px] text-zinc-400">
              Overrides are recorded permanently in audit logs.
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="cursor-pointer px-3.5 py-1.5 rounded-lg border border-[#222533] text-xs font-medium text-zinc-300 hover:bg-[#1c1e2b] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="cursor-pointer px-4 py-1.5 rounded-lg text-xs font-semibold text-zinc-950 bg-zinc-100 hover:bg-white border border-white transition-colors"
              >
                {isSubmitting ? 'Recording...' : 'Authorize Override'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
