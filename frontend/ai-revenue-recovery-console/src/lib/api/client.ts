import {
  Decision,
  RecoverySummaryMetrics,
  MerchantPolicyConfig,
  AuditEvent,
  MerchantInfo
} from '../../types/domain';
import {
  PaymentFailedEventPayload,
  DecisionOverridePayload,
  KillSwitchPayload,
  RecoveryFeedFilter,
  RecoveryFeedResponse
} from './types';
import {
  MOCK_MERCHANTS,
  MOCK_POLICIES,
  MOCK_SUMMARY_METRICS,
  MOCK_DECISIONS,
  MOCK_AUDIT_LOG
} from '../mock/data';

export interface RecoveryApiClient {
  getMerchants(): Promise<MerchantInfo[]>;
  getRecoverySummary(merchantId: string): Promise<RecoverySummaryMetrics>;
  getRecoveryFeed(merchantId: string, filter?: RecoveryFeedFilter): Promise<RecoveryFeedResponse>;
  getPaymentDecisions(merchantId: string, paymentId: string): Promise<Decision[]>;
  getDecisionDetail(merchantId: string, decisionId: string): Promise<Decision>;
  overrideDecision(merchantId: string, decisionId: string, payload: DecisionOverridePayload): Promise<Decision>;
  getPolicyConfig(merchantId: string): Promise<MerchantPolicyConfig>;
  updatePolicyConfig(merchantId: string, config: Partial<MerchantPolicyConfig>): Promise<MerchantPolicyConfig>;
  setKillSwitch(merchantId: string, payload: KillSwitchPayload): Promise<{ active: boolean; scope: string }>;
  getAuditTrail(merchantId: string, paymentId?: string): Promise<AuditEvent[]>;
  simulatePaymentFailed(merchantId: string, payload: PaymentFailedEventPayload): Promise<Decision>;
}

/**
 * In-Memory Mock Implementation
 * Allows full operator exploration: overrides, policy updates, kill switch, and failure ingestion.
 */
class MockRecoveryApiClient implements RecoveryApiClient {
  private merchants: MerchantInfo[] = [...MOCK_MERCHANTS];
  private policies: Record<string, MerchantPolicyConfig> = JSON.parse(JSON.stringify(MOCK_POLICIES));
  private summaryMetrics: Record<string, RecoverySummaryMetrics> = JSON.parse(JSON.stringify(MOCK_SUMMARY_METRICS));
  private decisions: Decision[] = JSON.parse(JSON.stringify(MOCK_DECISIONS));
  private auditLogs: AuditEvent[] = JSON.parse(JSON.stringify(MOCK_AUDIT_LOG));

  async getMerchants(): Promise<MerchantInfo[]> {
    await this.latency();
    return [...this.merchants];
  }

  async getRecoverySummary(merchantId: string): Promise<RecoverySummaryMetrics> {
    await this.latency();
    const metrics = this.summaryMetrics[merchantId] || this.summaryMetrics['merch_acme_01'];
    return JSON.parse(JSON.stringify(metrics));
  }

  async getRecoveryFeed(merchantId: string, filter?: RecoveryFeedFilter): Promise<RecoveryFeedResponse> {
    await this.latency();
    let list = this.decisions.filter(d => d.merchant_id === merchantId);

    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(d =>
        d.id.toLowerCase().includes(q) ||
        d.payment_id.toLowerCase().includes(q) ||
        d.payment.customer.name?.toLowerCase().includes(q) ||
        d.diagnosis.root_cause.toLowerCase().includes(q) ||
        d.payment.failure_code.toLowerCase().includes(q)
      );
    }

    if (filter?.status && filter.status !== 'ALL') {
      list = list.filter(d => d.recovery_state === filter.status);
    }

    if (filter?.action && filter.action !== 'ALL') {
      list = list.filter(d => d.chosen_action === filter.action);
    }

    if (filter?.policy_result && filter.policy_result !== 'ALL') {
      list = list.filter(d => d.policy_result === filter.policy_result);
    }

    const allForMerchant = this.decisions.filter(d => d.merchant_id === merchantId);

    return {
      decisions: JSON.parse(JSON.stringify(list)),
      total_count: list.length,
      page: filter?.page || 1,
      total_pages: Math.max(1, Math.ceil(list.length / (filter?.limit || 20))),
      summary_counts: {
        total: allForMerchant.length,
        recovered: allForMerchant.filter(d => d.recovery_state === 'RECOVERED').length,
        pending: allForMerchant.filter(d => d.recovery_state === 'ACTION_PENDING').length,
        failed: allForMerchant.filter(d => d.recovery_state === 'FAILED').length,
        stopped: allForMerchant.filter(d => d.recovery_state === 'STOPPED').length,
        human_review: allForMerchant.filter(d => d.policy_result === 'HUMAN_REVIEW').length
      }
    };
  }

  async getPaymentDecisions(merchantId: string, paymentId: string): Promise<Decision[]> {
    await this.latency();
    return JSON.parse(
      JSON.stringify(this.decisions.filter(d => d.merchant_id === merchantId && d.payment_id === paymentId))
    );
  }

  async getDecisionDetail(merchantId: string, decisionId: string): Promise<Decision> {
    await this.latency();
    const found = this.decisions.find(d => d.merchant_id === merchantId && d.id === decisionId);
    if (!found) {
      // Check without merchant scope as fallback if matching by ID
      const anyMatch = this.decisions.find(d => d.id === decisionId);
      if (anyMatch) return JSON.parse(JSON.stringify(anyMatch));
      throw new Error(`Decision ${decisionId} not found`);
    }
    return JSON.parse(JSON.stringify(found));
  }

  async overrideDecision(
    merchantId: string,
    decisionId: string,
    payload: DecisionOverridePayload
  ): Promise<Decision> {
    await this.latency();
    const decision = this.decisions.find(d => d.id === decisionId);
    if (!decision) {
      throw new Error(`Decision ${decisionId} not found`);
    }

    if (!payload.operator_reason || !payload.operator_reason.trim()) {
      throw new Error('An explicit operator reason is mandatory for overrides.');
    }

    const prevAction = decision.chosen_action;
    decision.chosen_action = payload.replacement_action;
    decision.recovery_state = 'ACTION_PENDING';
    decision.policy_result = 'ALLOW';
    decision.override_reason = payload.operator_reason;
    decision.overridden_by = payload.operator_id || 'operator_ui@acme.com';
    decision.overridden_at = new Date().toISOString();
    decision.updated_at = new Date().toISOString();

    // Mark winner candidate
    decision.candidate_actions.forEach(a => {
      a.is_winner = a.action_type === payload.replacement_action;
    });

    // Append to audit trail
    this.auditLogs.unshift({
      id: `aud_override_${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor: 'Operator (Admin)',
      actor_id: decision.overridden_by,
      entity: 'Decision',
      entity_id: decision.id,
      payment_id: decision.payment_id,
      event_type: 'MANUAL_OPERATOR_OVERRIDE',
      details: `Operator overridden action from ${prevAction} to ${payload.replacement_action}. Reason: "${payload.operator_reason}"`
    });

    return JSON.parse(JSON.stringify(decision));
  }

  async getPolicyConfig(merchantId: string): Promise<MerchantPolicyConfig> {
    await this.latency();
    const policy = this.policies[merchantId] || this.policies['merch_acme_01'];
    return JSON.parse(JSON.stringify(policy));
  }

  async updatePolicyConfig(
    merchantId: string,
    config: Partial<MerchantPolicyConfig>
  ): Promise<MerchantPolicyConfig> {
    await this.latency();
    const existing = this.policies[merchantId] || this.policies['merch_acme_01'];
    const updated = {
      ...existing,
      ...config,
      updated_at: new Date().toISOString(),
      updated_by: 'operator_ui@console.com'
    };
    this.policies[merchantId] = updated;

    this.auditLogs.unshift({
      id: `aud_pol_${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor: 'Operator (Admin)',
      entity: 'Policy',
      entity_id: merchantId,
      event_type: 'MERCHANT_POLICY_UPDATED',
      details: `Merchant policy updated: max_retries=${updated.max_retries}, cooldown=${updated.cooldown_minutes}m, min_erv=₹${updated.min_erv_threshold / 100}`
    });

    return JSON.parse(JSON.stringify(updated));
  }

  async setKillSwitch(merchantId: string, payload: KillSwitchPayload): Promise<{ active: boolean; scope: string }> {
    await this.latency();
    const policy = this.policies[merchantId] || this.policies['merch_acme_01'];
    policy.kill_switch_active = payload.active;
    policy.kill_switch_scope = payload.scope || 'merchant';
    policy.updated_at = new Date().toISOString();

    this.auditLogs.unshift({
      id: `aud_kill_${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor: 'Operator (Admin)',
      entity: 'KillSwitch',
      entity_id: merchantId,
      event_type: payload.active ? 'KILL_SWITCH_ENGAGED' : 'KILL_SWITCH_DISENGAGED',
      details: `Automation kill switch ${payload.active ? 'ENGAGED (Automated actions halted)' : 'DISENGAGED (Automation restored)'}. Scope: ${policy.kill_switch_scope}. Reason: "${payload.reason}"`
    });

    return { active: payload.active, scope: policy.kill_switch_scope };
  }

  async getAuditTrail(merchantId: string, paymentId?: string): Promise<AuditEvent[]> {
    await this.latency();
    let logs = [...this.auditLogs];
    if (paymentId) {
      logs = logs.filter(l => l.payment_id === paymentId || l.entity_id === paymentId);
    }
    return JSON.parse(JSON.stringify(logs));
  }

  async simulatePaymentFailed(
    merchantId: string,
    payload: PaymentFailedEventPayload
  ): Promise<Decision> {
    await this.latency();
    const newDecisionId = `DEC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const timestamp = new Date().toISOString();

    const newDecision: Decision = {
      id: newDecisionId,
      payment_id: payload.payment_id,
      merchant_id: merchantId,
      chosen_action: 'delayed_retry',
      erv_at_decision: Math.round(payload.amount * 0.82 - 7400),
      policy_version: 'v2.4.1-rc3',
      policy_result: 'ALLOW',
      recovery_state: 'ACTION_PENDING',
      created_at: timestamp,
      updated_at: timestamp,
      payment: {
        payment_id: payload.payment_id,
        merchant_id: merchantId,
        amount: payload.amount,
        currency: payload.currency || 'INR',
        method: payload.method,
        method_details: `${payload.method.toUpperCase()} instrument`,
        payment_status: 'failed',
        failure_code: payload.failure_code,
        failure_reason: payload.failure_reason,
        occurred_at: timestamp,
        attempt_count: 1,
        customer: {
          customer_id: payload.customer_id,
          name: payload.customer_name || 'Simulated Customer',
          email: payload.customer_email || 'customer@simulated.io',
          historical_success_rate: 0.90,
          total_transactions: 12,
          tier: 'Regular'
        }
      },
      diagnosis: {
        diagnosis_id: `diag_${newDecisionId.toLowerCase()}`,
        root_cause: `${payload.failure_reason} (Diagnosed)`,
        confidence: 0.89,
        rationale: `Diagnosis indicates ${payload.failure_code} is resolvable via bounded intervention. Customer has 90% positive payment track record.`,
        source: 'AI-assisted',
        model_version: 'gemini-1.5-pro-fintech-v3',
        diagnosed_at: timestamp
      },
      candidate_actions: [
        {
          action_type: 'delayed_retry',
          action_label: 'Delayed Retry (15m)',
          description: 'Schedule automated retry after gateway recovery',
          p_success: 0.84,
          recoverable_amount: payload.amount,
          cost: 200,
          friction_penalty: 7200,
          erv: Math.round(payload.amount * 0.84 - 7400),
          policy_result: 'ALLOW',
          is_winner: true,
          policy_notes: 'Optimized ERV within policy parameters'
        },
        {
          action_type: 'payment_link',
          action_label: 'Omnichannel Payment Link',
          description: 'Deliver dynamic checkout link via SMS',
          p_success: 0.71,
          recoverable_amount: payload.amount,
          cost: 450,
          friction_penalty: 6000,
          erv: Math.round(payload.amount * 0.71 - 6450),
          policy_result: 'ALLOW',
          is_winner: false
        },
        {
          action_type: 'no_action',
          action_label: 'No Action',
          description: 'Drop intervention',
          p_success: 0,
          recoverable_amount: payload.amount,
          cost: 0,
          friction_penalty: 0,
          erv: 0,
          policy_result: 'ALLOW',
          is_winner: false
        }
      ],
      policy_checks: [
        {
          id: 'chk_sim_01',
          name: 'Retry Limit Ceiling',
          category: 'limits',
          passed: true,
          actual_value: '1 of 3 retries',
          threshold: '<= 3',
          details: 'Within limits'
        },
        {
          id: 'chk_sim_02',
          name: 'Minimum ERV Floor',
          category: 'economics',
          passed: true,
          actual_value: `₹${((payload.amount * 0.84 - 7400) / 100).toFixed(2)}`,
          threshold: '>= ₹50.00',
          details: 'Passed economics'
        },
        {
          id: 'chk_sim_03',
          name: 'Automated Action Amount Ceiling',
          category: 'limits',
          passed: true,
          actual_value: `₹${(payload.amount / 100).toFixed(2)}`,
          threshold: '<= ₹50,000.00',
          details: 'Within auto ceiling'
        }
      ],
      execution: {
        action_id: `act_sim_${Date.now()}`,
        action_type: 'delayed_retry',
        idempotency_key: `idem_sim_${payload.external_event_id}`,
        status: 'pending',
        executed_at: timestamp,
        retry_count: 1
      },
      outcome: {
        result: 'IN_PROGRESS',
        recovered_amount: 0,
        observed_at: timestamp,
        notes: 'Simulated payment failure successfully queued for scheduled recovery.'
      }
    };

    this.decisions.unshift(newDecision);

    this.auditLogs.unshift({
      id: `aud_sim_${Date.now()}`,
      timestamp: timestamp,
      actor: 'System',
      entity: 'Payment',
      entity_id: payload.payment_id,
      payment_id: payload.payment_id,
      event_type: 'PAYMENT_FAILED_INGESTED',
      details: `Payment failure event ingested (Code=${payload.failure_code}). Decision ${newDecisionId} formulated.`
    });

    return JSON.parse(JSON.stringify(newDecision));
  }

  private latency(ms: number = 80): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

import { HttpRecoveryApiClient, HttpConfig } from './http-client';

export type ApiMode = 'live' | 'mock';

/**
 * Unified API Client Manager
 * Dynamically routes calls to either the Go Decision Engine (:8080)
 * or the In-Memory Sandbox Mock Client based on active mode.
 */
class UnifiedRecoveryApiClient implements RecoveryApiClient {
  private http: HttpRecoveryApiClient;
  private mock: MockRecoveryApiClient;
  private mode: ApiMode = 'mock';
  private listeners: Array<(mode: ApiMode) => void> = [];

  constructor() {
    this.http = new HttpRecoveryApiClient();
    this.mock = new MockRecoveryApiClient();

    // Check localStorage preference if available in browser
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedMode = window.localStorage.getItem('revly_api_mode') as ApiMode;
      // Default to mock unless user explicitly chose live
      if (savedMode === 'live' || savedMode === 'mock') {
        this.mode = savedMode;
      } else {
        this.mode = 'mock';
      }
      const savedUrl = window.localStorage.getItem('revly_api_url');
      const savedMerchantKey = window.localStorage.getItem('revly_merchant_key');
      const savedAdminKey = window.localStorage.getItem('revly_admin_key');

      this.http.updateConfig({
        baseUrl: savedUrl || undefined,
        merchantApiKey: savedMerchantKey || undefined,
        adminApiKey: savedAdminKey || undefined
      });
    }
  }

  getMode(): ApiMode {
    return this.mode;
  }

  setMode(mode: ApiMode) {
    this.mode = mode;
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('revly_api_mode', mode);
    }
    this.listeners.forEach(fn => fn(mode));
  }

  subscribeMode(fn: (mode: ApiMode) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  getHttpConfig(): HttpConfig {
    return this.http.getConfig();
  }

  updateHttpConfig(config: Partial<HttpConfig>) {
    this.http.updateConfig(config);
    if (typeof window !== 'undefined' && window.localStorage) {
      if (config.baseUrl !== undefined) window.localStorage.setItem('revly_api_url', config.baseUrl);
      if (config.merchantApiKey !== undefined) window.localStorage.setItem('revly_merchant_key', config.merchantApiKey);
      if (config.adminApiKey !== undefined) window.localStorage.setItem('revly_admin_key', config.adminApiKey);
    }
  }

  async checkBackendHealth() {
    return this.http.checkHealth();
  }

  private get activeClient(): RecoveryApiClient {
    return this.mode === 'live' ? this.http : this.mock;
  }

  async getMerchants(): Promise<MerchantInfo[]> {
    try {
      return await this.activeClient.getMerchants();
    } catch {
      return this.mock.getMerchants();
    }
  }

  async getRecoverySummary(merchantId: string): Promise<RecoverySummaryMetrics> {
    try {
      return await this.activeClient.getRecoverySummary(merchantId);
    } catch (e: any) {
      if (this.mode === 'live') {
        console.warn(`[Revly] Live backend request failed, falling back to mock sandbox:`, e);
        return this.mock.getRecoverySummary(merchantId);
      }
      throw e;
    }
  }

  async getRecoveryFeed(merchantId: string, filter?: RecoveryFeedFilter): Promise<RecoveryFeedResponse> {
    try {
      return await this.activeClient.getRecoveryFeed(merchantId, filter);
    } catch (e: any) {
      if (this.mode === 'live') {
        console.warn(`[Revly] Live backend feed request failed, falling back to mock sandbox:`, e);
        return this.mock.getRecoveryFeed(merchantId, filter);
      }
      throw e;
    }
  }

  async getPaymentDecisions(merchantId: string, paymentId: string): Promise<Decision[]> {
    try {
      return await this.activeClient.getPaymentDecisions(merchantId, paymentId);
    } catch {
      return this.mock.getPaymentDecisions(merchantId, paymentId);
    }
  }

  async getDecisionDetail(merchantId: string, decisionId: string): Promise<Decision> {
    try {
      return await this.activeClient.getDecisionDetail(merchantId, decisionId);
    } catch {
      return this.mock.getDecisionDetail(merchantId, decisionId);
    }
  }

  async overrideDecision(
    merchantId: string,
    decisionId: string,
    payload: DecisionOverridePayload
  ): Promise<Decision> {
    try {
      return await this.activeClient.overrideDecision(merchantId, decisionId, payload);
    } catch {
      return this.mock.overrideDecision(merchantId, decisionId, payload);
    }
  }

  async getPolicyConfig(merchantId: string): Promise<MerchantPolicyConfig> {
    try {
      return await this.activeClient.getPolicyConfig(merchantId);
    } catch (e: any) {
      if (this.mode === 'live') {
        console.warn(`[Revly] Live backend policy request failed, falling back to mock sandbox:`, e);
        return this.mock.getPolicyConfig(merchantId);
      }
      throw e;
    }
  }

  async updatePolicyConfig(
    merchantId: string,
    config: Partial<MerchantPolicyConfig>
  ): Promise<MerchantPolicyConfig> {
    try {
      return await this.activeClient.updatePolicyConfig(merchantId, config);
    } catch {
      return this.mock.updatePolicyConfig(merchantId, config);
    }
  }

  async setKillSwitch(merchantId: string, payload: KillSwitchPayload): Promise<{ active: boolean; scope: string }> {
    try {
      return await this.activeClient.setKillSwitch(merchantId, payload);
    } catch {
      return this.mock.setKillSwitch(merchantId, payload);
    }
  }

  async getAuditTrail(merchantId: string, paymentId?: string): Promise<AuditEvent[]> {
    try {
      return await this.activeClient.getAuditTrail(merchantId, paymentId);
    } catch (e: any) {
      if (this.mode === 'live') {
        console.warn(`[Revly] Live backend audit request failed, falling back to mock sandbox:`, e);
        return this.mock.getAuditTrail(merchantId, paymentId);
      }
      throw e;
    }
  }

  async simulatePaymentFailed(
    merchantId: string,
    payload: PaymentFailedEventPayload
  ): Promise<Decision> {
    try {
      return await this.activeClient.simulatePaymentFailed(merchantId, payload);
    } catch {
      return this.mock.simulatePaymentFailed(merchantId, payload);
    }
  }
}

// Export primary API client instance
export const apiClient = new UnifiedRecoveryApiClient();
export const mockApiClient = new MockRecoveryApiClient();
export const createHttpApiClient = (baseUrl?: string) => new HttpRecoveryApiClient({ baseUrl });

