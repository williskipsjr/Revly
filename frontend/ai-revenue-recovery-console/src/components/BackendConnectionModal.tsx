import React, { useState, useEffect } from 'react';
import {
  Server,
  Activity,
  Key,
  Globe,
  CheckCircle2,
  AlertCircle,
  X,
  RotateCw,
  Sliders,
  Shield,
  ExternalLink
} from 'lucide-react';
import { apiClient, ApiMode } from '../lib/api/client';

interface BackendConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectionChanged: () => void;
}

export const BackendConnectionModal: React.FC<BackendConnectionModalProps> = ({
  isOpen,
  onClose,
  onConnectionChanged
}) => {
  const currentConfig = apiClient.getHttpConfig();
  const [mode, setMode] = useState<ApiMode>(apiClient.getMode());
  const [baseUrl, setBaseUrl] = useState(currentConfig.baseUrl);
  const [merchantKey, setMerchantKey] = useState(currentConfig.merchantApiKey || '');
  const [adminKey, setAdminKey] = useState(currentConfig.adminApiKey || '');

  // Health check state
  const [isChecking, setIsChecking] = useState(false);
  const [healthStatus, setHealthStatus] = useState<{
    ok: boolean;
    status: string;
    version?: string;
    latencyMs?: number;
    tested: boolean;
  }>({
    ok: false,
    status: '',
    tested: false
  });

  useEffect(() => {
    if (isOpen) {
      const cfg = apiClient.getHttpConfig();
      setMode(apiClient.getMode());
      setBaseUrl(cfg.baseUrl);
      setMerchantKey(cfg.merchantApiKey || '');
      setAdminKey(cfg.adminApiKey || '');
      testConnection(cfg.baseUrl);
    }
  }, [isOpen]);

  const testConnection = async (testUrl?: string) => {
    setIsChecking(true);
    try {
      if (testUrl && testUrl !== currentConfig.baseUrl) {
        apiClient.updateHttpConfig({ baseUrl: testUrl });
      }
      const res = await apiClient.checkBackendHealth();
      setHealthStatus({
        ok: res.ok,
        status: res.status,
        version: res.version,
        latencyMs: res.latencyMs,
        tested: true
      });
    } catch (e: any) {
      setHealthStatus({
        ok: false,
        status: e?.message || 'Failed to reach service',
        tested: true
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleSave = () => {
    apiClient.updateHttpConfig({
      baseUrl,
      merchantApiKey: merchantKey.trim() || undefined,
      adminApiKey: adminKey.trim() || undefined
    });
    apiClient.setMode(mode);
    onConnectionChanged();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-[#151722] border border-[#222533] rounded-2xl p-6 max-w-lg w-full space-y-5 shadow-2xl relative">
        <button
          onClick={onClose}
          className="cursor-pointer absolute top-4 right-4 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-3 border-b border-[#222533] pb-4">
          <div className="w-10 h-10 rounded-xl bg-[#10121a] text-zinc-200 border border-[#222533] flex items-center justify-center shrink-0">
            <Server size={20} className="text-zinc-200" />
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              API Surface & Architecture
            </span>
            <h3 className="text-base font-semibold text-[#fafafa] mt-0.5">
              Backend Integration Settings
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Connect to Go decision-engine at <code className="text-zinc-300 font-mono">:8080</code> or run high-fidelity sandbox.
            </p>
          </div>
        </div>

        {/* Active Mode Selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-300 block">
            Engine Operation Mode
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode('live')}
              className={`cursor-pointer p-3 rounded-xl border text-left text-xs transition-all ${
                mode === 'live'
                  ? 'bg-[#181c2b] border-[#313a57] text-zinc-100 ring-1 ring-[#3b4566]'
                  : 'bg-[#10121a] border-[#222533] text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-zinc-200">Live Backend</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>
              <span className="text-[11px] text-zinc-400 block mt-1">
                Direct HTTP calls to Go decision-engine at :8080
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMode('mock')}
              className={`cursor-pointer p-3 rounded-xl border text-left text-xs transition-all ${
                mode === 'mock'
                  ? 'bg-[#181c2b] border-[#313a57] text-zinc-100 ring-1 ring-[#3b4566]'
                  : 'bg-[#10121a] border-[#222533] text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-zinc-200">Interactive Sandbox</span>
                <span className="w-2 h-2 rounded-full bg-blue-400" />
              </div>
              <span className="text-[11px] text-zinc-400 block mt-1">
                Full deterministic in-memory recovery simulator
              </span>
            </button>
          </div>
        </div>

        {/* Health Status Banner */}
        <div className="p-3.5 rounded-xl bg-[#10121a] border border-[#222533] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            {isChecking ? (
              <RotateCw size={15} className="animate-spin text-zinc-400" />
            ) : healthStatus.ok ? (
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-amber-400 shrink-0" />
            )}
            <div>
              <div className="font-medium text-zinc-200">
                {isChecking
                  ? 'Testing connection to :8080...'
                  : healthStatus.ok
                  ? `Engine Live (${healthStatus.latencyMs}ms)`
                  : 'Engine Standby / Unreachable'}
              </div>
              <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                {healthStatus.version ? `Version: ${healthStatus.version} · ` : ''}
                {baseUrl}/health
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => testConnection(baseUrl)}
            disabled={isChecking}
            className="cursor-pointer px-2.5 py-1 rounded-lg border border-[#222533] bg-[#151722] hover:bg-[#1e2232] text-[11px] text-zinc-300 font-medium transition-colors"
          >
            Ping Engine
          </button>
        </div>

        {/* Inputs */}
        <div className="space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 mb-1">
              <Globe size={13} className="text-zinc-400" />
              <span>Decision Engine Base URL</span>
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder="http://localhost:8080"
              className="w-full bg-[#10121a] border border-[#222533] rounded-xl p-2.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500"
            />
            <p className="text-[10px] text-zinc-500 mt-1">
              Go backend default: <code className="text-zinc-400">http://localhost:8080</code>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 mb-1">
                <Key size={13} className="text-zinc-400" />
                <span>Merchant API Key (Optional)</span>
              </label>
              <input
                type="password"
                value={merchantKey}
                onChange={e => setMerchantKey(e.target.value)}
                placeholder="Leave empty if disabled in dev"
                className="w-full bg-[#10121a] border border-[#222533] rounded-xl p-2.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600"
              />
              <p className="text-[10px] text-zinc-500 mt-1">
                Transmitted via <code className="text-zinc-400">X-API-Key</code>
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 mb-1">
                <Shield size={13} className="text-zinc-400" />
                <span>Admin API Key (Optional)</span>
              </label>
              <input
                type="password"
                value={adminKey}
                onChange={e => setAdminKey(e.target.value)}
                placeholder="Required for policy & kill switch"
                className="w-full bg-[#10121a] border border-[#222533] rounded-xl p-2.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600"
              />
              <p className="text-[10px] text-zinc-500 mt-1">
                Admin gate for PUT policy & kill switch
              </p>
            </div>
          </div>
        </div>

        {/* Informational contract note */}
        <div className="text-[11px] text-zinc-400 bg-[#10121a] border border-[#222533] p-3 rounded-xl space-y-1">
          <div className="font-semibold text-zinc-300 flex items-center gap-1.5">
            <Sliders size={12} className="text-zinc-400" />
            <span>Integrated API Contracts:</span>
          </div>
          <div className="text-[10px] font-mono text-zinc-400 space-y-0.5">
            <div>• Ingestion: <span className="text-zinc-300">POST /v1/merchants/&#123;id&#125;/events/payment-failed</span></div>
            <div>• Decisions: <span className="text-zinc-300">GET /v1/merchants/&#123;id&#125;/decisions?limit=50</span></div>
            <div>• Drill-down: <span className="text-zinc-300">GET /v1/merchants/&#123;id&#125;/decisions/&#123;decision_id&#125;</span></div>
            <div>• Override: <span className="text-zinc-300">POST /v1/merchants/&#123;id&#125;/decisions/&#123;decision_id&#125;/override</span></div>
            <div>• Summary: <span className="text-zinc-300">GET /v1/merchants/&#123;id&#125;/metrics/recovery-summary</span></div>
            <div>• Policy & Bounds: <span className="text-zinc-300">PUT /v1/merchants/&#123;id&#125;/policy-config</span></div>
            <div>• Kill Switch: <span className="text-zinc-300">POST /v1/merchants/&#123;id&#125;/policy/kill-switch</span></div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#222533]">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer px-3.5 py-1.5 rounded-lg border border-[#222533] text-xs font-medium text-zinc-300 hover:bg-[#1a1d2b] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="cursor-pointer px-4 py-1.5 rounded-lg text-xs font-semibold text-zinc-950 bg-zinc-100 hover:bg-white border border-white transition-colors"
          >
            Apply & Switch
          </button>
        </div>
      </div>
    </div>
  );
};
