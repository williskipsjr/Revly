import React from 'react';

interface RecoveryMetricProps {
  id?: string;
  label: string;
  value: string;
  subtext?: string;
  trend?: {
    positive: boolean;
    text: string;
  };
  badge?: string;
  accent?: 'default' | 'success' | 'warning' | 'info';
  icon?: React.ReactNode;
}

export const RecoveryMetric: React.FC<RecoveryMetricProps> = ({
  id,
  label,
  value,
  subtext,
  trend,
  badge,
  accent = 'default',
  icon
}) => {
  const accentBorder = {
    default: 'border-[#222533] hover:border-[#2f3346]',
    success: 'border-[#222533] hover:border-emerald-500/30',
    warning: 'border-[#222533] hover:border-amber-500/30',
    info: 'border-[#222533] hover:border-zinc-600'
  }[accent];

  return (
    <div
      id={id}
      className={`relative bg-[#151722] border ${accentBorder} rounded-2xl p-5 sm:p-5.5 transition-all shadow-xs flex flex-col justify-between`}
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-xs font-medium text-zinc-400">
            {label}
          </span>
          <div className="flex items-center gap-1.5">
            {badge && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#1e2130] text-zinc-300 border border-[#2b2f42]">
                {badge}
              </span>
            )}
            {icon && <div className="text-zinc-400 shrink-0">{icon}</div>}
          </div>
        </div>

        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#fafafa] font-mono tabular-nums">
            {value}
          </span>
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-[#1d202d] flex items-center justify-between text-[11px] text-zinc-400">
        <span className="truncate pr-1">{subtext}</span>
        {trend && (
          <span
            className={`shrink-0 font-medium ${
              trend.positive ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {trend.text}
          </span>
        )}
      </div>
    </div>
  );
};
