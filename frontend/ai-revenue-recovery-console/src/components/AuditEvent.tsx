import React from 'react';
import { User, Cpu, Shield, Activity, Power } from 'lucide-react';
import { AuditEvent as AuditEventType } from '../types/domain';

interface AuditEventProps {
  id?: string;
  event: AuditEventType;
  compact?: boolean;
}

export const AuditEvent: React.FC<AuditEventProps> = ({ id, event, compact = false }) => {
  const actorIcon = (actor: string) => {
    if (actor.includes('Operator')) return <User size={13} className="text-amber-400" />;
    if (actor.includes('AI')) return <Cpu size={13} className="text-indigo-400" />;
    if (actor.includes('Policy')) return <Shield size={13} className="text-emerald-400" />;
    if (actor.includes('KillSwitch')) return <Power size={13} className="text-rose-400" />;
    return <Activity size={13} className="text-blue-400" />;
  };

  const actorBadgeColor = (actor: string) => {
    if (actor.includes('Operator')) return 'bg-amber-950/40 text-amber-300 border-amber-800/40';
    if (actor.includes('AI')) return 'bg-indigo-950/40 text-indigo-300 border-indigo-800/40';
    if (actor.includes('Policy')) return 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40';
    return 'bg-blue-950/40 text-blue-300 border-blue-800/40';
  };

  return (
    <div
      id={id}
      className="p-3.5 rounded-xl border border-[#222533] bg-[#10121a] hover:border-zinc-700 transition-all text-xs space-y-2 shadow-2xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${actorBadgeColor(
              event.actor
            )}`}
          >
            {actorIcon(event.actor)}
            <span>{event.actor}</span>
          </span>

          <span className="font-mono text-[11px] text-zinc-200 font-semibold">
            {event.event_type}
          </span>
        </div>

        <span className="text-[11px] font-mono text-zinc-400">
          {new Date(event.timestamp).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })}
        </span>
      </div>

      <p className="text-zinc-300 leading-relaxed pl-1">{event.details}</p>

      <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-400 pl-1 pt-1.5 border-t border-[#1f222e]">
        <span>
          Entity: <strong className="text-zinc-200">{event.entity}</strong> ({event.entity_id})
        </span>
        {event.payment_id && (
          <span>
            Payment: <strong className="text-zinc-200">{event.payment_id}</strong>
          </span>
        )}
      </div>
    </div>
  );
};
