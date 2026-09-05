import React, { useState } from 'react';
import {
  LayoutDashboard,
  Inbox,
  ShieldCheck,
  FileSpreadsheet,
  Building2,
  ChevronDown,
  PlayCircle,
  Menu,
  X,
  Search,
  Bell,
  Clock,
  Sparkles,
  Zap,
  ChevronsLeft,
  Server,
  Sun,
  Moon
} from 'lucide-react';
import { MerchantInfo } from '../types/domain';
import { ApiMode } from '../lib/api/client';
import { useTheme } from '../lib/theme';

export type NavigationTab = 'overview' | 'feed' | 'decision' | 'policy' | 'audit';

interface AppShellProps {
  activeTab: NavigationTab;
  onNavigate: (tab: NavigationTab) => void;
  merchants: MerchantInfo[];
  currentMerchant: MerchantInfo;
  onSelectMerchant: (merchant: MerchantInfo) => void;
  onOpenSimulate: () => void;
  onOpenBackendSettings: () => void;
  apiMode: ApiMode;
  aiDegraded: boolean;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeTab,
  onNavigate,
  merchants,
  currentMerchant,
  onSelectMerchant,
  onOpenSimulate,
  onOpenBackendSettings,
  apiMode,
  aiDegraded,
  children
}) => {
  const { theme, toggleTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMerchantDropdownOpen, setIsMerchantDropdownOpen] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');

  const navItems = [
    {
      group: 'MENU',
      items: [
        { id: 'overview' as NavigationTab, label: 'Overview', icon: <LayoutDashboard size={16} /> },
        { id: 'feed' as NavigationTab, label: 'Recovery Feed', icon: <Inbox size={16} /> }
      ]
    },
    {
      group: 'CONFIGURATION',
      items: [
        { id: 'policy' as NavigationTab, label: 'Merchant Policy', icon: <ShieldCheck size={16} /> }
      ]
    },
    {
      group: 'SYSTEM',
      items: [
        { id: 'audit' as NavigationTab, label: 'Audit Trail', icon: <FileSpreadsheet size={16} /> }
      ]
    }
  ];

  return (
    <div className="flex h-screen bg-[#0c0d14] text-[#fafafa] overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-[#222533] bg-[#0f1017] shrink-0">
        {/* Brand Header */}
        <div className="p-5 border-b border-[#222533] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-2xl bg-amber-500 text-zinc-950 flex items-center justify-center font-bold text-sm shadow-md shadow-amber-500/20">
              <Zap size={16} className="text-zinc-950 fill-zinc-950" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-[#fafafa] font-sans">
                Revly
              </div>
              <div className="text-[10px] text-zinc-400 font-medium tracking-wide">
                Revenue Recovery
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className="cursor-pointer text-zinc-400 hover:text-zinc-200 transition-colors p-1.5 rounded-xl hover:bg-[#141620]"
              title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun size={15} className="text-amber-400" />
              ) : (
                <Moon size={15} className="text-cyan-400" />
              )}
            </button>
            <button
              className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
              title="Collapse sidebar"
            >
              <ChevronsLeft size={16} />
            </button>
          </div>
        </div>

        {/* Quick Search */}
        <div className="px-3.5 pt-3.5">
          <div className="relative">
            <Search size={13} className="absolute left-3.5 top-2.5 text-zinc-500" />
            <input
              type="text"
              value={sidebarSearch}
              onChange={e => setSidebarSearch(e.target.value)}
              placeholder="Search Anything..."
              className="w-full bg-[#141620] border border-[#222533] rounded-2xl pl-9 pr-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-all"
            />
          </div>
        </div>

        {/* Navigation Groups */}
        <div className="flex-1 py-3 px-3 space-y-4 overflow-y-auto">
          {navItems.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              <div className="px-3 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
                {group.group}
              </div>
              {group.items
                .filter(item =>
                  !sidebarSearch.trim() ||
                  item.label.toLowerCase().includes(sidebarSearch.toLowerCase())
                )
                .map(item => {
                  const isActive = activeTab === item.id || (item.id === 'feed' && activeTab === 'decision');
                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavigate(item.id)}
                      className={`relative cursor-pointer w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-medium transition-all ${
                        isActive
                          ? 'active-nav-item font-semibold shadow-xs'
                          : 'text-zinc-400 hover:text-zinc-100 hover:bg-[#151722]'
                      }`}
                    >
                      {isActive && (
                        <span className="active-nav-indicator absolute left-0 top-2 bottom-2 w-1 rounded-r-full" />
                      )}
                      <span className={isActive ? 'active-nav-icon' : 'text-zinc-400'}>{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
            </div>
          ))}
        </div>

        {/* Bottom Console Status & Merchant Scope Card */}
        <div className="p-3 border-t border-[#222533] space-y-2.5 bg-[#0f1017]">
          {/* Health Indicator Pill */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#141620] border border-[#222533] text-[11px]">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  apiMode === 'live' ? 'bg-emerald-400' : 'bg-blue-400'
                }`}
              />
              <span className="text-zinc-300 font-medium">
                {apiMode === 'live' ? 'Engine :8080 Live' : 'Sandbox Mode'}
              </span>
            </div>
            <button
              onClick={onOpenBackendSettings}
              className="text-[10px] font-mono text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
            >
              Config
            </button>
          </div>

          {/* Merchant Scope Selector Card */}
          <div className="relative">
            <button
              onClick={() => setIsMerchantDropdownOpen(!isMerchantDropdownOpen)}
              className="cursor-pointer w-full flex items-center justify-between p-2.5 rounded-xl bg-[#141620] hover:bg-[#1a1d2b] border border-[#222533] text-xs transition-colors"
            >
              <div className="flex items-center gap-2.5 text-left truncate">
                <div className="w-6 h-6 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 text-zinc-300">
                  <Building2 size={13} />
                </div>
                <div className="truncate">
                  <span className="font-semibold text-zinc-200 block truncate leading-tight">
                    {currentMerchant.name}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {currentMerchant.code} · {currentMerchant.currency}
                  </span>
                </div>
              </div>
              <ChevronDown size={14} className="text-zinc-400 shrink-0 ml-1" />
            </button>

            {isMerchantDropdownOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1.5 bg-[#141620] border border-[#222533] rounded-xl shadow-2xl overflow-hidden z-40 text-xs">
                <div className="p-2.5 border-b border-[#222533] text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Switch Merchant Scope
                </div>
                {merchants.map(m => (
                  <button
                    key={m.id}
                    onClick={() => {
                      onSelectMerchant(m);
                      setIsMerchantDropdownOpen(false);
                    }}
                    className={`cursor-pointer w-full text-left p-2.5 hover:bg-[#1e2232] flex items-center justify-between transition-colors ${
                      m.id === currentMerchant.id ? 'bg-[#1e2232] text-[#fafafa] font-semibold' : 'text-zinc-300'
                    }`}
                  >
                    <div>
                      <div className="text-xs">{m.name}</div>
                      <div className="text-[10px] text-zinc-400 font-mono">{m.industry}</div>
                    </div>
                    {m.id === currentMerchant.id && <span className="text-emerald-400 text-xs">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 border-b border-[#222533] bg-[#0c0d14]/90 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-2xl border border-[#222533] bg-[#141620] text-zinc-300"
            >
              {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-zinc-200">{currentMerchant.name}</span>
              <span className="text-zinc-600">/</span>
              <span className="capitalize text-zinc-400">
                {activeTab === 'decision' ? 'Decision Investigation' : activeTab}
              </span>
            </div>

            {/* Live Engine Status Pill (Reference Image 1) */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full border border-white/[0.08] bg-[#141620] text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-xs shadow-emerald-400" />
              <span className="font-medium text-zinc-300">Live Recovery Engine</span>
            </div>
          </div>

          {/* Right action bar */}
          <div className="flex items-center gap-3">
            {/* Time & Date Pill (Reference Image 1) */}
            <div className="hidden xl:flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#222533] bg-[#141620] text-[11px] text-zinc-400 font-mono">
              <Clock size={12} className="text-zinc-400" />
              <span>11:18 AM</span>
              <span className="text-zinc-600">|</span>
              <span>Sep 5</span>
            </div>

            <button
              onClick={onOpenBackendSettings}
              className="cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-2xl border border-[#222533] bg-[#141620] hover:bg-[#1a1d2b] transition-colors text-xs"
              title="Go Decision Engine API Settings"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  apiMode === 'live' ? 'bg-emerald-400' : 'bg-blue-400'
                }`}
              />
              <span className="font-medium text-zinc-200 hidden sm:inline">
                {apiMode === 'live' ? 'Go Engine (:8080)' : 'Sandbox Mode'}
              </span>
              <span className="font-medium text-zinc-200 sm:hidden">
                {apiMode === 'live' ? ':8080' : 'Mock'}
              </span>
              <Server size={13} className="text-zinc-500" />
            </button>

            <button
              onClick={onOpenSimulate}
              className="cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold tracking-wide border border-white shadow-xs transition-all"
            >
              <PlayCircle size={15} />
              <span className="hidden sm:inline">Simulate Failure</span>
              <span className="sm:hidden">Simulate</span>
            </button>

            <div className="flex items-center gap-2 pl-2 border-l border-[#222533]">
              <button
                onClick={toggleTheme}
                className="cursor-pointer p-2 rounded-2xl border border-[#222533] bg-[#141620] hover:bg-[#1a1d2b] text-zinc-400 hover:text-zinc-200 transition-colors"
                title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? (
                  <Sun size={15} className="text-amber-400" />
                ) : (
                  <Moon size={15} className="text-cyan-400" />
                )}
              </button>
              <button
                className="relative cursor-pointer p-2 rounded-2xl border border-[#222533] bg-[#141620] hover:bg-[#1a1d2b] text-zinc-400 hover:text-zinc-200 transition-colors hidden sm:block"
                title="Notifications"
              >
                <Bell size={15} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 border border-[#141620]" />
              </button>

              {/* Operator Profile (Reference Image 1 & 2) */}
              <div className="flex items-center gap-2 pl-1">
                <div
                  className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 dark:from-amber-600 dark:to-orange-500 light:from-cyan-600 light:to-teal-400 flex items-center justify-center text-xs font-bold text-zinc-950 shadow-xs"
                  title="Alex Vance - Recovery Operations Lead"
                >
                  AV
                </div>
                <div className="hidden lg:block text-left">
                  <div className="text-xs font-semibold text-zinc-200 leading-tight">
                    Alex Vance
                  </div>
                  <div className="text-[10px] text-zinc-400 leading-tight">
                    Risk Lead
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-[#0f1017] border-b border-[#222533] p-4 space-y-4 z-30">
            <div className="space-y-1">
              {navItems.flatMap(g => g.items).map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium ${
                    activeTab === item.id
                      ? 'bg-[#1e2232] text-[#fafafa] font-semibold'
                      : 'text-zinc-400 hover:bg-[#141620]'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            {/* Mobile Theme Toggle */}
            <div className="pt-2 border-t border-[#222533] flex items-center justify-between">
              <span className="text-xs text-zinc-400 font-medium">Appearance</span>
              <button
                onClick={toggleTheme}
                className="cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#222533] bg-[#141620] hover:bg-[#1a1d2b] text-xs text-zinc-200"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun size={14} className="text-amber-400" />
                    <span>Switch to Light Theme</span>
                  </>
                ) : (
                  <>
                    <Moon size={14} className="text-indigo-400" />
                    <span>Switch to Dark Theme</span>
                  </>
                )}
              </button>
            </div>

            {/* Mobile Merchant Selector */}
            <div className="pt-2 border-t border-[#222533]">
              <span className="text-[10px] uppercase font-mono text-zinc-400 block mb-1">
                Merchant Scope
              </span>
              <select
                value={currentMerchant.id}
                onChange={e => {
                  const m = merchants.find(m => m.id === e.target.value);
                  if (m) onSelectMerchant(m);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full bg-[#141620] border border-[#222533] rounded-xl p-2.5 text-xs text-zinc-200"
              >
                {merchants.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};
