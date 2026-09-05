import {
  Decision,
  RecoverySummaryMetrics,
  MerchantPolicyConfig,
  AuditEvent,
  CandidateActionType,
  PaymentContext
} from '../../types/domain';

export interface PaymentFailedEventPayload {
  external_event_id: string;
  payment_id: string;
  amount: number; // paise
  currency: string;
  method: 'card' | 'upi' | 'netbanking' | 'wallet';
  failure_code: string;
  failure_reason: string;
  customer_id: string;
  customer_name?: string;
  customer_email?: string;
  timestamp?: string;
}

export interface DecisionOverridePayload {
  replacement_action: CandidateActionType;
  operator_reason: string;
  operator_id?: string;
}

export interface KillSwitchPayload {
  active: boolean;
  scope?: 'merchant' | 'global';
  reason: string;
}

export interface RecoveryFeedFilter {
  search?: string;
  status?: string;
  action?: string;
  policy_result?: string;
  date_range?: string;
  page?: number;
  limit?: number;
}

export interface RecoveryFeedResponse {
  decisions: Decision[];
  total_count: number;
  page: number;
  total_pages: number;
  summary_counts: {
    total: number;
    recovered: number;
    pending: number;
    failed: number;
    stopped: number;
    human_review: number;
  };
}

export interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}
