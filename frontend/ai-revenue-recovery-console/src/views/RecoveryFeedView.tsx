import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  RotateCw,
  HelpCircle,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { Decision, MerchantInfo } from '../types/domain';
import { formatPaise } from '../lib/money';
import { DecisionStatus } from '../components/DecisionStatus';

interface RecoveryFeedViewProps {
  decisions: Decision[];
  currentMerchant: MerchantInfo;
  onSelectDecision: (decisionId: string) => void;
  onRefresh: () => void;
  loading?: boolean;
}

export const RecoveryFeedView: React.FC<RecoveryFeedViewProps> = ({
  decisions,
  currentMerchant,
  onSelectDecision,
  onRefresh,
  loading = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [policyFilter, setPolicyFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'time' | 'amount' | 'erv'>('time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Summary counts
  const counts = useMemo(() => {
    return {
      all: decisions.length,
      recovered: decisions.filter(d => d.recovery_state === 'RECOVERED').length,
      pending: decisions.filter(d => d.recovery_state === 'ACTION_PENDING').length,
      humanReview: decisions.filter(d => d.policy_result === 'HUMAN_REVIEW').length,
      stopped: decisions.filter(d => d.recovery_state === 'STOPPED').length
    };
  }, [decisions]);

  // Filtered and sorted decisions
  const filteredDecisions = useMemo(() => {
    return decisions
      .filter(d => {
        if (statusFilter !== 'ALL' && d.recovery_state !== statusFilter) return false;
        if (actionFilter !== 'ALL' && d.chosen_action !== actionFilter) return false;
        if (policyFilter !== 'ALL' && d.policy_result !== policyFilter) return false;

        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matches =
            d.id.toLowerCase().includes(q) ||
            d.payment_id.toLowerCase().includes(q) ||
            d.payment.customer.name?.toLowerCase().includes(q) ||
            d.diagnosis.root_cause.toLowerCase().includes(q) ||
            d.payment.failure_code.toLowerCase().includes(q);
          if (!matches) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortBy === 'time') {
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        } else if (sortBy === 'amount') {
          cmp = a.payment.amount - b.payment.amount;
        } else if (sortBy === 'erv') {
          cmp = a.erv_at_decision - b.erv_at_decision;
        }
        return sortOrder === 'desc' ? -cmp : cmp;
      });
  }, [decisions, searchTerm, statusFilter, actionFilter, policyFilter, sortBy, sortOrder]);

  const toggleSort = (field: 'time' | 'amount' | 'erv') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222533] pb-4">
        <div>
          <span className="text-xs uppercase font-medium tracking-wider text-zinc-500">
            Operator Work Queue · {currentMerchant.name}
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-[#fafafa] mt-0.5">
            Recovery Decision Feed
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Chronological log of evaluated payment failure events, causal diagnoses, and policy authorizations.
          </p>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="cursor-pointer flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#222533] bg-[#141620] hover:bg-[#1a1d2b] text-xs text-zinc-300 transition-all self-start sm:self-auto"
        >
          <RotateCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Feed</span>
        </button>
      </div>

      {/* Summary Filter Pills */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`cursor-pointer px-3.5 py-1.5 rounded-xl border font-medium transition-all ${
            statusFilter === 'ALL'
              ? 'bg-zinc-100 text-zinc-950 border-white shadow-xs font-semibold'
              : 'bg-[#141620] text-zinc-400 border-[#222533] hover:border-zinc-600 hover:text-zinc-200'
          }`}
        >
          All Events ({counts.all})
        </button>

        <button
          onClick={() => setStatusFilter('RECOVERED')}
          className={`cursor-pointer px-3.5 py-1.5 rounded-xl border font-medium transition-all ${
            statusFilter === 'RECOVERED'
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-xs font-semibold'
              : 'bg-[#141620] text-zinc-400 border-[#222533] hover:border-emerald-800/60 hover:text-zinc-200'
          }`}
        >
          Recovered ({counts.recovered})
        </button>

        <button
          onClick={() => setStatusFilter('ACTION_PENDING')}
          className={`cursor-pointer px-3.5 py-1.5 rounded-xl border font-medium transition-all ${
            statusFilter === 'ACTION_PENDING'
              ? 'bg-zinc-200 text-zinc-950 border-white shadow-xs font-semibold'
              : 'bg-[#141620] text-zinc-400 border-[#222533] hover:border-zinc-500 hover:text-zinc-200'
          }`}
        >
          Action Pending ({counts.pending})
        </button>

        <button
          onClick={() => {
            setStatusFilter('ALL');
            setPolicyFilter('HUMAN_REVIEW');
          }}
          className={`cursor-pointer px-3.5 py-1.5 rounded-xl border font-medium transition-all ${
            policyFilter === 'HUMAN_REVIEW'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-xs font-semibold'
              : 'bg-[#141620] text-zinc-400 border-[#222533] hover:border-amber-800/60 hover:text-zinc-200'
          }`}
        >
          Human Review ({counts.humanReview})
        </button>

        <button
          onClick={() => setStatusFilter('STOPPED')}
          className={`cursor-pointer px-3.5 py-1.5 rounded-xl border font-medium transition-all ${
            statusFilter === 'STOPPED'
              ? 'bg-zinc-800 text-zinc-200 border-zinc-700 shadow-xs font-semibold'
              : 'bg-[#141620] text-zinc-400 border-[#222533] hover:border-zinc-600 hover:text-zinc-200'
          }`}
        >
          Policy Stopped ({counts.stopped})
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-[#151722] border border-[#222533] rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-zinc-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by ID, Customer, Cause..."
              className="w-full bg-[#10121a] border border-[#222533] rounded-xl pl-8 pr-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
            />
          </div>

          {/* Status Dropdown */}
          <div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full bg-[#10121a] border border-[#222533] rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500 transition-colors"
            >
              <option value="ALL">All Recovery States</option>
              <option value="RECOVERED">RECOVERED</option>
              <option value="ACTION_PENDING">ACTION PENDING</option>
              <option value="RECOVERY_ELIGIBLE">RECOVERY ELIGIBLE</option>
              <option value="STOPPED">STOPPED (Policy)</option>
              <option value="FAILED">FAILED</option>
            </select>
          </div>

          {/* Action Dropdown */}
          <div>
            <select
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              className="w-full bg-[#10121a] border border-[#222533] rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500 transition-colors"
            >
              <option value="ALL">All Candidate Actions</option>
              <option value="delayed_retry">Delayed Retry</option>
              <option value="payment_link">Payment Link</option>
              <option value="alternate_method">Alternate Method</option>
              <option value="reminder">Reminder Push</option>
              <option value="retry">Immediate Retry</option>
              <option value="escalate">Escalate</option>
              <option value="no_action">No Action</option>
            </select>
          </div>

          {/* Policy Result */}
          <div>
            <select
              value={policyFilter}
              onChange={e => setPolicyFilter(e.target.value)}
              className="w-full bg-[#10121a] border border-[#222533] rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500 transition-colors"
            >
              <option value="ALL">All Policy Results</option>
              <option value="ALLOW">ALLOW</option>
              <option value="BLOCK">BLOCK</option>
              <option value="HUMAN_REVIEW">HUMAN REVIEW</option>
            </select>
          </div>
        </div>
      </div>

      {/* Dense Table */}
      <div className="bg-[#151722] border border-[#222533] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#222533] bg-[#10121a] text-zinc-400 uppercase font-mono text-[11px]">
                <th className="py-3 px-3.5">
                  <span className="cursor-pointer flex items-center gap-1" onClick={() => toggleSort('time')}>
                    Decision / Time
                    <ArrowUpDown size={12} />
                  </span>
                </th>
                <th className="py-3 px-3.5">Customer &amp; Payment ID</th>
                <th className="py-3 px-3.5">
                  <span className="cursor-pointer flex items-center gap-1" onClick={() => toggleSort('amount')}>
                    Amount
                    <ArrowUpDown size={12} />
                  </span>
                </th>
                <th className="py-3 px-3.5">Diagnosis Root Cause</th>
                <th className="py-3 px-3.5">Chosen Action</th>
                <th className="py-3 px-3.5">
                  <span className="cursor-pointer flex items-center gap-1" onClick={() => toggleSort('erv')}>
                    ERV
                    <ArrowUpDown size={12} />
                  </span>
                </th>
                <th className="py-3 px-3.5">Policy</th>
                <th className="py-3 px-3.5">Recovery State</th>
                <th className="py-3 px-3.5 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f222e] font-sans">
              {filteredDecisions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-zinc-400">
                    <p className="text-sm font-medium text-zinc-300">No recovery decisions match these filters.</p>
                    <p className="text-xs text-zinc-400 mt-1">Try clearing your search query or selecting "All Events".</p>
                  </td>
                </tr>
              ) : (
                filteredDecisions.map(decision => {
                  const customerInitials = (decision.payment.customer.name || 'User')
                    .split(' ')
                    .map(w => w[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  return (
                    <tr
                      key={decision.id}
                      onClick={() => onSelectDecision(decision.id)}
                      className="hover:bg-[#1a1c27] cursor-pointer transition-colors group"
                    >
                      <td className="py-3.5 px-3.5">
                        <div className="font-mono font-semibold text-zinc-200 group-hover:underline underline-offset-2">
                          {decision.id}
                        </div>
                        <div className="text-[11px] font-mono text-zinc-400">
                          {new Date(decision.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      <td className="py-3.5 px-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-full bg-[#202332] border border-[#2d3248] flex items-center justify-center text-[10px] font-bold text-zinc-300 shrink-0">
                            {customerInitials}
                          </div>
                          <div>
                            <div className="font-medium text-zinc-200">{decision.payment.customer.name}</div>
                            <div className="text-[11px] text-zinc-400 font-mono">
                              {decision.payment_id} · {decision.payment.method}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3.5 font-mono font-semibold text-[#fafafa]">
                        {formatPaise(decision.payment.amount)}
                      </td>

                      <td className="py-3.5 px-3.5 max-w-xs truncate">
                        <span className="text-zinc-200">{decision.diagnosis.root_cause}</span>
                        <span className="text-[11px] text-zinc-400 block font-mono">
                          Conf: {Math.round(decision.diagnosis.confidence * 100)}%
                        </span>
                      </td>

                      <td className="py-3.5 px-3.5 font-mono uppercase text-zinc-300">
                        {decision.chosen_action.replace('_', ' ')}
                      </td>

                      <td className="py-3.5 px-3.5 font-mono font-semibold text-emerald-400">
                        {formatPaise(decision.erv_at_decision)}
                      </td>

                      <td className="py-3.5 px-3.5">
                        <DecisionStatus type="policy" value={decision.policy_result} size="sm" />
                      </td>

                      <td className="py-3.5 px-3.5">
                        <DecisionStatus type="state" value={decision.recovery_state} size="sm" />
                      </td>

                      <td className="py-3.5 px-3.5 text-right">
                        <div className="w-7 h-7 rounded-lg bg-[#141620] border border-[#222533] flex items-center justify-center text-zinc-400 group-hover:text-zinc-100 group-hover:border-zinc-600 transition-colors ml-auto">
                          <ChevronRight size={15} />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
