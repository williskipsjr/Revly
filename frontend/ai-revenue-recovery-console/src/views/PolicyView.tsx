import React, { useState, useEffect } from 'react';
import {
  Shield,
  Sliders,
  AlertTriangle,
  Save,
  RotateCcw,
  CheckCircle2,
  DollarSign,
  Lock,
  Layers
} from 'lucide-react';
import { MerchantPolicyConfig, MerchantInfo, CandidateActionType } from '../types/domain';
import { formatPaise } from '../lib/money';
import { KillSwitch } from '../components/KillSwitch';

interface PolicyViewProps {
  policy: MerchantPolicyConfig;
  currentMerchant: MerchantInfo;
  onSavePolicy: (updated: Partial<MerchantPolicyConfig>) => Promise<void>;
  onToggleKillSwitch: (active: boolean, reason: string) => Promise<void>;
  loading?: boolean;
}

export const PolicyView: React.FC<PolicyViewProps> = ({
  policy,
  currentMerchant,
  onSavePolicy,
  onToggleKillSwitch,
  loading = false
}) => {
  // Local form state
  const [maxRetries, setMaxRetries] = useState(policy.max_retries);
  const [cooldownMinutes, setCooldownMinutes] = useState(policy.cooldown_minutes);
  const [dailyActionCap, setDailyActionCap] = useState(policy.daily_action_cap);
  const [minErvRupees, setMinErvRupees] = useState((policy.min_erv_threshold / 100).toString());
  const [amountCeilingRupees, setAmountCeilingRupees] = useState((policy.amount_ceiling / 100).toString());
  const [confidenceFloorPct, setConfidenceFloorPct] = useState(
    Math.round(policy.confidence_floor_override * 100).toString()
  );

  // Action economics local state
  const [actionCosts, setActionCosts] = useState(JSON.parse(JSON.stringify(policy.action_costs)));

  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Sync state when merchant changes
  useEffect(() => {
    setMaxRetries(policy.max_retries);
    setCooldownMinutes(policy.cooldown_minutes);
    setDailyActionCap(policy.daily_action_cap);
    setMinErvRupees((policy.min_erv_threshold / 100).toString());
    setAmountCeilingRupees((policy.amount_ceiling / 100).toString());
    setConfidenceFloorPct(Math.round(policy.confidence_floor_override * 100).toString());
    setActionCosts(JSON.parse(JSON.stringify(policy.action_costs)));
    setHasChanges(false);
    setSaveSuccess(false);
    setErrorMessage('');
  }, [policy]);

  const handleFieldChange = (setter: React.Dispatch<React.SetStateAction<any>>, value: any) => {
    setter(value);
    setHasChanges(true);
    setSaveSuccess(false);
  };

  const handleActionCostChange = (
    actionType: CandidateActionType,
    field: 'monetary_cost' | 'friction_weight',
    valueInRupees: number
  ) => {
    setActionCosts((prev: any) => ({
      ...prev,
      [actionType]: {
        ...prev[actionType],
        [field]: Math.round(valueInRupees * 100) // Convert rupees to paise
      }
    }));
    setHasChanges(true);
    setSaveSuccess(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setErrorMessage('');
      const minErvPaise = Math.round(parseFloat(minErvRupees) * 100);
      const ceilingPaise = Math.round(parseFloat(amountCeilingRupees) * 100);
      const confFloor = parseFloat(confidenceFloorPct) / 100;

      if (isNaN(minErvPaise) || minErvPaise < 0) {
        setErrorMessage('Minimum ERV threshold must be a non-negative number');
        return;
      }
      if (isNaN(ceilingPaise) || ceilingPaise <= 0) {
        setErrorMessage('Amount ceiling must be greater than 0');
        return;
      }
      if (isNaN(confFloor) || confFloor < 0.5 || confFloor > 1.0) {
        setErrorMessage('Confidence floor must be between 50% and 100%');
        return;
      }

      await onSavePolicy({
        max_retries: Number(maxRetries),
        cooldown_minutes: Number(cooldownMinutes),
        daily_action_cap: Number(dailyActionCap),
        min_erv_threshold: minErvPaise,
        amount_ceiling: ceilingPaise,
        confidence_floor_override: confFloor,
        action_costs: actionCosts
      });

      setHasChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update merchant policy configuration');
    }
  };

  const handleReset = () => {
    setMaxRetries(policy.max_retries);
    setCooldownMinutes(policy.cooldown_minutes);
    setDailyActionCap(policy.daily_action_cap);
    setMinErvRupees((policy.min_erv_threshold / 100).toString());
    setAmountCeilingRupees((policy.amount_ceiling / 100).toString());
    setConfidenceFloorPct(Math.round(policy.confidence_floor_override * 100).toString());
    setActionCosts(JSON.parse(JSON.stringify(policy.action_costs)));
    setHasChanges(false);
    setErrorMessage('');
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222533] pb-4">
        <div>
          <span className="text-xs uppercase font-medium tracking-wider text-zinc-400">
            Governance &amp; Risk Guardrails
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-[#fafafa] mt-0.5">
            Merchant Policy Configuration
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Configured for <strong className="text-zinc-200">{currentMerchant.name}</strong> ({currentMerchant.id}). Policy strictly constrains automated economic execution.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {hasChanges && (
            <span className="text-xs text-amber-400 font-medium animate-pulse">
              ● Unsaved changes
            </span>
          )}
          {saveSuccess && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-800/40">
              <CheckCircle2 size={14} /> Saved successfully
            </span>
          )}
        </div>
      </div>

      {/* Kill Switch Section */}
      <KillSwitch
        isActive={policy.kill_switch_active}
        scope={policy.kill_switch_scope}
        merchantName={currentMerchant.name}
        onToggle={onToggleKillSwitch}
        loading={loading}
      />

      <form onSubmit={handleSave} className="space-y-6">
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-700/50 text-xs text-rose-300 flex items-center gap-2.5">
            <AlertTriangle size={16} className="text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recovery Limits */}
          <div className="bg-[#151722] border border-[#222533] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="flex items-center gap-2.5 border-b border-[#222533] pb-4">
              <div className="w-8 h-8 rounded-lg bg-[#10121a] border border-[#222533] text-zinc-300 flex items-center justify-center shrink-0">
                <Sliders size={16} />
              </div>
              <div>
                <span className="text-xs uppercase font-medium tracking-wider text-zinc-400">
                  Execution Bounds
                </span>
                <h3 className="text-base font-semibold text-[#fafafa] mt-0.5">Recovery Limits</h3>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-zinc-200">Max Retries per Payment</label>
                  <span className="text-xs text-zinc-300 font-mono px-2 py-0.5 rounded bg-[#10121a] border border-[#222533]">{maxRetries} attempts</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={maxRetries}
                  onChange={e => handleFieldChange(setMaxRetries, parseInt(e.target.value))}
                  className="w-full accent-zinc-200 cursor-pointer"
                />
                <p className="text-[11px] text-zinc-400 mt-1.5 leading-relaxed">
                  Hard boundary: System will halt recovery once {maxRetries} attempts are reached to prevent customer fatigue.
                </p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-zinc-200">Intervention Cooldown Window</label>
                  <span className="text-xs text-zinc-300 font-mono px-2 py-0.5 rounded bg-[#10121a] border border-[#222533]">{cooldownMinutes} minutes</span>
                </div>
                <input
                  type="number"
                  min="5"
                  max="360"
                  value={cooldownMinutes}
                  onChange={e => handleFieldChange(setCooldownMinutes, parseInt(e.target.value))}
                  className="w-full bg-[#10121a] border border-[#222533] rounded-xl p-2.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500"
                />
                <p className="text-[11px] text-zinc-400 mt-1.5 leading-relaxed">
                  Minimum waiting period before scheduling a delayed retry or secondary customer outreach.
                </p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-zinc-200">Daily Action Cap</label>
                  <span className="text-xs text-zinc-300 font-mono px-2 py-0.5 rounded bg-[#10121a] border border-[#222533]">{dailyActionCap} actions/day</span>
                </div>
                <input
                  type="number"
                  min="50"
                  max="5000"
                  value={dailyActionCap}
                  onChange={e => handleFieldChange(setDailyActionCap, parseInt(e.target.value))}
                  className="w-full bg-[#10121a] border border-[#222533] rounded-xl p-2.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500"
                />
                <p className="text-[11px] text-zinc-400 mt-1.5 leading-relaxed">
                  Platform safety circuit-breaker: Max automated interventions across the entire merchant account per calendar day.
                </p>
              </div>
            </div>
          </div>

          {/* Financial Controls */}
          <div className="bg-[#151722] border border-[#222533] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="flex items-center gap-2.5 border-b border-[#222533] pb-4">
              <div className="w-8 h-8 rounded-lg bg-[#10121a] border border-[#222533] text-emerald-400 flex items-center justify-center shrink-0">
                <DollarSign size={16} />
              </div>
              <div>
                <span className="text-xs uppercase font-medium tracking-wider text-zinc-400">
                  Economic &amp; Gating Safety
                </span>
                <h3 className="text-base font-semibold text-[#fafafa] mt-0.5">Financial Controls</h3>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-200 block mb-1.5">
                  Minimum ERV Threshold (₹ INR)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-mono text-zinc-500">₹</span>
                  <input
                    type="number"
                    value={minErvRupees}
                    onChange={e => handleFieldChange(setMinErvRupees, e.target.value)}
                    className="w-full bg-[#10121a] border border-[#222533] rounded-xl pl-8 pr-3 py-2.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500"
                  />
                </div>
                <p className="text-[11px] text-zinc-400 mt-1.5 leading-relaxed">
                  Actions with Expected Recovery Value below ₹{minErvRupees} are blocked from automated execution to avoid negative ROI.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-200 block mb-1.5">
                  Automated Action Ceiling (₹ INR)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-mono text-zinc-500">₹</span>
                  <input
                    type="number"
                    value={amountCeilingRupees}
                    onChange={e => handleFieldChange(setAmountCeilingRupees, e.target.value)}
                    className="w-full bg-[#10121a] border border-[#222533] rounded-xl pl-8 pr-3 py-2.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500"
                  />
                </div>
                <p className="text-[11px] text-zinc-400 mt-1.5 leading-relaxed">
                  Payments above ₹{amountCeilingRupees} are held in <strong className="text-amber-300 font-mono">HUMAN_REVIEW</strong> for manual operator approval.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-200 block mb-1.5">
                  Diagnosis Confidence Floor Override (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="50"
                    max="100"
                    value={confidenceFloorPct}
                    onChange={e => handleFieldChange(setConfidenceFloorPct, e.target.value)}
                    className="w-full bg-[#10121a] border border-[#222533] rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs font-mono text-zinc-500">%</span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1.5 leading-relaxed">
                  Minimum certainty required in root cause diagnosis before automated recovery is authorized.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Economics Table */}
        <div className="bg-[#151722] border border-[#222533] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-2.5 border-b border-[#222533] pb-4">
            <div className="w-8 h-8 rounded-lg bg-[#10121a] border border-[#222533] text-zinc-300 flex items-center justify-center shrink-0">
              <Layers size={16} />
            </div>
            <div>
              <span className="text-xs uppercase font-medium tracking-wider text-zinc-400">
                Cost &amp; Friction Coefficients
              </span>
              <h3 className="text-base font-semibold text-[#fafafa] mt-0.5">
                Action Economic Configuration
              </h3>
            </div>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            These parameters feed directly into the real-time ERV optimization model: <code className="text-zinc-200 font-mono font-semibold bg-[#10121a] px-2 py-0.5 rounded border border-[#222533]">ERV = P(success) × Amount − Cost − Friction</code>.
          </p>

          <div className="overflow-x-auto rounded-xl border border-[#222533]">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#222533] bg-[#10121a] text-zinc-400 uppercase font-mono text-[11px]">
                  <th className="py-3 px-4">Candidate Action Type</th>
                  <th className="py-3 px-4">Monetary Cost (₹)</th>
                  <th className="py-3 px-4">Friction Weight Penalty (₹)</th>
                  <th className="py-3 px-4">Behavioral Impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222533] font-sans">
                {(Object.keys(actionCosts) as CandidateActionType[]).map(actionKey => {
                  const costItem = actionCosts[actionKey];
                  const labels: Record<CandidateActionType, string> = {
                    retry: 'Immediate Retry',
                    delayed_retry: 'Delayed Retry',
                    alternate_method: 'Alternate Method',
                    payment_link: 'Payment Link',
                    reminder: 'Reminder / Push',
                    escalate: 'Human Escalation',
                    no_action: 'No Action'
                  };

                  const impacts: Record<CandidateActionType, string> = {
                    retry: 'High friction if bank outage ongoing',
                    delayed_retry: 'Near-zero customer friction; silent retry',
                    alternate_method: 'Moderate friction; prompts checkout switch',
                    payment_link: 'Low friction; convenient omnichannel link',
                    reminder: 'Moderate friction; push notification alert',
                    escalate: 'High overhead; manual support rep call',
                    no_action: 'Zero friction; closes recovery attempt'
                  };

                  return (
                    <tr key={actionKey} className="hover:bg-[#1a1d2b] transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-semibold text-zinc-200 block">{labels[actionKey]}</span>
                        <span className="text-[11px] font-mono text-zinc-400">{actionKey}</span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="relative w-28">
                          <span className="absolute left-2.5 top-1.5 text-xs text-zinc-500 font-mono">₹</span>
                          <input
                            type="number"
                            step="0.5"
                            value={(costItem.monetary_cost / 100).toFixed(2)}
                            onChange={e =>
                              handleActionCostChange(
                                actionKey,
                                'monetary_cost',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full bg-[#10121a] border border-[#222533] rounded-lg pl-6 pr-2 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500"
                          />
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="relative w-28">
                          <span className="absolute left-2.5 top-1.5 text-xs text-zinc-500 font-mono">₹</span>
                          <input
                            type="number"
                            step="1"
                            value={(costItem.friction_weight / 100).toFixed(2)}
                            onChange={e =>
                              handleActionCostChange(
                                actionKey,
                                'friction_weight',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full bg-[#10121a] border border-[#222533] rounded-lg pl-6 pr-2 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500"
                          />
                        </div>
                      </td>

                      <td className="py-3 px-4 text-zinc-400 text-xs">
                        {impacts[actionKey]}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer controls */}
        <div className="flex items-center justify-between pt-4 border-t border-[#222533]">
          <span className="text-xs text-zinc-400">
            Last policy update: <strong className="text-zinc-300 font-mono">{new Date(policy.updated_at).toLocaleString()}</strong> by {policy.updated_by || 'Operator'}
          </span>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              disabled={!hasChanges || loading}
              className="cursor-pointer flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#222533] bg-[#151722] hover:bg-[#1a1d2b] text-xs font-medium text-zinc-300 disabled:opacity-40 transition-colors shadow-2xs"
            >
              <RotateCcw size={14} />
              <span>Reset</span>
            </button>

            <button
              type="submit"
              disabled={!hasChanges || loading}
              className="cursor-pointer flex items-center gap-2 px-5 py-2 rounded-xl bg-zinc-100 hover:bg-white disabled:opacity-40 text-zinc-950 text-xs font-semibold border border-white shadow-2xs transition-all"
            >
              <Save size={14} />
              <span>{loading ? 'Saving Policy...' : 'Save Policy Changes'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
