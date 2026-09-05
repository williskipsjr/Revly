import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  RotateCw,
  FileText,
  User,
  Cpu,
  Shield,
  Activity,
  Power
} from 'lucide-react';
import { AuditEvent as AuditEventType, MerchantInfo } from '../types/domain';
import { AuditEvent } from '../components/AuditEvent';

interface AuditViewProps {
  auditLogs: AuditEventType[];
  currentMerchant: MerchantInfo;
  onRefresh: () => void;
  loading?: boolean;
}

export const AuditView: React.FC<AuditViewProps> = ({
  auditLogs,
  currentMerchant,
  onRefresh,
  loading = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [actorFilter, setActorFilter] = useState('ALL');
  const [entityFilter, setEntityFilter] = useState('ALL');

  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      if (actorFilter !== 'ALL' && !log.actor.includes(actorFilter)) return false;
      if (entityFilter !== 'ALL' && log.entity !== entityFilter) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          log.id.toLowerCase().includes(q) ||
          log.event_type.toLowerCase().includes(q) ||
          log.details.toLowerCase().includes(q) ||
          (log.payment_id && log.payment_id.toLowerCase().includes(q)) ||
          log.entity_id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [auditLogs, searchTerm, actorFilter, entityFilter]);

  return (
    <div className="space-y-5 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222533] pb-4">
        <div>
          <span className="text-xs uppercase font-medium tracking-wider text-zinc-400">
            Immutable Regulatory Ledger · {currentMerchant.name}
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-[#fafafa] mt-0.5">
            Causal Audit Trail
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Append-only chronological record of all system decisions, policy evaluations, overrides, and automated executions.
          </p>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="cursor-pointer flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-[#222533] bg-[#151722] hover:bg-[#1a1d2b] hover:border-zinc-700 text-xs text-zinc-300 transition-all self-start sm:self-auto shadow-2xs"
        >
          <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-[#151722] border border-[#222533] rounded-2xl p-4 space-y-3 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-3 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by Payment, Decision ID, Action..."
              className="w-full bg-[#10121a] border border-[#222533] rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 font-sans"
            />
          </div>

          {/* Actor Filter */}
          <div>
            <select
              value={actorFilter}
              onChange={e => setActorFilter(e.target.value)}
              className="w-full bg-[#10121a] border border-[#222533] rounded-xl px-3.5 py-2 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500 font-sans cursor-pointer"
            >
              <option value="ALL">All Actors</option>
              <option value="Operator">Operator (Manual Overrides)</option>
              <option value="Policy Engine">Policy Engine</option>
              <option value="AI Diagnoser">AI Diagnoser</option>
              <option value="Executor">Executor</option>
              <option value="System">System / Ingestion</option>
            </select>
          </div>

          {/* Entity Filter */}
          <div>
            <select
              value={entityFilter}
              onChange={e => setEntityFilter(e.target.value)}
              className="w-full bg-[#10121a] border border-[#222533] rounded-xl px-3.5 py-2 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500 font-sans cursor-pointer"
            >
              <option value="ALL">All Entity Types</option>
              <option value="Payment">Payment</option>
              <option value="Decision">Decision</option>
              <option value="Policy">Policy</option>
              <option value="Action">Action</option>
              <option value="KillSwitch">Kill Switch</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Trail List */}
      <div className="bg-[#151722] border border-[#222533] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between text-xs text-zinc-400 pb-3 border-b border-[#222533]">
          <span>Showing <strong className="text-zinc-200">{filteredLogs.length}</strong> audit records</span>
          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-[#10121a] border border-[#222533]">Durable PostgreSQL event journal</span>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="py-14 text-center text-zinc-400 text-xs">
            <p className="text-sm font-medium text-zinc-300">No audit events match the selected criteria.</p>
            <p className="mt-1 text-zinc-500">Try adjusting your actor or entity filter.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredLogs.map(event => (
              <AuditEvent key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
