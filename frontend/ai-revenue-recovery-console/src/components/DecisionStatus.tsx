import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  HelpCircle,
  Ban,
  RotateCw
} from 'lucide-react';
import { RecoveryState, PolicyCheckResult, ActionStatus } from '../types/domain';

interface DecisionStatusProps {
  id?: string;
  type: 'state' | 'policy' | 'action_status';
  value: RecoveryState | PolicyCheckResult | ActionStatus | string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const DecisionStatus: React.FC<DecisionStatusProps> = ({
  id,
  type,
  value,
  size = 'md',
  showIcon = true
}) => {
  const sizeClasses = {
    sm: 'text-[11px] px-2.5 py-0.5 gap-1.5',
    md: 'text-xs px-3 py-1 gap-1.5',
    lg: 'text-xs px-3.5 py-1.5 gap-2'
  }[size];

  const iconSize = {
    sm: 11,
    md: 13,
    lg: 14
  }[size];

  // Policy results
  if (type === 'policy') {
    switch (value) {
      case 'ALLOW':
        return (
          <span
            id={id}
            className={`inline-flex items-center font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 whitespace-nowrap ${sizeClasses}`}
          >
            {showIcon && <ShieldCheck size={iconSize} className="text-emerald-400 shrink-0" />}
            <span>ALLOW</span>
          </span>
        );
      case 'BLOCK':
        return (
          <span
            id={id}
            className={`inline-flex items-center font-medium rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 whitespace-nowrap ${sizeClasses}`}
          >
            {showIcon && <Ban size={iconSize} className="text-rose-400 shrink-0" />}
            <span>BLOCK</span>
          </span>
        );
      case 'HUMAN_REVIEW':
        return (
          <span
            id={id}
            className={`inline-flex items-center font-medium rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 whitespace-nowrap ${sizeClasses}`}
          >
            {showIcon && <UserCheck size={iconSize} className="text-amber-400 shrink-0" />}
            <span>HUMAN REVIEW</span>
          </span>
        );
      default:
        return (
          <span
            id={id}
            className={`inline-flex items-center font-medium rounded-full bg-[#181a24] text-zinc-300 border border-[#262836] whitespace-nowrap ${sizeClasses}`}
          >
            {value}
          </span>
        );
    }
  }

  // Action status
  if (type === 'action_status') {
    switch (value) {
      case 'confirmed':
        return (
          <span
            id={id}
            className={`inline-flex items-center font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 whitespace-nowrap ${sizeClasses}`}
          >
            {showIcon && <CheckCircle2 size={iconSize} className="text-emerald-400 shrink-0" />}
            <span>Confirmed</span>
          </span>
        );
      case 'pending_confirmation':
        return (
          <span
            id={id}
            className={`inline-flex items-center font-medium rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 whitespace-nowrap ${sizeClasses}`}
            title="Outcome pending confirmation — awaiting reconciliation rather than blind retry"
          >
            {showIcon && <HelpCircle size={iconSize} className="text-amber-400 shrink-0 animate-pulse" />}
            <span>Pending Confirmation</span>
          </span>
        );
      case 'pending':
        return (
          <span
            id={id}
            className={`inline-flex items-center font-medium rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/30 whitespace-nowrap ${sizeClasses}`}
          >
            {showIcon && <Clock size={iconSize} className="text-sky-400 shrink-0" />}
            <span>Pending</span>
          </span>
        );
      case 'failed':
        return (
          <span
            id={id}
            className={`inline-flex items-center font-medium rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 whitespace-nowrap ${sizeClasses}`}
          >
            {showIcon && <XCircle size={iconSize} className="text-rose-400 shrink-0" />}
            <span>Failed</span>
          </span>
        );
    }
  }

  // Canonical Recovery State
  switch (value) {
    case 'RECOVERED':
    case 'DONE':
      return (
        <span
          id={id}
          className={`inline-flex items-center font-medium tracking-normal rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 whitespace-nowrap ${sizeClasses}`}
        >
          {showIcon && <CheckCircle2 size={iconSize} className="text-emerald-400 shrink-0" />}
          <span>Recovered</span>
        </span>
      );

    case 'ACTION_PENDING':
      return (
        <span
          id={id}
          className={`inline-flex items-center font-medium tracking-normal rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/30 whitespace-nowrap ${sizeClasses}`}
        >
          {showIcon && <Clock size={iconSize} className="text-sky-400 shrink-0 animate-pulse" />}
          <span>Action Pending</span>
        </span>
      );

    case 'ACTION_SELECTED':
    case 'RECOVERY_ELIGIBLE':
      return (
        <span
          id={id}
          className={`inline-flex items-center font-medium tracking-normal rounded-full bg-zinc-500/10 text-zinc-300 border border-zinc-700/60 whitespace-nowrap ${sizeClasses}`}
        >
          {showIcon && <RotateCw size={iconSize} className="text-zinc-400 shrink-0" />}
          <span>{String(value).replace('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</span>
        </span>
      );

    case 'DIAGNOSED':
      return (
        <span
          id={id}
          className={`inline-flex items-center font-medium tracking-normal rounded-full bg-zinc-500/10 text-zinc-300 border border-zinc-700/60 whitespace-nowrap ${sizeClasses}`}
        >
          {showIcon && <Clock size={iconSize} className="text-zinc-400 shrink-0" />}
          <span>Diagnosed</span>
        </span>
      );

    case 'RE_EVALUATE':
      return (
        <span
          id={id}
          className={`inline-flex items-center font-medium tracking-normal rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 whitespace-nowrap ${sizeClasses}`}
        >
          {showIcon && <AlertTriangle size={iconSize} className="text-amber-400 shrink-0" />}
          <span>Re-Evaluate</span>
        </span>
      );

    case 'STOPPED':
      return (
        <span
          id={id}
          className={`inline-flex items-center font-medium tracking-normal rounded-full bg-zinc-700/20 text-zinc-400 border border-zinc-700/50 whitespace-nowrap ${sizeClasses}`}
        >
          {showIcon && <Ban size={iconSize} className="text-zinc-400 shrink-0" />}
          <span>Stopped</span>
        </span>
      );

    case 'FAILED':
      return (
        <span
          id={id}
          className={`inline-flex items-center font-medium tracking-normal rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 whitespace-nowrap ${sizeClasses}`}
        >
          {showIcon && <XCircle size={iconSize} className="text-rose-400 shrink-0" />}
          <span>Failed</span>
        </span>
      );

    default:
      return (
        <span
          id={id}
          className={`inline-flex items-center font-medium rounded-full bg-[#181a24] text-zinc-300 border border-[#262836] whitespace-nowrap ${sizeClasses}`}
        >
          {value}
        </span>
      );
  }
};
