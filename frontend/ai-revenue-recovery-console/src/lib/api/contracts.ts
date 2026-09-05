/**
 * Backend API Contracts for Go Decision Engine (:8080)
 * As specified in backend HTTP surface specification (Phase 7).
 */

export interface BackendPaymentFailedEvent {
  schema_version: '0.1.0';
  external_event_id: string;
  merchant_id: string;
  payment_id: string;
  customer_id: string;
  event_type: 'payment.failed';
  amount: number; // integer paise
  currency: string; // "INR"
  method: string; // e.g. "card", "upi"
  failure_reason: string;
  prior_attempts: number;
  occurred_at: string; // ISO 8601
}

export interface BackendIngestResponse {
  status: 'ingested';
  duplicate: boolean;
  payment_event_id: string;
  external_event_id: string;
}

export interface BackendDecisionSummary {
  decision_id: string;
  payment_event_id: string;
  payment_id: string;
  chosen_action: string;
  erv_at_decision: number; // float or integer paise
  policy_check_result: 'ALLOW' | 'BLOCK' | 'HUMAN_REVIEW';
  policy_version: string;
  recovery_state: string; // e.g. "DONE", "ACTION_PENDING", "RECOVERY_ELIGIBLE"
  decided_at: string; // ISO 8601
}

export interface BackendDecisionsResponse {
  merchant_id: string;
  decisions: BackendDecisionSummary[];
}

export interface BackendCandidateAction {
  action: string;
  p_success: number; // float 0.0 - 1.0
  recoverable_amount: number; // paise
  cost: number; // paise
  friction_penalty: number; // paise
  erv: number; // paise
}

export interface BackendPolicyChecksDetail {
  policy_version: string;
  chosen_action: string;
  chosen_result: 'ALLOW' | 'BLOCK' | 'HUMAN_REVIEW';
  chosen_checks?: Array<{
    check_name?: string;
    id?: string;
    name?: string;
    passed: boolean;
    detail?: string;
    threshold?: string;
    actual_value?: string;
  }>;
  candidates?: unknown[];
}

export interface BackendDecisionDetail extends BackendDecisionSummary {
  merchant_id: string;
  root_cause: string;
  confidence: number; // 0.0 - 1.0
  rationale: string;
  diagnosis_model_version: string;
  success_model_version: string;
  candidates: BackendCandidateAction[];
  policy_checks: BackendPolicyChecksDetail;
}

export interface BackendOverrideRequest {
  action: string;
  reason: string;
}

export interface BackendOverrideResponse {
  status: 'override_recorded';
  decision_id: string;
  action: string;
  reason: string;
}

export interface BackendRecoverySummary {
  merchant_id: string;
  total_decisions: number;
  total_actions: number;
  recovered_count: number;
  recovered_amount: number; // paise
  intervention_cost: number; // paise
  net_recovered: number; // paise
  recovery_rate: number; // float, e.g. 0.4286 (42.86%)
  human_review_count: number;
  no_action_count: number;
}

export interface BackendAuditItem {
  id: string;
  entity_type: string;
  entity_id: string;
  actor: string;
  details: string;
  at: string; // ISO timestamp
}

export interface BackendAuditResponse {
  merchant_id: string;
  payment_id?: string;
  audit: BackendAuditItem[];
}

export interface BackendMerchantPolicyConfig {
  max_retries: number;
  cooldown_minutes: number;
  min_erv_threshold: number; // paise
  daily_action_cap: number;
  amount_ceiling: number; // paise
  confidence_floor_override?: number; // float 0.0 - 1.0
  kill_switch?: boolean;
}

export interface BackendKillSwitchRequest {
  scope: 'merchant' | 'global';
  enabled: boolean;
}

export interface BackendKillSwitchResponse {
  status: 'kill_switch_updated';
  scope: 'merchant' | 'global';
  enabled: boolean;
}

export interface BackendHealthResponse {
  status: string;
  db?: string;
  redis?: string;
  service?: string;
  version?: string;
}

export interface BackendErrorResponse {
  error: string;
  detail?: string;
}
