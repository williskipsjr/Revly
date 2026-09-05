import React, { useState } from 'react';
import { Power, AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react';

interface KillSwitchProps {
  id?: string;
  isActive: boolean;
  scope: 'merchant' | 'global';
  merchantName: string;
  onToggle: (activate: boolean, reason: string) => Promise<void>;
  loading?: boolean;
}

export const KillSwitch: React.FC<KillSwitchProps> = ({
  id,
  isActive,
  scope,
  merchantName,
  onToggle,
  loading = false
}) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const handleOpenModal = () => {
    setReason('');
    setError('');
    setShowConfirmModal(true);
  };

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setError('An explicit operational reason is required for audit compliance.');
      return;
    }
    try {
      await onToggle(!isActive, reason);
      setShowConfirmModal(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to update kill switch');
    }
  };

  return (
    <div
      id={id}
      className={`rounded-2xl border p-5 sm:p-6 transition-all ${
        isActive
          ? 'bg-rose-950/20 border-rose-600/60 shadow-lg'
          : 'bg-[#151722] border-[#222533] shadow-xs'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                isActive
                  ? 'bg-rose-900/40 text-rose-300 border border-rose-700/60'
                  : 'bg-[#1a1e2d] text-emerald-400 border border-emerald-800/40'
              }`}
            >
              <Power size={18} />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Administrative Safety Gate
              </span>
              <h3 className="text-base font-semibold text-[#fafafa] mt-0.5">
                Automated Recovery Kill Switch
              </h3>
            </div>
          </div>

          <p className="text-xs text-zinc-400 max-w-xl leading-relaxed">
            {isActive ? (
              <span className="text-rose-300 font-medium">
                EMERGENCY STOP ENGAGED: Automated recovery actions are halted for {merchantName}. New events are held in RECOVERY_ELIGIBLE without automated dispatch.
              </span>
            ) : (
              <span>
                Operational: Automated bounded execution is active within configured policy ceilings for {merchantName} (Scope: {scope}).
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3.5 shrink-0">
          <div className="text-right">
            <span className="text-[11px] uppercase tracking-wider text-zinc-400 block font-medium">
              Current Status
            </span>
            <span
              className={`text-xs font-bold font-mono px-3 py-1 rounded-full border inline-block mt-0.5 ${
                isActive
                  ? 'bg-rose-950/80 text-rose-300 border-rose-700/60'
                  : 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
              }`}
            >
              {isActive ? 'HALTED (ENGAGED)' : 'ACTIVE (NORMAL)'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleOpenModal}
            disabled={loading}
            className={`cursor-pointer px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all border shadow-xs ${
              isActive
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
                : 'bg-rose-700 hover:bg-rose-600 text-white border-rose-600'
            }`}
          >
            {isActive ? 'Restore Automation' : 'Engage Kill Switch'}
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#151722] border border-[#222533] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-xl shrink-0 ${
                  isActive ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/40' : 'bg-rose-950/80 text-rose-400 border border-rose-700/40'
                }`}
              >
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 className="text-base font-semibold text-[#fafafa]">
                  {isActive ? 'Restore Automated Recovery?' : 'Engage Emergency Kill Switch?'}
                </h4>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  {isActive
                    ? `This will resume automated candidate action dispatch for ${merchantName} under standard policy limits.`
                    : `This halts ALL automated execution for ${merchantName}. Existing actions in pending_confirmation state will reconcile, but no new automated retries or payment links will be dispatched.`}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300 block">
                Mandatory Operational Reason <span className="text-rose-400">*</span>
              </label>
              <textarea
                value={reason}
                onChange={e => {
                  setReason(e.target.value);
                  setError('');
                }}
                rows={3}
                placeholder="e.g. Temporary NPCI switch maintenance; holding retries to protect customer friction limits."
                className="w-full bg-[#10121a] border border-[#222533] rounded-xl p-3 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 font-sans"
              />
              {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#222533]">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="cursor-pointer px-3.5 py-1.5 rounded-lg border border-[#222533] text-xs font-medium text-zinc-300 hover:bg-[#1a1d2b] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading}
                className={`cursor-pointer px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors ${
                  isActive
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-rose-700 hover:bg-rose-600'
                }`}
              >
                {loading ? 'Processing...' : isActive ? 'Confirm Restore' : 'Confirm Emergency Stop'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
