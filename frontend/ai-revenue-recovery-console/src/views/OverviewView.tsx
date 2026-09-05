import React, { useState } from 'react';
import {
  TrendingUp,
  Shield,
  AlertTriangle,
  ArrowUpRight,
  Zap,
  Clock,
  Sparkles,
  Info,
  PlayCircle,
  RotateCw
} from 'lucide-react';
import { RecoverySummaryMetrics, Decision, MerchantInfo } from '../types/domain';
import { formatPaise, formatPercentage, formatCount } from '../lib/money';
import { RecoveryMetric } from '../components/RecoveryMetric';
import { DecisionStatus } from '../components/DecisionStatus';

interface OverviewViewProps {
  metrics: RecoverySummaryMetrics;
  recentDecisions: Decision[];
  currentMerchant: MerchantInfo;
  onSelectDecision: (decisionId: string) => void;
  onOpenSimulate: () => void;
  aiDegraded: boolean;
  onToggleAiDegraded: () => void;
  onRefresh: () => void;
  loading?: boolean;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  metrics,
  recentDecisions,
  currentMerchant,
  onSelectDecision,
  onOpenSimulate,
  aiDegraded,
  onToggleAiDegraded,
  onRefresh,
  loading = false
}) => {
  const [hoveredTrendIdx, setHoveredTrendIdx] = useState<number | null>(null);
  const [timeFilter, setTimeFilter] = useState<'all' | '1y' | '1m' | '1w' | '1d'>('all');
  const [currencyMode, setCurrencyMode] = useState<'INR' | 'USD'>('INR');

  // SVG Trend Calculations
  const trendData = metrics.trend || [];
  const maxRisk = Math.max(...trendData.map(t => t.revenue_at_risk), 1);
  const chartHeight = 170;
  const chartWidth = 620;
  const paddingX = 35;
  const paddingY = 24;

  const getPoints = (key: 'revenue_at_risk' | 'recovered') => {
    if (trendData.length === 0) return '';
    return trendData
      .map((d, i) => {
        const x = paddingX + (i / (trendData.length - 1)) * (chartWidth - paddingX * 2);
        const y = chartHeight - paddingY - (d[key] / maxRisk) * (chartHeight - paddingY * 2);
        return `${x},${y}`;
      })
      .join(' ');
  };

  const getAreaPoints = (key: 'recovered') => {
    if (trendData.length === 0) return '';
    const points = trendData.map((d, i) => {
      const x = paddingX + (i / (trendData.length - 1)) * (chartWidth - paddingX * 2);
      const y = chartHeight - paddingY - (d[key] / maxRisk) * (chartHeight - paddingY * 2);
      return `${x},${y}`;
    });
    const firstX = paddingX;
    const lastX = chartWidth - paddingX;
    const bottomY = chartHeight - paddingY;
    return `${firstX},${bottomY} ${points.join(' ')} ${lastX},${bottomY}`;
  };

  const riskPoints = getPoints('revenue_at_risk');
  const recoveredPoints = getPoints('recovered');
  const recoveredAreaPoints = getAreaPoints('recovered');

  return (
    <div className="space-y-6 pb-12">
      {/* Simulation & Degraded AI Banners */}
      <div className="space-y-2">
        {/* Simulation disclosure */}
        <div className="flex items-center justify-between text-xs bg-[#151722] border border-[#222533] rounded-2xl px-4 py-2.5 text-zinc-400">
          <div className="flex items-center gap-2.5">
            <Info size={14} className="text-zinc-400 shrink-0" />
            <span>
              <strong className="text-zinc-200">Simulation sandbox</strong> — Decision engine evaluated against durable state in a sandboxed runtime.
            </span>
          </div>
          <span className="text-[11px] font-mono text-zinc-400 shrink-0 hidden sm:inline">
            PostgreSQL Durable State · Go Engine
          </span>
        </div>

        {/* Degraded AI Resilience Banner */}
        {aiDegraded ? (
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-amber-950/20 border border-amber-600/40 rounded-2xl px-4 py-2.5 text-amber-200">
            <div className="flex items-center gap-2.5">
              <AlertTriangle size={15} className="text-amber-400 shrink-0" />
              <div>
                <span className="font-semibold text-amber-100">AI Resilience Mode Active:</span> Fallback deterministic rule policy is safely engaged.
              </div>
            </div>
            <button
              onClick={onToggleAiDegraded}
              className="cursor-pointer text-[11px] font-medium px-2.5 py-1 rounded-xl bg-amber-900/50 text-amber-200 hover:bg-amber-800/80 border border-amber-700/60 transition-all"
            >
              Restore Normal AI Mode
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>AI Intelligence: Active &amp; Online (Gemini Pro Fintech Engine)</span>
            </div>
            <button
              onClick={onToggleAiDegraded}
              className="cursor-pointer text-[11px] text-zinc-400 hover:text-amber-400 underline decoration-dotted transition-colors"
              title="Test the system's graceful degradation to deterministic rule-based fallbacks"
            >
              Simulate AI Service Degradation
            </button>
          </div>
        )}
      </div>

      {/* Page Header with Time Filters and Currency Toggle (Reference Image 1 & 2) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#222533] pb-4">
        <div>
          <span className="text-xs uppercase font-medium tracking-wider text-zinc-400">
            Operations Cockpit · {currentMerchant.name}
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#fafafa] mt-0.5 font-sans">
            Revenue Recovery Overview
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time economic risk arbitration, probabilistic diagnosis, and deterministic safety policy.
          </p>
        </div>

        {/* Currency & Time Filters (Reference Image 2) */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="flex items-center p-0.5 rounded-xl bg-[#141620] border border-[#222533] text-xs font-mono">
            <button
              onClick={() => setCurrencyMode('INR')}
              className={`cursor-pointer px-2.5 py-1 rounded-lg transition-all ${
                currencyMode === 'INR'
                  ? 'bg-zinc-200 text-zinc-950 font-bold dark:bg-zinc-100 light:bg-[#00a8b5] light:text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              INR ₹
            </button>
            <button
              onClick={() => setCurrencyMode('USD')}
              className={`cursor-pointer px-2.5 py-1 rounded-lg transition-all ${
                currencyMode === 'USD'
                  ? 'bg-zinc-200 text-zinc-950 font-bold dark:bg-zinc-100 light:bg-[#00a8b5] light:text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              USD $
            </button>
          </div>

          <div className="flex items-center p-0.5 rounded-xl bg-[#141620] border border-[#222533] text-xs">
            {(['all', '1y', '1m', '1w', '1d'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTimeFilter(t)}
                className={`cursor-pointer px-2 py-1 rounded-lg uppercase text-[10px] font-semibold tracking-wider transition-all ${
                  timeFilter === t
                    ? 'bg-zinc-700 text-white dark:bg-zinc-700 light:bg-[#00a8b5] light:text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {t === 'all' ? 'All time' : t}
              </button>
            ))}
          </div>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="cursor-pointer p-2 rounded-xl border border-[#222533] bg-[#141620] hover:bg-[#1a1d2b] text-zinc-300 transition-all"
            title="Refresh recovery metrics"
          >
            <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={onOpenSimulate}
            className="cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold tracking-wide border border-white shadow-xs transition-all"
          >
            <PlayCircle size={15} />
            <span>Simulate Failure</span>
          </button>
        </div>
      </div>

      {/* Hero Metric Grid (4 high value metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <RecoveryMetric
          id="metric-revenue-at-risk"
          label="Revenue at Risk"
          value={formatPaise(metrics.revenue_at_risk, { compact: true })}
          subtext="Evaluated failure volume"
          accent="warning"
          icon={<AlertTriangle size={16} className="text-amber-400" />}
        />

        <RecoveryMetric
          id="metric-recoverable-revenue"
          label="Recoverable Revenue"
          value={formatPaise(metrics.recoverable_revenue, { compact: true })}
          subtext={`${Math.round((metrics.recoverable_revenue / metrics.revenue_at_risk) * 100)}% viable for intervention`}
          accent="info"
          icon={<Zap size={16} className="text-zinc-400" />}
        />

        <RecoveryMetric
          id="metric-recovered-revenue"
          label="Recovered Revenue"
          value={formatPaise(metrics.recovered_revenue, { compact: true })}
          subtext="Actual cleared capital"
          trend={{ positive: true, text: '+₹14.2k today' }}
          accent="success"
          icon={<ArrowUpRight size={16} className="text-emerald-400" />}
        />

        <RecoveryMetric
          id="metric-recovery-rate"
          label="Recovery Rate"
          value={`${metrics.recovery_rate}%`}
          subtext="Overall conversion rate"
          badge="High Efficiency"
          accent="default"
          icon={<TrendingUp size={16} className="text-emerald-400" />}
        />
      </div>

      {/* Overview Quick Stats Bar (Reference Image 1: Total, Active, Idle, Maintenance) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3 rounded-2xl bg-[#151722] border border-[#222533] flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-semibold text-zinc-400 block tracking-wider">Total Decisions</span>
            <span className="text-xl font-bold font-mono text-[#fafafa] mt-0.5 block">{metrics.active_interventions + 46}</span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#10121a] border border-[#222533] text-zinc-400 font-mono">100%</span>
        </div>

        <div className="p-3 rounded-2xl bg-[#151722] border border-[#222533] flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-semibold text-zinc-400 block tracking-wider">Active Retry</span>
            <span className="text-xl font-bold font-mono text-emerald-400 mt-0.5 block">{metrics.active_interventions}</span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono">Auto</span>
        </div>

        <div className="p-3 rounded-2xl bg-[#151722] border border-[#222533] flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-semibold text-zinc-400 block tracking-wider">Avoided Spam</span>
            <span className="text-xl font-bold font-mono text-cyan-400 mt-0.5 block">{metrics.retries_avoided}</span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono">Saved</span>
        </div>

        <div className="p-3 rounded-2xl bg-[#151722] border border-[#222533] flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-semibold text-zinc-400 block tracking-wider">Cost / Rec ₹</span>
            <span className="text-xl font-bold font-mono text-zinc-200 mt-0.5 block">₹{metrics.cost_per_recovered_rupee.toFixed(2)}</span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#10121a] border border-[#222533] text-zinc-400 font-mono">Optimal</span>
        </div>

        <div className="p-3 rounded-2xl bg-[#151722] border border-[#222533] flex items-center justify-between col-span-2 sm:col-span-1">
          <div>
            <span className="text-[10px] uppercase font-semibold text-zinc-400 block tracking-wider">Escalations</span>
            <span className="text-xl font-bold font-mono text-amber-400 mt-0.5 block">{metrics.false_positive_escalations}</span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono">Low</span>
        </div>
      </div>

      {/* Main Charts & Breakdown Section (Reference Image 1 & 2) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recovery Trend Chart with Glowing Gradient Area (2 Cols) */}
        <div className="lg:col-span-2 bg-[#151722] border border-[#222533] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#222533] pb-4">
            <div>
              <span className="text-xs uppercase font-medium tracking-wider text-zinc-400">
                Performance Over Time · Global Progress
              </span>
              <h3 className="text-base font-semibold text-[#fafafa] mt-0.5 font-sans">
                Revenue at Risk vs Recovered Volume
              </h3>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="text-zinc-400">At Risk</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 light:bg-[#00a8b5]" />
                <span className="text-zinc-300">Recovered</span>
              </div>
            </div>
          </div>

          {/* SVG Chart Container */}
          <div className="relative w-full overflow-hidden pt-2">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-44 sm:h-52 overflow-visible"
            >
              <defs>
                <linearGradient id="recoveredGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="recoveredTealGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Background gridlines */}
              <line x1={paddingX} y1={paddingY} x2={chartWidth - paddingX} y2={paddingY} stroke="var(--chart-grid)" strokeDasharray="3,3" />
              <line x1={paddingX} y1={chartHeight / 2} x2={chartWidth - paddingX} y2={chartHeight / 2} stroke="var(--chart-grid)" strokeDasharray="3,3" />
              <line x1={paddingX} y1={chartHeight - paddingY} x2={chartWidth - paddingX} y2={chartHeight - paddingY} stroke="var(--chart-grid)" />

              {/* Area fill for recovered */}
              <polygon
                fill="url(#recoveredGradient)"
                points={recoveredAreaPoints}
                className="transition-all"
              />

              {/* Polylines with smooth curves */}
              <polyline
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={riskPoints}
                className="opacity-70"
              />
              <polyline
                fill="none"
                stroke="#10b981"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={recoveredPoints}
              />

              {/* Data points */}
              {trendData.map((d, i) => {
                const x = paddingX + (i / (trendData.length - 1)) * (chartWidth - paddingX * 2);
                const yRisk = chartHeight - paddingY - (d.revenue_at_risk / maxRisk) * (chartHeight - paddingY * 2);
                const yRec = chartHeight - paddingY - (d.recovered / maxRisk) * (chartHeight - paddingY * 2);
                const isHovered = hoveredTrendIdx === i;

                return (
                  <g key={i} onMouseEnter={() => setHoveredTrendIdx(i)} onMouseLeave={() => setHoveredTrendIdx(null)}>
                    {isHovered && (
                      <line x1={x} y1={paddingY} x2={x} y2={chartHeight - paddingY} stroke="#52525b" strokeWidth="1" strokeDasharray="2,2" />
                    )}
                    <circle cx={x} cy={yRisk} r={isHovered ? 5 : 3} fill="#f59e0b" className="transition-all cursor-pointer" />
                    <circle cx={x} cy={yRec} r={isHovered ? 6 : 4} fill="#10b981" className="transition-all cursor-pointer shadow-md" />
                  </g>
                );
              })}
            </svg>

            {/* X-axis labels */}
            <div className="flex justify-between text-[11px] font-mono text-zinc-400 px-3 pt-2">
              {trendData.map((d, idx) => (
                <span key={idx} className={hoveredTrendIdx === idx ? 'text-zinc-200 font-bold' : ''}>
                  {d.label}
                </span>
              ))}
            </div>

            {/* Hover details badge */}
            {hoveredTrendIdx !== null && trendData[hoveredTrendIdx] && (
              <div className="absolute top-2 right-4 bg-[#10121a] border border-[#222533] rounded-2xl p-3 text-xs shadow-xl space-y-1 font-mono">
                <div className="text-zinc-400 font-semibold">{trendData[hoveredTrendIdx].label}</div>
                <div className="text-amber-400">At Risk: {formatPaise(trendData[hoveredTrendIdx].revenue_at_risk)}</div>
                <div className="text-emerald-400">Recovered: {formatPaise(trendData[hoveredTrendIdx].recovered)}</div>
              </div>
            )}
          </div>
        </div>

        {/* RECOVERY HEALTH SCORE & BREAKDOWN (Exact match to Reference Image 1 & 2!) */}
        <div className="bg-[#151722] border border-[#222533] rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-xs">
          <div className="border-b border-[#222533] pb-3">
            <span className="text-xs uppercase font-medium tracking-wider text-zinc-400">
              System Health &amp; Conversion
            </span>
            <h3 className="text-base font-semibold text-[#fafafa] mt-0.5">
              Recovery Health Score
            </h3>
          </div>

          {/* Semicircular Score Gauge (Reference Image 1: 76/100 Good) */}
          <div className="flex flex-col items-center justify-center my-3 relative">
            <svg className="w-48 h-28 overflow-visible" viewBox="0 0 160 90">
              {/* Background Arc */}
              <path
                d="M 20 80 A 60 60 0 0 1 140 80"
                fill="none"
                stroke="currentColor"
                strokeWidth="12"
                className="text-zinc-800/60 light:text-slate-200"
                strokeLinecap="round"
              />
              {/* Filled Health Arc (Score = 78%) */}
              <path
                d="M 20 80 A 60 60 0 0 1 140 80"
                fill="none"
                stroke="#10b981"
                strokeWidth="12"
                strokeDasharray="188.5"
                strokeDashoffset={188.5 * (1 - 0.78)}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute bottom-1 text-center">
              <div className="text-3xl font-extrabold font-mono text-[#fafafa] tracking-tight">
                78<span className="text-base text-zinc-400 font-normal">/100</span>
              </div>
              <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                Optimal
              </div>
            </div>
          </div>

          {/* Health Score Breakdown Donut / List (Image 1 & 2) */}
          <div className="border-t border-[#222533] pt-3 space-y-1.5 text-xs">
            <div className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider mb-2">
              Health Score Breakdown
            </div>
            <div className="flex items-center justify-between text-zinc-300">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Excellent (80–100)</span>
              </div>
              <span className="font-mono text-zinc-400 font-medium">24 (41%)</span>
            </div>
            <div className="flex items-center justify-between text-zinc-300">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-400" />
                <span>Good (60–79)</span>
              </div>
              <span className="font-mono text-zinc-400 font-medium">18 (31%)</span>
            </div>
            <div className="flex items-center justify-between text-zinc-300">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Fair (40–59)</span>
              </div>
              <span className="font-mono text-zinc-400 font-medium">9 (16%)</span>
            </div>
            <div className="flex items-center justify-between text-zinc-300">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                <span>Critical / Escalated</span>
              </div>
              <span className="font-mono text-zinc-400 font-medium">2 (3%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Intervention Performance Summary */}
      <div className="bg-[#151722] border border-[#222533] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#222533] pb-4">
          <div>
            <span className="text-xs uppercase font-medium tracking-wider text-zinc-400">
              Intervention Analytics &amp; Conversion
            </span>
            <h3 className="text-base font-semibold text-[#fafafa] mt-0.5">
              Candidate Action Effectiveness &amp; Win Rate
            </h3>
          </div>
          <span className="text-xs text-zinc-400 font-mono">
            Measured against {metrics.active_interventions + 46} evaluated payment failure states
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {metrics.interventions.map(action => (
            <div
              key={action.action_type}
              className="p-4 rounded-2xl border border-[#222533] bg-[#10121a] hover:border-zinc-700 transition-all text-xs space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-zinc-200">{action.label}</span>
                <span className="font-mono text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px]">
                  {action.recovery_rate}% win
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                <span>{action.recovered_count} / {action.attempts} attempts</span>
                <span className="text-zinc-200 font-semibold">{formatPaise(action.recovered_value, { compact: true })}</span>
              </div>

              {/* mini progress bar */}
              <div className="w-full bg-[#1c1e2b] rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-400 light:bg-[#00a8b5] h-full rounded-full transition-all"
                  style={{ width: `${action.recovery_rate}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Recovery Feed Activity */}
      <div className="bg-[#151722] border border-[#222533] rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#222533] pb-4">
          <div>
            <span className="text-xs uppercase font-medium tracking-wider text-zinc-400">
              Real-time Ingestion Stream
            </span>
            <h3 className="text-base font-semibold text-[#fafafa] mt-0.5">
              Recent Recovery Decisions
            </h3>
          </div>

          <span className="text-xs text-zinc-400 font-mono">
            Click row to inspect decision trace
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#222533] text-zinc-400 uppercase font-mono text-[11px]">
                <th className="py-3 px-3.5">Decision ID</th>
                <th className="py-3 px-3.5">Customer &amp; Payment</th>
                <th className="py-3 px-3.5">Amount</th>
                <th className="py-3 px-3.5">Diagnosis</th>
                <th className="py-3 px-3.5">Chosen Action</th>
                <th className="py-3 px-3.5">Policy</th>
                <th className="py-3 px-3.5">Recovery State</th>
                <th className="py-3 px-3.5 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f222e] font-sans">
              {recentDecisions.map(decision => {
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
                    <td className="py-3.5 px-3.5 font-mono font-semibold text-zinc-200 group-hover:underline underline-offset-2">
                      {decision.id}
                    </td>
                    <td className="py-3.5 px-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-[#202332] border border-[#2d3248] flex items-center justify-center text-[10px] font-bold text-zinc-300 shrink-0">
                          {customerInitials}
                        </div>
                        <div>
                          <div className="font-medium text-zinc-200">{decision.payment.customer.name}</div>
                          <div className="text-[11px] text-zinc-400 font-mono">{decision.payment_id} · {decision.payment.method}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3.5 font-mono font-semibold text-[#fafafa]">
                      {formatPaise(decision.payment.amount)}
                    </td>
                    <td className="py-3.5 px-3.5 max-w-xs truncate text-zinc-300">
                      {decision.diagnosis.root_cause}
                    </td>
                    <td className="py-3.5 px-3.5 font-mono uppercase text-zinc-300">
                      {decision.chosen_action.replace('_', ' ')}
                    </td>
                    <td className="py-3.5 px-3.5">
                      <DecisionStatus type="policy" value={decision.policy_result} size="sm" />
                    </td>
                    <td className="py-3.5 px-3.5">
                      <DecisionStatus type="state" value={decision.recovery_state} size="sm" />
                    </td>
                    <td className="py-3.5 px-3.5 text-right font-mono text-zinc-400 text-[11px]">
                      {new Date(decision.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
