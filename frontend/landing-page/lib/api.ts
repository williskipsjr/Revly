/**
 * Revly API Client for Go Decision Engine (:8080)
 * Adheres strictly to docs/API_CONTRACTS.md
 */

export interface PaymentEventPayload {
  schema_version: '0.1.0';
  external_event_id: string;
  merchant_id: string;
  payment_id: string;
  customer_id: string;
  event_type: 'payment.failed';
  amount: number; // integer paise
  currency: string; // "INR"
  method: string; // "card", "upi", "netbanking"
  failure_reason: string;
  prior_attempts: number;
  occurred_at: string;
}

export interface IngestResponse {
  status: 'ingested';
  duplicate: boolean;
  payment_event_id: string;
  external_event_id: string;
}

export interface DecisionSummary {
  decision_id: string;
  payment_event_id: string;
  payment_id: string;
  chosen_action: string;
  erv_at_decision: number;
  policy_check_result: 'ALLOW' | 'BLOCK' | 'HUMAN_REVIEW';
  policy_version: string;
  recovery_state: string;
  decided_at: string;
}

export interface CandidateAction {
  action: string;
  p_success: number;
  recoverable_amount: number;
  cost: number;
  friction_penalty: number;
  erv: number;
}

export interface DecisionDetail extends DecisionSummary {
  merchant_id: string;
  root_cause: string;
  confidence: number;
  rationale: string;
  diagnosis_model_version: string;
  success_model_version: string;
  candidates: CandidateAction[];
  policy_checks: {
    policy_version: string;
    chosen_action: string;
    chosen_result: 'ALLOW' | 'BLOCK' | 'HUMAN_REVIEW';
    chosen_checks?: Array<{
      id?: string;
      name?: string;
      passed: boolean;
      detail?: string;
    }>;
  };
}

export interface RecoverySummaryMetrics {
  merchant_id: string;
  total_decisions: number;
  total_actions: number;
  recovered_count: number;
  recovered_amount: number;
  intervention_cost: number;
  net_recovered: number;
  recovery_rate: number;
  human_review_count: number;
  no_action_count: number;
}

export interface HealthStatus {
  ok: boolean;
  status?: string;
  service?: string;
  version?: string;
  db?: string;
  redis?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

export async function checkBackendHealth(): Promise<HealthStatus> {
  try {
    const res = await fetch(`${API_BASE}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return { ok: false };
    const data = await res.json();
    return { ok: true, ...data };
  } catch {
    return { ok: false };
  }
}

export async function getRecoverySummary(merchantId = 'merch_aggressive'): Promise<RecoverySummaryMetrics | null> {
  try {
    const res = await fetch(`${API_BASE}/v1/merchants/${merchantId}/metrics/recovery-summary`, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getRecentDecisions(merchantId = 'merch_aggressive', limit = 10): Promise<DecisionSummary[]> {
  try {
    const res = await fetch(`${API_BASE}/v1/merchants/${merchantId}/decisions?limit=${limit}`, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.decisions || [];
  } catch {
    return [];
  }
}

export async function getDecisionDetail(merchantId: string, decisionId: string): Promise<DecisionDetail | null> {
  try {
    const res = await fetch(`${API_BASE}/v1/merchants/${merchantId}/decisions/${decisionId}`, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function ingestPaymentFailed(event: PaymentEventPayload): Promise<IngestResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/v1/merchants/${event.merchant_id}/events/payment-failed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok && res.status !== 200 && res.status !== 201) return null;
    return await res.json();
  } catch {
    return null;
  }
}
