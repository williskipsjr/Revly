import React, { useState } from 'react';
import { PlayCircle, AlertCircle, X, Check } from 'lucide-react';
import { PaymentFailedEventPayload } from '../lib/api/types';

interface SimulateFailureDialogProps {
  merchantId: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: PaymentFailedEventPayload) => Promise<void>;
}

export const SimulateFailureDialog: React.FC<SimulateFailureDialogProps> = ({
  merchantId,
  isOpen,
  onClose,
  onSubmit
}) => {
  const [amountRupees, setAmountRupees] = useState('5499');
  const [method, setMethod] = useState<'card' | 'upi' | 'netbanking' | 'wallet'>('card');
  const [failurePreset, setFailurePreset] = useState<'bank_decline' | 'upi_timeout' | 'limit_exceeded'>('bank_decline');
  const [customerName, setCustomerName] = useState('Rohan Sen');
  const [customerEmail, setCustomerEmail] = useState('rohan.sen@gmail.com');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const presets = {
    bank_decline: {
      code: 'BANK_TEMP_DECLINE',
      reason: 'Temporary issuer switch failure (052: Switch unavailable)',
      amount: '5499'
    },
    upi_timeout: {
      code: 'UPI_COLLECT_TIMEOUT',
      reason: 'UPI collect notification timed out on customer device (U30)',
      amount: '2999'
    },
    limit_exceeded: {
      code: 'CORP_AUTH_LIMIT_EXCEEDED',
      reason: 'Transaction exceeds standard automated single-tx limit (Corp checker required)',
      amount: '120000'
    }
  };

  const handlePresetChange = (preset: 'bank_decline' | 'upi_timeout' | 'limit_exceeded') => {
    setFailurePreset(preset);
    setAmountRupees(presets[preset].amount);
    if (preset === 'upi_timeout') setMethod('upi');
    else if (preset === 'limit_exceeded') setMethod('netbanking');
    else setMethod('card');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rupees = parseFloat(amountRupees);
    if (isNaN(rupees) || rupees <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    const paise = Math.round(rupees * 100);
    const chosenPreset = presets[failurePreset];
    const eventId = `evt_${Date.now()}`;
    const paymentId = `pay_sim_${Math.random().toString(36).substring(2, 9)}`;

    const payload: PaymentFailedEventPayload = {
      external_event_id: eventId,
      payment_id: paymentId,
      amount: paise,
      currency: 'INR',
      method: method,
      failure_code: chosenPreset.code,
      failure_reason: chosenPreset.reason,
      customer_id: `cust_sim_${Math.random().toString(36).substring(2, 6)}`,
      customer_name: customerName,
      customer_email: customerEmail,
      timestamp: new Date().toISOString()
    };

    try {
      setIsSubmitting(true);
      setError('');
      await onSubmit(payload);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to ingest payment failure event');
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
          <div className="w-9 h-9 rounded-xl bg-[#10121a] text-zinc-200 border border-[#222533] flex items-center justify-center shrink-0">
            <PlayCircle size={18} />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Contract Endpoint (POST /v1/merchants/&#123;id&#125;/events/payment-failed)
            </span>
            <h3 className="text-base font-semibold text-[#fafafa] mt-0.5">
              Ingest Payment Failure Event
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
              Simulates webhook ingestion to trigger diagnosis, ERV calculation, and policy gating.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Preset Buttons */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 block">
              Failure Scenario Preset
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handlePresetChange('bank_decline')}
                className={`cursor-pointer p-3 rounded-xl border text-left text-xs transition-all ${
                  failurePreset === 'bank_decline'
                    ? 'bg-[#181c2b] border-[#313a57] text-zinc-100 ring-1 ring-[#3b4566]'
                    : 'bg-[#10121a] border-[#222533] text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <span className="font-semibold block text-zinc-200">Bank Switch Glitch</span>
                <span className="text-[10px] text-zinc-400 block mt-1 font-mono">₹5,499 (Card)</span>
              </button>

              <button
                type="button"
                onClick={() => handlePresetChange('upi_timeout')}
                className={`cursor-pointer p-3 rounded-xl border text-left text-xs transition-all ${
                  failurePreset === 'upi_timeout'
                    ? 'bg-[#181c2b] border-[#313a57] text-zinc-100 ring-1 ring-[#3b4566]'
                    : 'bg-[#10121a] border-[#222533] text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <span className="font-semibold block text-zinc-200">UPI Collect Timeout</span>
                <span className="text-[10px] text-zinc-400 block mt-1 font-mono">₹2,999 (UPI)</span>
              </button>

              <button
                type="button"
                onClick={() => handlePresetChange('limit_exceeded')}
                className={`cursor-pointer p-3 rounded-xl border text-left text-xs transition-all ${
                  failurePreset === 'limit_exceeded'
                    ? 'bg-[#181c2b] border-[#313a57] text-zinc-100 ring-1 ring-[#3b4566]'
                    : 'bg-[#10121a] border-[#222533] text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <span className="font-semibold block text-zinc-200">High Amount Review</span>
                <span className="text-[10px] text-zinc-400 block mt-1 font-mono">₹1,20,000 (Corp)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300 block">
                Amount (₹ INR)
              </label>
              <input
                type="number"
                value={amountRupees}
                onChange={e => setAmountRupees(e.target.value)}
                className="w-full bg-[#10121a] border border-[#222533] rounded-xl p-2.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300 block">
                Payment Method
              </label>
              <select
                value={method}
                onChange={e => setMethod(e.target.value as any)}
                className="w-full bg-[#10121a] border border-[#222533] rounded-xl p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500 cursor-pointer"
              >
                <option value="card">Card (Visa/Mastercard)</option>
                <option value="upi">UPI (Intent / Collect)</option>
                <option value="netbanking">Netbanking</option>
                <option value="wallet">Wallet</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300 block">
                Customer Name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="w-full bg-[#10121a] border border-[#222533] rounded-xl p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300 block">
                Customer Email
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={e => setCustomerEmail(e.target.value)}
                className="w-full bg-[#10121a] border border-[#222533] rounded-xl p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>

          <div className="text-[11px] text-zinc-400 bg-[#10121a] border border-[#222533] p-3 rounded-xl leading-relaxed">
            <span>Failure Description: </span>
            <strong className="text-zinc-300">{presets[failurePreset].reason}</strong>
          </div>

          {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#222533]">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer px-3.5 py-1.5 rounded-lg border border-[#222533] text-xs font-medium text-zinc-300 hover:bg-[#1a1d2b] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="cursor-pointer px-4 py-1.5 rounded-lg text-xs font-semibold text-zinc-950 bg-zinc-100 hover:bg-white border border-white transition-colors"
            >
              {isSubmitting ? 'Ingesting...' : 'Dispatch Event & Formulate Decision'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
