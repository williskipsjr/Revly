import React, { useState, useEffect, useCallback } from 'react';
import {
  Decision,
  MerchantInfo,
  RecoverySummaryMetrics,
  MerchantPolicyConfig,
  AuditEvent,
  CandidateActionType
} from './types/domain';
import { apiClient, mockApiClient, ApiMode } from './lib/api/client';
import { PaymentFailedEventPayload } from './lib/api/types';
import { AppShell, NavigationTab } from './components/AppShell';
import { OverviewView } from './views/OverviewView';
import { RecoveryFeedView } from './views/RecoveryFeedView';
import { DecisionInvestigationView } from './views/DecisionInvestigationView';
import { PolicyView } from './views/PolicyView';
import { AuditView } from './views/AuditView';
import { SimulateFailureDialog } from './components/SimulateFailureDialog';
import { BackendConnectionModal } from './components/BackendConnectionModal';
import { RotateCw, AlertTriangle, Server, Sparkles } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavigationTab>('overview');
  const [merchants, setMerchants] = useState<MerchantInfo[]>([]);
  const [currentMerchant, setCurrentMerchant] = useState<MerchantInfo | null>(null);

  // Data states scoped to merchant
  const [metrics, setMetrics] = useState<RecoverySummaryMetrics | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [policy, setPolicy] = useState<MerchantPolicyConfig | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>([]);
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);

  // Applet state & Backend API mode
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSimulateOpen, setIsSimulateOpen] = useState(false);
  const [isBackendModalOpen, setIsBackendModalOpen] = useState(false);
  const [apiMode, setApiMode] = useState<ApiMode>(apiClient.getMode());
  const [aiDegraded, setAiDegraded] = useState(false);

  // Listen for external mode changes
  useEffect(() => {
    return apiClient.subscribeMode(newMode => {
      setApiMode(newMode);
    });
  }, []);

  // 1. Initial Load: Load Merchants with Graceful Fallback
  const initApp = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      // If client mode is set to live, check if backend is actually reachable
      if (apiClient.getMode() === 'live') {
        const health = await apiClient.checkBackendHealth();
        if (!health.ok) {
          console.info('Live Go backend on :8080 not reachable, automatically switching to sandbox simulation mode');
          apiClient.setMode('mock');
          setApiMode('mock');
        }
      }
      let list = await apiClient.getMerchants();
      if (!list || list.length === 0) {
        list = await mockApiClient.getMerchants();
      }
      setMerchants(list);
      if (list.length > 0) {
        setCurrentMerchant(list[0]);
      }
    } catch (err: any) {
      console.warn('Backend not reachable on launch, falling back to sandbox simulator:', err);
      apiClient.setMode('mock');
      setApiMode('mock');
      const fallbackList = await mockApiClient.getMerchants();
      setMerchants(fallbackList);
      if (fallbackList.length > 0) {
        setCurrentMerchant(fallbackList[0]);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initApp();
  }, [initApp]);

  // 2. Fetch Merchant Scoped Data
  const loadMerchantData = useCallback(async (merchantId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const [summaryData, feedData, policyData, auditData] = await Promise.all([
        apiClient.getRecoverySummary(merchantId).catch(() => mockApiClient.getRecoverySummary(merchantId)),
        apiClient.getRecoveryFeed(merchantId).catch(() => mockApiClient.getRecoveryFeed(merchantId)),
        apiClient.getPolicyConfig(merchantId).catch(() => mockApiClient.getPolicyConfig(merchantId)),
        apiClient.getAuditTrail(merchantId).catch(() => mockApiClient.getAuditTrail(merchantId))
      ]);

      setMetrics(summaryData || (await mockApiClient.getRecoverySummary(merchantId)));
      setDecisions(feedData?.decisions || (await mockApiClient.getRecoveryFeed(merchantId)).decisions);
      setPolicy(policyData || (await mockApiClient.getPolicyConfig(merchantId)));
      setAuditLogs(auditData || []);

      // Default selected decision to hero decision or first in feed
      const activeDecisions = feedData?.decisions || [];
      if (activeDecisions.length > 0) {
        if (!selectedDecisionId || !activeDecisions.some(d => d.id === selectedDecisionId)) {
          setSelectedDecisionId(activeDecisions[0].id);
        }
      }
    } catch (err: any) {
      console.warn('Recovering with sandbox mock data:', err);
      try {
        const [summaryData, feedData, policyData, auditData] = await Promise.all([
          mockApiClient.getRecoverySummary(merchantId),
          mockApiClient.getRecoveryFeed(merchantId),
          mockApiClient.getPolicyConfig(merchantId),
          mockApiClient.getAuditTrail(merchantId)
        ]);
        setMetrics(summaryData);
        setDecisions(feedData.decisions);
        setPolicy(policyData);
        setAuditLogs(auditData);
        if (feedData.decisions.length > 0) {
          setSelectedDecisionId(feedData.decisions[0].id);
        }
      } catch (mockErr) {
        setError('Failed to load recovery state');
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedDecisionId]);

  useEffect(() => {
    if (currentMerchant) {
      loadMerchantData(currentMerchant.id);
    }
  }, [currentMerchant, loadMerchantData]);

  // Handler: When user updates connection settings in modal
  const handleConnectionChanged = () => {
    setApiMode(apiClient.getMode());
    if (currentMerchant) {
      loadMerchantData(currentMerchant.id);
    } else {
      initApp();
    }
  };

  // Handler: Select decision to investigate
  const handleSelectDecision = (decisionId: string) => {
    setSelectedDecisionId(decisionId);
    setActiveTab('decision');
  };

  // Handler: Manual Override
  const handleOverrideDecision = async (action: CandidateActionType, reason: string) => {
    if (!currentMerchant || !selectedDecisionId) return;
    const updated = await apiClient.overrideDecision(currentMerchant.id, selectedDecisionId, {
      replacement_action: action,
      operator_reason: reason
    });

    // Update local state
    setDecisions(prev => prev.map(d => (d.id === updated.id ? updated : d)));
    const freshAudit = await apiClient.getAuditTrail(currentMerchant.id);
    setAuditLogs(freshAudit);
  };

  // Handler: Save Merchant Policy
  const handleSavePolicy = async (config: Partial<MerchantPolicyConfig>) => {
    if (!currentMerchant) return;
    const updated = await apiClient.updatePolicyConfig(currentMerchant.id, config);
    setPolicy(updated);
    const freshAudit = await apiClient.getAuditTrail(currentMerchant.id);
    setAuditLogs(freshAudit);
  };

  // Handler: Toggle Kill Switch
  const handleToggleKillSwitch = async (active: boolean, reason: string) => {
    if (!currentMerchant) return;
    await apiClient.setKillSwitch(currentMerchant.id, {
      active,
      scope: 'merchant',
      reason
    });
    const updated = await apiClient.getPolicyConfig(currentMerchant.id);
    setPolicy(updated);
    const freshAudit = await apiClient.getAuditTrail(currentMerchant.id);
    setAuditLogs(freshAudit);
  };

  // Handler: Simulate Payment Failed
  const handleSimulatePayment = async (payload: PaymentFailedEventPayload) => {
    if (!currentMerchant) return;
    const formulatedDecision = await apiClient.simulatePaymentFailed(currentMerchant.id, payload);

    // Refresh state
    setDecisions(prev => [formulatedDecision, ...prev]);
    const freshSummary = await apiClient.getRecoverySummary(currentMerchant.id);
    setMetrics(freshSummary);
    const freshAudit = await apiClient.getAuditTrail(currentMerchant.id);
    setAuditLogs(freshAudit);

    // Automatically navigate to the new decision investigation
    setSelectedDecisionId(formulatedDecision.id);
    setActiveTab('decision');
  };

  // Active decision for investigation
  const currentDecision = decisions.find(d => d.id === selectedDecisionId) || decisions[0];

  // Selected decision's payment-scoped audit trail
  const paymentAuditTrail = currentDecision
    ? auditLogs.filter(
        l => l.payment_id === currentDecision.payment_id || l.entity_id === currentDecision.id
      )
    : [];

  if (isLoading && !currentMerchant) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#090b0e] text-zinc-300">
        <div className="flex flex-col items-center gap-3">
          <RotateCw className="animate-spin text-indigo-500" size={28} />
          <span className="text-xs font-mono text-zinc-400">
            Initializing AI Revenue Recovery Decision Engine...
          </span>
        </div>
      </div>
    );
  }

  if (error && !currentMerchant) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#090b0e] text-zinc-300 p-6">
        <div className="max-w-md w-full bg-[#0e121a] border border-[#222533] rounded-2xl p-6 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
            <Server size={24} />
          </div>
          <h2 className="text-base font-semibold text-zinc-100">Decision Engine Unreachable</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            The frontend is configured for live backend calls at <code className="text-zinc-200 font-mono">:8080</code>.
            Ensure the Go service is running or switch to Sandbox simulation mode.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={() => {
                apiClient.setMode('mock');
                setApiMode('mock');
                initApp();
              }}
              className="cursor-pointer px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold"
            >
              Switch to Sandbox Mode
            </button>
            <button
              onClick={() => setIsBackendModalOpen(true)}
              className="cursor-pointer px-3.5 py-2 rounded-xl border border-[#222533] bg-[#141620] hover:bg-[#1a1d2b] text-zinc-200 text-xs font-medium"
            >
              API Settings
            </button>
          </div>
        </div>

        <BackendConnectionModal
          isOpen={isBackendModalOpen}
          onClose={() => setIsBackendModalOpen(false)}
          onConnectionChanged={handleConnectionChanged}
        />
      </div>
    );
  }

  if (!currentMerchant || !metrics || !policy) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#090b0e] text-zinc-300">
        <div className="flex flex-col items-center gap-3">
          <RotateCw className="animate-spin text-indigo-500" size={28} />
          <span className="text-xs font-mono text-zinc-400">
            Loading AI Revenue Recovery Console...
          </span>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      activeTab={activeTab}
      onNavigate={tab => {
        setActiveTab(tab);
      }}
      merchants={merchants}
      currentMerchant={currentMerchant}
      onSelectMerchant={m => {
        setCurrentMerchant(m);
        setSelectedDecisionId(null);
      }}
      onOpenSimulate={() => setIsSimulateOpen(true)}
      onOpenBackendSettings={() => setIsBackendModalOpen(true)}
      apiMode={apiMode}
      aiDegraded={aiDegraded}
    >
      {/* View 1: Overview */}
      {activeTab === 'overview' && (
        <OverviewView
          metrics={metrics}
          recentDecisions={decisions.slice(0, 6)}
          currentMerchant={currentMerchant}
          onSelectDecision={handleSelectDecision}
          onOpenSimulate={() => setIsSimulateOpen(true)}
          aiDegraded={aiDegraded}
          onToggleAiDegraded={() => setAiDegraded(!aiDegraded)}
          onRefresh={() => loadMerchantData(currentMerchant.id)}
          loading={isLoading}
        />
      )}

      {/* View 2: Recovery Feed */}
      {activeTab === 'feed' && (
        <RecoveryFeedView
          decisions={decisions}
          currentMerchant={currentMerchant}
          onSelectDecision={handleSelectDecision}
          onRefresh={() => loadMerchantData(currentMerchant.id)}
          loading={isLoading}
        />
      )}

      {/* View 3: Decision Investigation (Hero View) */}
      {activeTab === 'decision' && currentDecision && (
        <DecisionInvestigationView
          decision={currentDecision}
          auditTrail={paymentAuditTrail}
          onBack={() => setActiveTab('feed')}
          onOverride={handleOverrideDecision}
        />
      )}

      {/* View 4: Merchant Policy */}
      {activeTab === 'policy' && (
        <PolicyView
          policy={policy}
          currentMerchant={currentMerchant}
          onSavePolicy={handleSavePolicy}
          onToggleKillSwitch={handleToggleKillSwitch}
          loading={isLoading}
        />
      )}

      {/* View 5: Audit Trail */}
      {activeTab === 'audit' && (
        <AuditView
          auditLogs={auditLogs}
          currentMerchant={currentMerchant}
          onRefresh={() => loadMerchantData(currentMerchant.id)}
          loading={isLoading}
        />
      )}

      {/* Simulate Payment Failure Dialog */}
      <SimulateFailureDialog
        merchantId={currentMerchant.id}
        isOpen={isSimulateOpen}
        onClose={() => setIsSimulateOpen(false)}
        onSubmit={handleSimulatePayment}
      />

      {/* Backend Engine Connection & Settings Modal */}
      <BackendConnectionModal
        isOpen={isBackendModalOpen}
        onClose={() => setIsBackendModalOpen(false)}
        onConnectionChanged={handleConnectionChanged}
      />
    </AppShell>
  );
}
