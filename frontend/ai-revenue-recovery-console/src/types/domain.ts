/**
 * Canonical Domain Types for AI Revenue Recovery Platform
 * Follows PLAN.md, FRONTEND_API_CONTRACT.md, and FRONTEND_PRODUCT_CONTEXT.md.
 */

export type RecoveryState =
  | 'FAILED'
  | 'DIAGNOSED'
  | 'RECOVERY_ELIGIBLE'
  | 'ACTION_SELECTED'
  | 'ACTION_PENDING'
  | 'RECOVERED'
  | 'RE_EVALUATE'
  | 'STOPPED'
  | 'DONE';

export type PolicyCheckResult =
  | 'ALLOW'
  | 'BLOCK'
  | 'HUMAN_REVIEW';

export type ActionStatus =
  | 'pending'
  | 'pending_confirmation'
  | 'confirmed'
  | 'failed';

export type CandidateActionType =
  | 'retry'
  | 'delayed_retry'
  | 'alternate_method'
  | 'payment_link'
  | 'reminder'
  | 'escalate'
  | 'no_action';

export interface CustomerContext {
  customer_id: string;
  name?: string;
  email?: string;
  phone?: string;
  historical_success_rate: number; // e.g. 0.92
  total_transactions: number;
  tier?: 'VIP' | 'Regular' | 'New';
}

export interface PaymentContext {
  payment_id: string;
  merchant_id: string;
  amount: number; // exact integer paise
  currency: string; // "INR"
  method: 'card' | 'upi' | 'netbanking' | 'wallet';
  method_details?: string; // e.g. "HDFC Visa ending 4012"
  customer: CustomerContext;
  payment_status: 'failed' | 'attempted' | 'resolved';
  failure_code: string; // e.g. "BAD_REQUEST_GATEWAY_TIMEOUT"
  failure_reason: string; // e.g. "Temporary bank gateway timeout"
  occurred_at: string;
  attempt_count: number;
  prior_attempts?: Array<{
    attempt_no: number;
    timestamp: string;
    action_type: CandidateActionType;
    status: string;
    error_message?: string;
  }>;
}

export interface Diagnosis {
  diagnosis_id: string;
  root_cause: string;
  confidence: number; // 0.0 - 1.0 (Diagnosis confidence, NOT P(success)!)
  rationale: string;
  source: 'AI-assisted' | 'Rule-based fallback';
  model_version?: string;
  diagnosed_at: string;
}

export interface CandidateActionItem {
  action_type: CandidateActionType;
  action_label: string;
  description: string;
  p_success: number; // 0.0 - 1.0 (P(success | context, action))
  recoverable_amount: number; // paise
  cost: number; // paise
  friction_penalty: number; // paise
  erv: number; // paise: p_success * recoverable_amount - cost - friction_penalty
  policy_result: PolicyCheckResult;
  is_winner?: boolean;
  policy_notes?: string;
}

export interface DeterministicPolicyCheck {
  id: string;
  name: string;
  category: 'safety' | 'limits' | 'economics' | 'governance';
  passed: boolean;
  actual_value: string;
  threshold: string;
  details: string;
}

export interface Decision {
  id: string;
  payment_id: string;
  merchant_id: string;
  chosen_action: CandidateActionType;
  erv_at_decision: number; // paise
  policy_version: string;
  policy_result: PolicyCheckResult;
  policy_checks: DeterministicPolicyCheck[];
  recovery_state: RecoveryState;
  created_at: string;
  updated_at: string;
  override_reason?: string;
  overridden_by?: string;
  overridden_at?: string;
  
  // Embedded or linked details
  payment: PaymentContext;
  diagnosis: Diagnosis;
  candidate_actions: CandidateActionItem[];
  execution?: ActionExecution;
  outcome?: RecoveryOutcome;
}

export interface ActionExecution {
  action_id: string;
  action_type: CandidateActionType;
  idempotency_key: string;
  status: ActionStatus;
  executed_at: string;
  external_reference?: string;
  retry_count: number;
  channel?: string;
}

export interface RecoveryOutcome {
  result: 'RECOVERED' | 'FAILED' | 'PENDING_CONFIRMATION' | 'STOPPED' | 'IN_PROGRESS';
  recovered_amount: number; // paise
  observed_at: string;
  duration_seconds?: number;
  notes?: string;
  reconciled?: boolean;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: 'System' | 'Policy Engine' | 'AI Diagnoser' | 'Executor' | 'Operator (Admin)';
  actor_id?: string;
  entity: 'Payment' | 'Decision' | 'Policy' | 'Action' | 'KillSwitch';
  entity_id: string;
  payment_id?: string;
  event_type: string;
  details: string;
  metadata?: Record<string, unknown>;
}

export interface MerchantPolicyConfig {
  merchant_id: string;
  merchant_name: string;
  max_retries: number;
  cooldown_minutes: number;
  daily_action_cap: number;
  min_erv_threshold: number; // paise
  amount_ceiling: number; // paise
  confidence_floor_override: number; // 0.0 - 1.0
  kill_switch_active: boolean;
  kill_switch_scope: 'merchant' | 'global';
  action_costs: Record<CandidateActionType, {
    monetary_cost: number; // paise
    friction_weight: number; // paise
  }>;
  updated_at: string;
  updated_by?: string;
}

export interface RecoverySummaryMetrics {
  revenue_at_risk: number; // paise
  recoverable_revenue: number; // paise
  recovered_revenue: number; // paise
  recovery_rate: number; // percentage (e.g. 48.4)
  active_interventions: number;
  retries_avoided: number;
  false_positive_escalations: number;
  cost_per_recovered_rupee: number; // e.g. 0.032
  trend: Array<{
    timestamp: string;
    label: string;
    revenue_at_risk: number; // paise
    recovered: number; // paise
  }>;
  interventions: Array<{
    action_type: CandidateActionType;
    label: string;
    attempts: number;
    recovered_count: number;
    recovery_rate: number;
    recovered_value: number; // paise
    total_cost: number; // paise
  }>;
}

export interface MerchantInfo {
  id: string;
  name: string;
  code: string;
  currency: string;
  industry: string;
  monthly_volume_paise: number;
}
