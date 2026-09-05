import {
  Decision,
  MerchantInfo,
  MerchantPolicyConfig,
  RecoverySummaryMetrics,
  AuditEvent
} from '../../types/domain';

export const MOCK_MERCHANTS: MerchantInfo[] = [
  {
    id: 'merch_acme_01',
    name: 'Acme Commerce',
    code: 'ACME',
    currency: 'INR',
    industry: 'Consumer Goods & D2C',
    monthly_volume_paise: 450000000 // ₹45 Lakhs
  },
  {
    id: 'merch_nexa_02',
    name: 'NexaRetail Global',
    code: 'NEXA',
    currency: 'INR',
    industry: 'Omnichannel Fashion',
    monthly_volume_paise: 820000000 // ₹82 Lakhs
  },
  {
    id: 'merch_zenith_03',
    name: 'Zenith Cloud SaaS',
    code: 'ZENITH',
    currency: 'INR',
    industry: 'Subscription B2B',
    monthly_volume_paise: 280000000 // ₹28 Lakhs
  }
];

export const MOCK_POLICIES: Record<string, MerchantPolicyConfig> = {
  merch_acme_01: {
    merchant_id: 'merch_acme_01',
    merchant_name: 'Acme Commerce',
    max_retries: 3,
    cooldown_minutes: 15,
    daily_action_cap: 500,
    min_erv_threshold: 5000, // ₹50.00
    amount_ceiling: 5000000, // ₹50,000.00
    confidence_floor_override: 0.75, // 75%
    kill_switch_active: false,
    kill_switch_scope: 'merchant',
    action_costs: {
      retry: { monetary_cost: 200, friction_weight: 12000 },
      delayed_retry: { monetary_cost: 200, friction_weight: 7200 },
      alternate_method: { monetary_cost: 350, friction_weight: 5000 },
      payment_link: { monetary_cost: 450, friction_weight: 6500 },
      reminder: { monetary_cost: 150, friction_weight: 8500 },
      escalate: { monetary_cost: 3500, friction_weight: 40000 },
      no_action: { monetary_cost: 0, friction_weight: 0 }
    },
    updated_at: '2026-09-02T14:30:00Z',
    updated_by: 'operator_priya@acme.com'
  },
  merch_nexa_02: {
    merchant_id: 'merch_nexa_02',
    merchant_name: 'NexaRetail Global',
    max_retries: 4,
    cooldown_minutes: 10,
    daily_action_cap: 1200,
    min_erv_threshold: 10000, // ₹100.00
    amount_ceiling: 10000000, // ₹1,00,000.00
    confidence_floor_override: 0.70,
    kill_switch_active: false,
    kill_switch_scope: 'merchant',
    action_costs: {
      retry: { monetary_cost: 250, friction_weight: 14000 },
      delayed_retry: { monetary_cost: 250, friction_weight: 8000 },
      alternate_method: { monetary_cost: 400, friction_weight: 4500 },
      payment_link: { monetary_cost: 500, friction_weight: 6000 },
      reminder: { monetary_cost: 200, friction_weight: 9000 },
      escalate: { monetary_cost: 4000, friction_weight: 35000 },
      no_action: { monetary_cost: 0, friction_weight: 0 }
    },
    updated_at: '2026-09-01T10:15:00Z',
    updated_by: 'operator_arun@nexa.com'
  },
  merch_zenith_03: {
    merchant_id: 'merch_zenith_03',
    merchant_name: 'Zenith Cloud SaaS',
    max_retries: 2,
    cooldown_minutes: 60,
    daily_action_cap: 250,
    min_erv_threshold: 15000, // ₹150.00
    amount_ceiling: 25000000, // ₹2,50,000.00
    confidence_floor_override: 0.80,
    kill_switch_active: false,
    kill_switch_scope: 'merchant',
    action_costs: {
      retry: { monetary_cost: 300, friction_weight: 20000 },
      delayed_retry: { monetary_cost: 300, friction_weight: 10000 },
      alternate_method: { monetary_cost: 500, friction_weight: 8000 },
      payment_link: { monetary_cost: 600, friction_weight: 5000 },
      reminder: { monetary_cost: 250, friction_weight: 12000 },
      escalate: { monetary_cost: 5000, friction_weight: 45000 },
      no_action: { monetary_cost: 0, friction_weight: 0 }
    },
    updated_at: '2026-08-30T16:45:00Z',
    updated_by: 'admin_neha@zenith.io'
  }
};

export const MOCK_SUMMARY_METRICS: Record<string, RecoverySummaryMetrics> = {
  merch_acme_01: {
    revenue_at_risk: 98450000, // ₹9,84,500 (at risk over last 30d)
    recoverable_revenue: 68200000, // ₹6,82,000 (economically recoverable)
    recovered_revenue: 47300000, // ₹4,73,000 (actually recovered)
    recovery_rate: 48.04, // 48.04% of total risk recovered (or 69.3% of recoverable)
    active_interventions: 42,
    retries_avoided: 184, // Unnecessary spam retries prevented
    false_positive_escalations: 3,
    cost_per_recovered_rupee: 0.038, // ₹0.038 cost to recover ₹1
    trend: [
      { timestamp: '2026-08-26', label: 'Aug 26', revenue_at_risk: 3120000, recovered: 1480000 },
      { timestamp: '2026-08-27', label: 'Aug 27', revenue_at_risk: 3450000, recovered: 1720000 },
      { timestamp: '2026-08-28', label: 'Aug 28', revenue_at_risk: 2980000, recovered: 1390000 },
      { timestamp: '2026-08-29', label: 'Aug 29', revenue_at_risk: 4200000, recovered: 2150000 },
      { timestamp: '2026-08-30', label: 'Aug 30', revenue_at_risk: 3890000, recovered: 1980000 },
      { timestamp: '2026-08-31', label: 'Aug 31', revenue_at_risk: 3600000, recovered: 1840000 },
      { timestamp: '2026-09-01', label: 'Sep 01', revenue_at_risk: 4100000, recovered: 2040000 },
      { timestamp: '2026-09-02', label: 'Sep 02', revenue_at_risk: 3750000, recovered: 1910000 },
      { timestamp: '2026-09-03', label: 'Sep 03', revenue_at_risk: 4400000, recovered: 2280000 },
      { timestamp: '2026-09-04', label: 'Today', revenue_at_risk: 2840000, recovered: 1420000 }
    ],
    interventions: [
      { action_type: 'delayed_retry', label: 'Delayed Retry', attempts: 210, recovered_count: 154, recovery_rate: 73.3, recovered_value: 23100000, total_cost: 42000 },
      { action_type: 'payment_link', label: 'Payment Link', attempts: 94, recovered_count: 58, recovery_rate: 61.7, recovered_value: 12450000, total_cost: 42300 },
      { action_type: 'alternate_method', label: 'Alternate Method', attempts: 62, recovered_count: 41, recovery_rate: 66.1, recovered_value: 7800000, total_cost: 21700 },
      { action_type: 'reminder', label: 'Reminder / Push', attempts: 48, recovered_count: 22, recovery_rate: 45.8, recovered_value: 3250000, total_cost: 7200 },
      { action_type: 'retry', label: 'Immediate Retry', attempts: 35, recovered_count: 8, recovery_rate: 22.8, recovered_value: 700000, total_cost: 7000 },
      { action_type: 'escalate', label: 'Human Escalation', attempts: 8, recovered_count: 4, recovery_rate: 50.0, recovered_value: 0, total_cost: 28000 }
    ]
  },
  merch_nexa_02: {
    revenue_at_risk: 142000000,
    recoverable_revenue: 94000000,
    recovered_revenue: 61200000,
    recovery_rate: 43.1,
    active_interventions: 68,
    retries_avoided: 312,
    false_positive_escalations: 5,
    cost_per_recovered_rupee: 0.041,
    trend: [
      { timestamp: '2026-08-29', label: 'Aug 29', revenue_at_risk: 5100000, recovered: 2300000 },
      { timestamp: '2026-08-30', label: 'Aug 30', revenue_at_risk: 4900000, recovered: 2100000 },
      { timestamp: '2026-08-31', label: 'Aug 31', revenue_at_risk: 5400000, recovered: 2450000 },
      { timestamp: '2026-09-01', label: 'Sep 01', revenue_at_risk: 6200000, recovered: 2800000 },
      { timestamp: '2026-09-02', label: 'Sep 02', revenue_at_risk: 5800000, recovered: 2600000 },
      { timestamp: '2026-09-03', label: 'Sep 03', revenue_at_risk: 6100000, recovered: 2900000 },
      { timestamp: '2026-09-04', label: 'Today', revenue_at_risk: 4200000, recovered: 1950000 }
    ],
    interventions: [
      { action_type: 'delayed_retry', label: 'Delayed Retry', attempts: 340, recovered_count: 240, recovery_rate: 70.6, recovered_value: 36000000, total_cost: 85000 },
      { action_type: 'payment_link', label: 'Payment Link', attempts: 140, recovered_count: 82, recovery_rate: 58.6, recovered_value: 16500000, total_cost: 70000 },
      { action_type: 'alternate_method', label: 'Alternate Method', attempts: 90, recovered_count: 55, recovery_rate: 61.1, recovered_value: 8700000, total_cost: 36000 }
    ]
  },
  merch_zenith_03: {
    revenue_at_risk: 62000000,
    recoverable_revenue: 48000000,
    recovered_revenue: 35200000,
    recovery_rate: 56.77,
    active_interventions: 19,
    retries_avoided: 95,
    false_positive_escalations: 1,
    cost_per_recovered_rupee: 0.029,
    trend: [
      { timestamp: '2026-08-29', label: 'Aug 29', revenue_at_risk: 2100000, recovered: 1250000 },
      { timestamp: '2026-08-30', label: 'Aug 30', revenue_at_risk: 2400000, recovered: 1400000 },
      { timestamp: '2026-08-31', label: 'Aug 31', revenue_at_risk: 2900000, recovered: 1750000 },
      { timestamp: '2026-09-01', label: 'Sep 01', revenue_at_risk: 3100000, recovered: 1900000 },
      { timestamp: '2026-09-02', label: 'Sep 02', revenue_at_risk: 2700000, recovered: 1600000 },
      { timestamp: '2026-09-03', label: 'Sep 03', revenue_at_risk: 2800000, recovered: 1700000 },
      { timestamp: '2026-09-04', label: 'Today', revenue_at_risk: 1800000, recovered: 1100000 }
    ],
    interventions: [
      { action_type: 'payment_link', label: 'Payment Link', attempts: 65, recovered_count: 48, recovery_rate: 73.8, recovered_value: 21000000, total_cost: 39000 },
      { action_type: 'delayed_retry', label: 'Delayed Retry', attempts: 52, recovered_count: 35, recovery_rate: 67.3, recovered_value: 12200000, total_cost: 15600 },
      { action_type: 'reminder', label: 'Reminder / Push', attempts: 25, recovered_count: 11, recovery_rate: 44.0, recovered_value: 2000000, total_cost: 6250 }
    ]
  }
};

export const MOCK_DECISIONS: Decision[] = [
  {
    id: 'DEC-8F31A2',
    payment_id: 'pay_Hdfc8914A',
    merchant_id: 'merch_acme_01',
    chosen_action: 'delayed_retry',
    erv_at_decision: 749011, // ₹7,490.11
    policy_version: 'v2.4.1-rc3',
    policy_result: 'ALLOW',
    recovery_state: 'RECOVERED',
    created_at: '2026-09-04T09:23:14Z',
    updated_at: '2026-09-04T09:54:20Z',
    payment: {
      payment_id: 'pay_Hdfc8914A',
      merchant_id: 'merch_acme_01',
      amount: 849900, // ₹8,499.00
      currency: 'INR',
      method: 'card',
      method_details: 'HDFC Bank Visa Corporate ending 4012',
      payment_status: 'resolved',
      failure_code: 'BANK_TEMP_DECLINE',
      failure_reason: 'Temporary issuer switch failure (052: Switch unavailable)',
      occurred_at: '2026-09-04T09:21:48Z',
      attempt_count: 1,
      customer: {
        customer_id: 'cust_9812_rahul',
        name: 'Rahul Verma',
        email: 'rahul.verma@enterprise.in',
        phone: '+91 98201 44102',
        historical_success_rate: 0.94,
        total_transactions: 38,
        tier: 'VIP'
      },
      prior_attempts: [
        {
          attempt_no: 1,
          timestamp: '2026-09-04T09:21:48Z',
          action_type: 'retry',
          status: 'failed',
          error_message: '052 Switch unavailable'
        }
      ]
    },
    diagnosis: {
      diagnosis_id: 'diag_8f31_001',
      root_cause: 'Temporary bank issuer switch decline',
      confidence: 0.94, // 94% diagnosis confidence
      rationale: 'The payment failed during a temporary HDFC core banking switch maintenance window. Customer has 94% historical transaction success across 38 prior orders, with zero fraud markers. Low-friction delayed retry via secondary routing switch recommended.',
      source: 'AI-assisted',
      model_version: 'gemini-1.5-pro-fintech-v3',
      diagnosed_at: '2026-09-04T09:22:30Z'
    },
    candidate_actions: [
      {
        action_type: 'delayed_retry',
        action_label: 'Delayed Retry (30m Cooldown)',
        description: 'Auto-schedule idempotent re-attempt after issuer switch stabilizes (30 min cooldown window)',
        p_success: 0.89, // 89% recovery probability
        recoverable_amount: 849900, // ₹8,499.00
        cost: 200, // ₹2.00 API routing fee
        friction_penalty: 7200, // ₹72.00 customer waiting penalty
        erv: 749011, // (0.89 * 849900) - 200 - 7200 = 749011 (₹7,490)
        policy_result: 'ALLOW',
        is_winner: true,
        policy_notes: 'Highest ERV among safe actions; within all merchant policy constraints'
      },
      {
        action_type: 'payment_link',
        action_label: 'Interactive Payment Link via SMS/Email',
        description: 'Send direct Razorpay checkout payment link for user to select alternative payment instrument',
        p_success: 0.74,
        recoverable_amount: 849900,
        cost: 450, // ₹4.50 notification & gateway cost
        friction_penalty: 6500, // ₹65.00
        erv: 621976, // ₹6,220
        policy_result: 'ALLOW',
        is_winner: false,
        policy_notes: 'Viable secondary fallback'
      },
      {
        action_type: 'reminder',
        action_label: 'Smart Push Notification / WhatsApp',
        description: 'Notify customer of interrupted checkout with 1-click retry token',
        p_success: 0.61,
        recoverable_amount: 849900,
        cost: 150,
        friction_penalty: 8500,
        erv: 509789, // ₹5,098
        policy_result: 'ALLOW',
        is_winner: false
      },
      {
        action_type: 'retry',
        action_label: 'Immediate Retry',
        description: 'Trigger instant retry without cooldown',
        p_success: 0.42,
        recoverable_amount: 849900,
        cost: 200,
        friction_penalty: 12000,
        erv: 344758, // ₹3,448
        policy_result: 'ALLOW',
        is_winner: false,
        policy_notes: 'Suboptimal due to high failure probability during active bank outage'
      },
      {
        action_type: 'alternate_method',
        action_label: 'Suggest Alternate UPI Handle',
        description: 'Prompt customer for verified VPA',
        p_success: 0.52,
        recoverable_amount: 849900,
        cost: 350,
        friction_penalty: 15000,
        erv: 426598, // ₹4,266
        policy_result: 'ALLOW',
        is_winner: false
      },
      {
        action_type: 'escalate',
        action_label: 'Escalate to Merchant Support Queue',
        description: 'Create Zendesk/Ops priority ticket',
        p_success: 0.38,
        recoverable_amount: 849900,
        cost: 3500, // ₹35.00 support rep cost
        friction_penalty: 40000, // ₹400.00 high friction
        erv: 279462, // ₹2,795
        policy_result: 'ALLOW',
        is_winner: false
      },
      {
        action_type: 'no_action',
        action_label: 'No Action (Drop)',
        description: 'Close recovery without further attempts',
        p_success: 0.00,
        recoverable_amount: 849900,
        cost: 0,
        friction_penalty: 0,
        erv: 0,
        policy_result: 'ALLOW',
        is_winner: false
      }
    ],
    policy_checks: [
      {
        id: 'chk_01',
        name: 'Retry Limit Ceiling',
        category: 'limits',
        passed: true,
        actual_value: '1 of 3 retries used',
        threshold: '<= 3 attempts',
        details: 'Attempt count is within merchant maximum retry bound'
      },
      {
        id: 'chk_02',
        name: 'Minimum ERV Floor',
        category: 'economics',
        passed: true,
        actual_value: '₹7,490.11',
        threshold: '>= ₹50.00',
        details: 'Expected recovery value significantly exceeds minimum merchant economics threshold'
      },
      {
        id: 'chk_03',
        name: 'Automated Action Amount Ceiling',
        category: 'limits',
        passed: true,
        actual_value: '₹8,499.00',
        threshold: '<= ₹50,000.00',
        details: 'Amount is below merchant threshold for requiring manual operator approval'
      },
      {
        id: 'chk_04',
        name: 'Diagnosis Confidence Floor',
        category: 'governance',
        passed: true,
        actual_value: '94.0%',
        threshold: '>= 75.0%',
        details: 'Model diagnosis confidence meets high-certainty execution requirement'
      },
      {
        id: 'chk_05',
        name: 'Emergency Kill Switch',
        category: 'safety',
        passed: true,
        actual_value: 'INACTIVE',
        threshold: 'Must be INACTIVE',
        details: 'Global and merchant recovery kill-switches are disengaged'
      },
      {
        id: 'chk_06',
        name: 'Cooldown Window Constraint',
        category: 'limits',
        passed: true,
        actual_value: '0 min remaining',
        threshold: '>= 0 min',
        details: 'Pre-execution cooldown period has successfully elapsed'
      }
    ],
    execution: {
      action_id: 'act_delayed_8f31',
      action_type: 'delayed_retry',
      idempotency_key: 'idem_rec_8f31a2_attempt_2',
      status: 'confirmed',
      executed_at: '2026-09-04T09:53:14Z',
      external_reference: 'rzp_pay_rec_8832104',
      retry_count: 2,
      channel: 'HDFC Secondary Gateway Switch'
    },
    outcome: {
      result: 'RECOVERED',
      recovered_amount: 849900,
      observed_at: '2026-09-04T09:54:20Z',
      duration_seconds: 1866,
      notes: 'Captured ₹8,499.00 successfully on delayed retry. Transaction cleared bank reconciliation.'
    }
  },
  {
    id: 'DEC-9B42E1',
    payment_id: 'pay_Corp_145000',
    merchant_id: 'merch_acme_01',
    chosen_action: 'escalate',
    erv_at_decision: 11200000, // ₹1,12,000
    policy_version: 'v2.4.1-rc3',
    policy_result: 'HUMAN_REVIEW',
    recovery_state: 'RECOVERY_ELIGIBLE',
    created_at: '2026-09-04T08:45:10Z',
    updated_at: '2026-09-04T08:45:12Z',
    payment: {
      payment_id: 'pay_Corp_145000',
      merchant_id: 'merch_acme_01',
      amount: 14500000, // ₹1,45,000.00
      currency: 'INR',
      method: 'netbanking',
      method_details: 'ICICI Corporate Netbanking',
      payment_status: 'failed',
      failure_code: 'CORP_AUTH_LIMIT_EXCEEDED',
      failure_reason: 'Transaction exceeds standard automated single-tx limit (Corp checker required)',
      occurred_at: '2026-09-04T08:44:02Z',
      attempt_count: 1,
      customer: {
        customer_id: 'cust_corp_4412',
        name: 'Kiran Technologies Pvt Ltd',
        email: 'finance@kirantech.in',
        phone: '+91 99800 23145',
        historical_success_rate: 0.98,
        total_transactions: 112,
        tier: 'VIP'
      }
    },
    diagnosis: {
      diagnosis_id: 'diag_9b42_002',
      root_cause: 'Corporate authorization matrix pending second approver',
      confidence: 0.91,
      rationale: 'High-value corporate procurement transaction requiring multi-tier token authorization on ICICI Corporate Netbanking portal. Automated blind retry is contraindicated.',
      source: 'AI-assisted',
      model_version: 'gemini-1.5-pro-fintech-v3',
      diagnosed_at: '2026-09-04T08:45:00Z'
    },
    candidate_actions: [
      {
        action_type: 'payment_link',
        action_label: 'Invoice Payment Link with RTGS/NEFT option',
        description: 'Generate dedicated virtual account with checker-maker link',
        p_success: 0.82,
        recoverable_amount: 14500000,
        cost: 800,
        friction_penalty: 15000,
        erv: 11874200, // ₹1,18,742
        policy_result: 'HUMAN_REVIEW',
        is_winner: true,
        policy_notes: 'Held for human review: Amount exceeds automated action ceiling ₹50,000'
      },
      {
        action_type: 'delayed_retry',
        action_label: 'Delayed Retry',
        description: 'Wait for corporate batch clearing window',
        p_success: 0.65,
        recoverable_amount: 14500000,
        cost: 300,
        friction_penalty: 25000,
        erv: 9399700, // ₹93,997
        policy_result: 'HUMAN_REVIEW',
        is_winner: false
      },
      {
        action_type: 'escalate',
        action_label: 'Key Account Manager Escalation',
        description: 'Alert Enterprise Relationship Desk',
        p_success: 0.78,
        recoverable_amount: 14500000,
        cost: 5000,
        friction_penalty: 20000,
        erv: 11285000,
        policy_result: 'HUMAN_REVIEW',
        is_winner: false
      }
    ],
    policy_checks: [
      {
        id: 'chk_9b_01',
        name: 'Automated Action Amount Ceiling',
        category: 'limits',
        passed: false,
        actual_value: '₹1,45,000.00',
        threshold: '<= ₹50,000.00',
        details: 'Safety breach: Amount exceeds automated execution cap. Requires manual operator approval.'
      },
      {
        id: 'chk_9b_02',
        name: 'Retry Limit Ceiling',
        category: 'limits',
        passed: true,
        actual_value: '1 of 3 attempts',
        threshold: '<= 3 attempts',
        details: 'Attempt count within limits'
      },
      {
        id: 'chk_9b_03',
        name: 'Minimum ERV Floor',
        category: 'economics',
        passed: true,
        actual_value: '₹1,18,742.00',
        threshold: '>= ₹50.00',
        details: 'Substantial expected value'
      }
    ],
    outcome: {
      result: 'IN_PROGRESS',
      recovered_amount: 0,
      observed_at: '2026-09-04T08:45:10Z',
      notes: 'Decision flagged for HUMAN_REVIEW. Operator action required before execution.'
    }
  },
  {
    id: 'DEC-3C18F0',
    payment_id: 'pay_Card_3200_max',
    merchant_id: 'merch_acme_01',
    chosen_action: 'no_action',
    erv_at_decision: 0,
    policy_version: 'v2.4.1-rc3',
    policy_result: 'BLOCK',
    recovery_state: 'STOPPED',
    created_at: '2026-09-04T07:12:00Z',
    updated_at: '2026-09-04T07:12:05Z',
    payment: {
      payment_id: 'pay_Card_3200_max',
      merchant_id: 'merch_acme_01',
      amount: 320000, // ₹3,200.00
      currency: 'INR',
      method: 'card',
      method_details: 'SBI Debit Card ending 7731',
      payment_status: 'failed',
      failure_code: 'INSUFFICIENT_FUNDS_MAX_RETRIES',
      failure_reason: '51: Insufficient funds on cardholder account',
      occurred_at: '2026-09-04T07:11:15Z',
      attempt_count: 3,
      customer: {
        customer_id: 'cust_sbi_9912',
        name: 'Sunita Rao',
        email: 'sunita.rao99@gmail.com',
        historical_success_rate: 0.62,
        total_transactions: 8,
        tier: 'Regular'
      },
      prior_attempts: [
        { attempt_no: 1, timestamp: '2026-09-03T18:10:00Z', action_type: 'retry', status: 'failed', error_message: '51: Insufficient funds' },
        { attempt_no: 2, timestamp: '2026-09-04T02:30:00Z', action_type: 'delayed_retry', status: 'failed', error_message: '51: Insufficient funds' },
        { attempt_no: 3, timestamp: '2026-09-04T07:11:15Z', action_type: 'delayed_retry', status: 'failed', error_message: '51: Insufficient funds' }
      ]
    },
    diagnosis: {
      diagnosis_id: 'diag_3c18_003',
      root_cause: 'Persistent insufficient funds decline',
      confidence: 0.96,
      rationale: 'Three consecutive re-attempts over 13 hours have returned hard insufficient funds (Error 51). Customer account balance remains depleted. Economic models indicate positive ERV for further links, but safety policy firmly prohibits harassment or additional retries.',
      source: 'AI-assisted',
      model_version: 'gemini-1.5-pro-fintech-v3',
      diagnosed_at: '2026-09-04T07:11:50Z'
    },
    candidate_actions: [
      {
        action_type: 'payment_link',
        action_label: 'Send Alternate Payment Link',
        description: 'Send payment link with netbanking/UPI alternatives',
        p_success: 0.35,
        recoverable_amount: 320000,
        cost: 450,
        friction_penalty: 25000, // High friction due to 3 prior contacts
        erv: 86550, // ₹865.50
        policy_result: 'BLOCK',
        is_winner: false,
        policy_notes: 'Blocked by Policy: Retry limit reached (3 of 3)'
      },
      {
        action_type: 'delayed_retry',
        action_label: 'Delayed Retry',
        description: 'Retry again after 24 hours',
        p_success: 0.28,
        recoverable_amount: 320000,
        cost: 200,
        friction_penalty: 30000,
        erv: 59400, // ₹594.00
        policy_result: 'BLOCK',
        is_winner: false,
        policy_notes: 'Blocked by Policy: Max retries exceeded'
      },
      {
        action_type: 'no_action',
        action_label: 'No Action / Terminate Recovery',
        description: 'Respect merchant policy limit and halt automated execution',
        p_success: 0.00,
        recoverable_amount: 320000,
        cost: 0,
        friction_penalty: 0,
        erv: 0,
        policy_result: 'ALLOW',
        is_winner: true,
        policy_notes: 'Enforced by policy engine to prevent merchant reputational damage'
      }
    ],
    policy_checks: [
      {
        id: 'chk_3c_01',
        name: 'Retry Limit Ceiling',
        category: 'limits',
        passed: false,
        actual_value: '3 of 3 attempts used',
        threshold: '<= 3 attempts',
        details: 'Policy breach: Max retries exhausted. Further automated actions blocked.'
      },
      {
        id: 'chk_3c_02',
        name: 'Customer Fatigue Prevention',
        category: 'governance',
        passed: false,
        actual_value: '3 notifications sent in 24h',
        threshold: '<= 2 notifications/day',
        details: 'Contact frequency threshold exceeded'
      }
    ],
    outcome: {
      result: 'STOPPED',
      recovered_amount: 0,
      observed_at: '2026-09-04T07:12:05Z',
      notes: 'Recovery gracefully terminated by policy engine. Zero spam retries executed.'
    }
  },
  {
    id: 'DEC-5D77A9',
    payment_id: 'pay_Upi_12500_ambig',
    merchant_id: 'merch_acme_01',
    chosen_action: 'payment_link',
    erv_at_decision: 912500, // ₹9,125.00
    policy_version: 'v2.4.1-rc3',
    policy_result: 'ALLOW',
    recovery_state: 'ACTION_PENDING',
    created_at: '2026-09-04T09:10:00Z',
    updated_at: '2026-09-04T09:35:10Z',
    payment: {
      payment_id: 'pay_Upi_12500_ambig',
      merchant_id: 'merch_acme_01',
      amount: 1250000, // ₹12,500.00
      currency: 'INR',
      method: 'upi',
      method_details: 'UPI Collect request to aman.k@okhdfcbank',
      payment_status: 'failed',
      failure_code: 'UPI_COLLECT_TIMEOUT',
      failure_reason: 'UPI collect notification timed out on customer device (U30)',
      occurred_at: '2026-09-04T09:08:22Z',
      attempt_count: 1,
      customer: {
        customer_id: 'cust_aman_5510',
        name: 'Aman Kulkarni',
        email: 'aman.k@techlead.co',
        phone: '+91 97654 32190',
        historical_success_rate: 0.88,
        total_transactions: 22,
        tier: 'Regular'
      }
    },
    diagnosis: {
      diagnosis_id: 'diag_5d77_004',
      root_cause: 'UPI app notification delivery delay / intent expiration',
      confidence: 0.88,
      rationale: 'Customer was not actively viewing banking app when UPI collect was triggered. Payment link dispatched via WhatsApp & SMS with 15-minute intent deep link.',
      source: 'AI-assisted',
      model_version: 'gemini-1.5-pro-fintech-v3',
      diagnosed_at: '2026-09-04T09:09:40Z'
    },
    candidate_actions: [
      {
        action_type: 'payment_link',
        action_label: 'Instant Payment Link with QR',
        description: 'Send dynamic intent URL with instant QR fallback',
        p_success: 0.78,
        recoverable_amount: 1250000,
        cost: 450,
        friction_penalty: 5800,
        erv: 968750, // ₹9,687.50
        policy_result: 'ALLOW',
        is_winner: true,
        policy_notes: 'Optimal user-initiated recovery mechanism'
      },
      {
        action_type: 'retry',
        action_label: 'Immediate UPI Collect Retry',
        description: 'Re-push UPI collect',
        p_success: 0.25,
        recoverable_amount: 1250000,
        cost: 200,
        friction_penalty: 18000,
        erv: 294300,
        policy_result: 'ALLOW',
        is_winner: false
      }
    ],
    policy_checks: [
      {
        id: 'chk_5d_01',
        name: 'Retry Limit Ceiling',
        category: 'limits',
        passed: true,
        actual_value: '1 of 3 retries',
        threshold: '<= 3',
        details: 'Within bounds'
      },
      {
        id: 'chk_5d_02',
        name: 'Minimum ERV Floor',
        category: 'economics',
        passed: true,
        actual_value: '₹9,687.50',
        threshold: '>= ₹50.00',
        details: 'Passed'
      }
    ],
    execution: {
      action_id: 'act_plink_5d77',
      action_type: 'payment_link',
      idempotency_key: 'idem_rec_5d77_plink_1',
      status: 'pending_confirmation', // Outcome pending confirmation!
      executed_at: '2026-09-04T09:10:45Z',
      external_reference: 'plink_998144023',
      retry_count: 1,
      channel: 'WhatsApp Notification & SMS'
    },
    outcome: {
      result: 'PENDING_CONFIRMATION',
      recovered_amount: 0,
      observed_at: '2026-09-04T09:35:10Z',
      notes: 'Customer opened payment link 4 mins ago. Outcome pending confirmation — waiting for gateway webhook reconciliation; system will not blind retry.'
    }
  },
  {
    id: 'DEC-7E29C3',
    payment_id: 'pay_Upi_6800_degraded',
    merchant_id: 'merch_acme_01',
    chosen_action: 'payment_link',
    erv_at_decision: 541200, // ₹5,412.00
    policy_version: 'v2.4.1-rc3',
    policy_result: 'ALLOW',
    recovery_state: 'RECOVERED',
    created_at: '2026-09-04T06:30:12Z',
    updated_at: '2026-09-04T06:48:30Z',
    payment: {
      payment_id: 'pay_Upi_6800_degraded',
      merchant_id: 'merch_acme_01',
      amount: 680000, // ₹6,800.00
      currency: 'INR',
      method: 'upi',
      method_details: 'Google Pay UPI',
      payment_status: 'resolved',
      failure_code: 'NPCI_SWITCH_TIMEOUT',
      failure_reason: 'NPCI central switch latency spike > 5000ms',
      occurred_at: '2026-09-04T06:29:40Z',
      attempt_count: 1,
      customer: {
        customer_id: 'cust_tanvi_3301',
        name: 'Tanvi Shah',
        email: 'tanvi.shah@outlook.com',
        phone: '+91 98450 11982',
        historical_success_rate: 0.91,
        total_transactions: 14,
        tier: 'Regular'
      }
    },
    diagnosis: {
      diagnosis_id: 'diag_7e29_fallback',
      root_cause: 'NPCI central switch timeout (Rule-based Fallback Active)',
      confidence: 0.85,
      rationale: 'AI diagnosis service experienced transient timeout. The decision engine smoothly degraded to deterministic rule-based fallback heuristics: NPCI switch timeout matched known rule RB-04. Rule recommends alternate payment instrument link with 15 min expiry.',
      source: 'Rule-based fallback',
      model_version: 'rule-engine-v1.8.0',
      diagnosed_at: '2026-09-04T06:30:05Z'
    },
    candidate_actions: [
      {
        action_type: 'payment_link',
        action_label: 'Payment Link (Fallback Rule RB-04)',
        description: 'Provide omnichannel checkout link with cards/netbanking options',
        p_success: 0.81,
        recoverable_amount: 680000,
        cost: 450,
        friction_penalty: 5500,
        erv: 544850,
        policy_result: 'ALLOW',
        is_winner: true,
        policy_notes: 'Rule-based evaluation approved'
      },
      {
        action_type: 'retry',
        action_label: 'Immediate Retry',
        description: 'Retry on same NPCI switch',
        p_success: 0.15,
        recoverable_amount: 680000,
        cost: 200,
        friction_penalty: 15000,
        erv: 86800,
        policy_result: 'ALLOW',
        is_winner: false
      }
    ],
    policy_checks: [
      {
        id: 'chk_7e_01',
        name: 'Fallback Heuristic Validation',
        category: 'governance',
        passed: true,
        actual_value: 'Rule RB-04 match',
        threshold: 'Approved ruleset',
        details: 'Deterministic rule approved by compliance matrix'
      },
      {
        id: 'chk_7e_02',
        name: 'Confidence Floor Override',
        category: 'governance',
        passed: true,
        actual_value: '85.0%',
        threshold: '>= 75.0%',
        details: 'Meets minimum threshold for rule-based routing'
      }
    ],
    execution: {
      action_id: 'act_plink_7e29',
      action_type: 'payment_link',
      idempotency_key: 'idem_rec_7e29_plink_1',
      status: 'confirmed',
      executed_at: '2026-09-04T06:30:45Z',
      external_reference: 'plink_77123901',
      retry_count: 1,
      channel: 'SMS Link Delivery'
    },
    outcome: {
      result: 'RECOVERED',
      recovered_amount: 680000,
      observed_at: '2026-09-04T06:48:30Z',
      duration_seconds: 1065,
      notes: 'Customer paid ₹6,800.00 via Netbanking on the recovery link. Degraded pipeline recovered revenue safely.'
    }
  },
  {
    id: 'DEC-2A61D4',
    payment_id: 'pay_Upi_2499_alt',
    merchant_id: 'merch_acme_01',
    chosen_action: 'alternate_method',
    erv_at_decision: 198000, // ₹1,980.00
    policy_version: 'v2.4.1-rc3',
    policy_result: 'ALLOW',
    recovery_state: 'RECOVERED',
    created_at: '2026-09-03T19:40:00Z',
    updated_at: '2026-09-03T19:44:12Z',
    payment: {
      payment_id: 'pay_Upi_2499_alt',
      merchant_id: 'merch_acme_01',
      amount: 249900, // ₹2,499.00
      currency: 'INR',
      method: 'upi',
      method_details: 'Paytm UPI Collect',
      payment_status: 'resolved',
      failure_code: 'VPA_HANDLE_INACTIVE',
      failure_reason: 'Customer virtual payment address @paytm is deregistered',
      occurred_at: '2026-09-03T19:39:10Z',
      attempt_count: 1,
      customer: {
        customer_id: 'cust_vikram_8821',
        name: 'Vikram Joshi',
        email: 'vikram.j@gmail.com',
        phone: '+91 99100 88214',
        historical_success_rate: 0.95,
        total_transactions: 42,
        tier: 'VIP'
      }
    },
    diagnosis: {
      diagnosis_id: 'diag_2a61_006',
      root_cause: 'Deregistered UPI handle (VPA expired)',
      confidence: 0.98,
      rationale: 'Customer switched banking handles after migration. Retrying identical VPA has 0% chance of success. Prompting for dynamic QR / alternate method on checkout screen has 81% P(success).',
      source: 'AI-assisted',
      model_version: 'gemini-1.5-pro-fintech-v3',
      diagnosed_at: '2026-09-03T19:39:45Z'
    },
    candidate_actions: [
      {
        action_type: 'alternate_method',
        action_label: 'Prompt Dynamic QR on Checkout',
        description: 'Instant inline modal presenting Dynamic UPI QR code',
        p_success: 0.81,
        recoverable_amount: 249900,
        cost: 350,
        friction_penalty: 3800,
        erv: 198269, // ₹1,982.69
        policy_result: 'ALLOW',
        is_winner: true,
        policy_notes: 'Clear winner: retry is guaranteed to fail due to dead VPA'
      },
      {
        action_type: 'retry',
        action_label: 'Immediate VPA Retry',
        description: 'Retry dead VPA handle',
        p_success: 0.02,
        recoverable_amount: 249900,
        cost: 200,
        friction_penalty: 15000,
        erv: -10202, // Negative ERV!
        policy_result: 'BLOCK',
        is_winner: false,
        policy_notes: 'Blocked by minimum ERV floor (Negative ERV)'
      }
    ],
    policy_checks: [
      {
        id: 'chk_2a_01',
        name: 'Minimum ERV Floor',
        category: 'economics',
        passed: true,
        actual_value: '₹1,982.69',
        threshold: '>= ₹50.00',
        details: 'Passed'
      }
    ],
    execution: {
      action_id: 'act_alt_2a61',
      action_type: 'alternate_method',
      idempotency_key: 'idem_rec_2a61_alt_1',
      status: 'confirmed',
      executed_at: '2026-09-03T19:40:20Z',
      external_reference: 'qr_pay_881920',
      retry_count: 1,
      channel: 'Dynamic QR Overlay'
    },
    outcome: {
      result: 'RECOVERED',
      recovered_amount: 249900,
      observed_at: '2026-09-03T19:44:12Z',
      duration_seconds: 232,
      notes: 'Customer scanned dynamic QR with BHIM app; recovered ₹2,499 in under 4 minutes.'
    }
  },
  {
    id: 'DEC-1F88B7',
    payment_id: 'pay_Sub_1899_frict',
    merchant_id: 'merch_acme_01',
    chosen_action: 'delayed_retry',
    erv_at_decision: 145000, // ₹1,450.00
    policy_version: 'v2.4.1-rc3',
    policy_result: 'ALLOW',
    recovery_state: 'RECOVERED',
    created_at: '2026-09-03T14:15:00Z',
    updated_at: '2026-09-03T16:02:10Z',
    payment: {
      payment_id: 'pay_Sub_1899_frict',
      merchant_id: 'merch_acme_01',
      amount: 189900, // ₹1,899.00
      currency: 'INR',
      method: 'card',
      method_details: 'Axis Bank Credit Card ending 1109',
      payment_status: 'resolved',
      failure_code: 'MANDATE_BATCH_CONGESTION',
      failure_reason: 'Recurring subscription mandate processing backlog',
      occurred_at: '2026-09-03T14:14:02Z',
      attempt_count: 1,
      customer: {
        customer_id: 'cust_ananya_1102',
        name: 'Ananya Deshmukh',
        email: 'ananya.d@gmail.com',
        historical_success_rate: 0.97,
        total_transactions: 19,
        tier: 'Regular'
      }
    },
    diagnosis: {
      diagnosis_id: 'diag_1f88_007',
      root_cause: 'Recurring card mandate clearing congestion at issuer',
      confidence: 0.92,
      rationale: 'Customer auto-debit queue congested. Customer received 2 marketing emails earlier today. Reminder action carries heavy friction penalty (₹150) that damages retention. Silent delayed retry carries negligible friction (₹25) and maximizes ERV.',
      source: 'AI-assisted',
      model_version: 'gemini-1.5-pro-fintech-v3',
      diagnosed_at: '2026-09-03T14:14:45Z'
    },
    candidate_actions: [
      {
        action_type: 'delayed_retry',
        action_label: 'Silent Delayed Retry (2hr Cooldown)',
        description: 'Re-submit mandate batch during low-traffic afternoon window without disturbing customer',
        p_success: 0.80,
        recoverable_amount: 189900,
        cost: 200,
        friction_penalty: 2500, // Minimal friction: customer is not contacted
        erv: 149220, // ₹1,492.20
        policy_result: 'ALLOW',
        is_winner: true,
        policy_notes: 'Won due to low friction penalty vs high customer contact friction'
      },
      {
        action_type: 'reminder',
        action_label: 'Customer Payment Reminder Push',
        description: 'Send push notification to update billing details',
        p_success: 0.72,
        recoverable_amount: 189900,
        cost: 150,
        friction_penalty: 15000, // High friction: customer annoyed by redundant notifications
        erv: 121578, // ₹1,215.78
        policy_result: 'ALLOW',
        is_winner: false
      }
    ],
    policy_checks: [
      {
        id: 'chk_1f_01',
        name: 'Retry Limit Ceiling',
        category: 'limits',
        passed: true,
        actual_value: '1 of 3 retries',
        threshold: '<= 3',
        details: 'Passed'
      }
    ],
    execution: {
      action_id: 'act_silent_1f88',
      action_type: 'delayed_retry',
      idempotency_key: 'idem_rec_1f88_retry_2',
      status: 'confirmed',
      executed_at: '2026-09-03T16:00:10Z',
      external_reference: 'mandate_batch_4401',
      retry_count: 2
    },
    outcome: {
      result: 'RECOVERED',
      recovered_amount: 189900,
      observed_at: '2026-09-03T16:02:10Z',
      duration_seconds: 6428,
      notes: 'Cleared on automated batch retry. Customer was never disturbed; subscription preserved.'
    }
  }
];

export const MOCK_AUDIT_LOG: AuditEvent[] = [
  {
    id: 'aud_001',
    timestamp: '2026-09-04T09:54:20Z',
    actor: 'Executor',
    entity: 'Payment',
    entity_id: 'pay_Hdfc8914A',
    payment_id: 'pay_Hdfc8914A',
    event_type: 'PAYMENT_RECOVERED',
    details: 'Received successful capture callback rzp_pay_rec_8832104 for ₹8,499.00. Recovery state updated to RECOVERED.'
  },
  {
    id: 'aud_002',
    timestamp: '2026-09-04T09:53:14Z',
    actor: 'Executor',
    entity: 'Action',
    entity_id: 'act_delayed_8f31',
    payment_id: 'pay_Hdfc8914A',
    event_type: 'ACTION_EXECUTED',
    details: 'Idempotent dispatch of delayed_retry via HDFC Secondary Gateway Switch. IdempotencyKey=idem_rec_8f31a2_attempt_2.'
  },
  {
    id: 'aud_003',
    timestamp: '2026-09-04T09:23:14Z',
    actor: 'Policy Engine',
    entity: 'Decision',
    entity_id: 'DEC-8F31A2',
    payment_id: 'pay_Hdfc8914A',
    event_type: 'POLICY_EVALUATION_COMPLETED',
    details: 'Deterministic policy evaluation result: ALLOW. 6 of 6 checks passed. Action delayed_retry authorized with ERV ₹7,490.11.'
  },
  {
    id: 'aud_004',
    timestamp: '2026-09-04T09:22:30Z',
    actor: 'AI Diagnoser',
    entity: 'Decision',
    entity_id: 'DEC-8F31A2',
    payment_id: 'pay_Hdfc8914A',
    event_type: 'DIAGNOSIS_COMPLETED',
    details: 'Diagnosis completed with 94% confidence: Temporary bank issuer switch decline. Model version: gemini-1.5-pro-fintech-v3.'
  },
  {
    id: 'aud_005',
    timestamp: '2026-09-04T09:21:48Z',
    actor: 'System',
    entity: 'Payment',
    entity_id: 'pay_Hdfc8914A',
    payment_id: 'pay_Hdfc8914A',
    event_type: 'PAYMENT_FAILED_INGESTED',
    details: 'Webhook payment.failed received for ₹8,499.00. FailureCode=BANK_TEMP_DECLINE. ExternalEventId=evt_hdfc_8914_01.'
  },
  {
    id: 'aud_006',
    timestamp: '2026-09-04T08:45:12Z',
    actor: 'Policy Engine',
    entity: 'Decision',
    entity_id: 'DEC-9B42E1',
    payment_id: 'pay_Corp_145000',
    event_type: 'POLICY_FLAGGED_HUMAN_REVIEW',
    details: 'Safety constraint triggered: payment amount ₹1,45,000.00 exceeds automated ceiling ₹50,000.00. Status set to HUMAN_REVIEW.'
  },
  {
    id: 'aud_007',
    timestamp: '2026-09-04T07:12:05Z',
    actor: 'Policy Engine',
    entity: 'Decision',
    entity_id: 'DEC-3C18F0',
    payment_id: 'pay_Card_3200_max',
    event_type: 'RECOVERY_STOPPED',
    details: 'Policy check failed: Retry Limit Ceiling (3/3 used). Deterministic policy blocked further actions. Recovery terminated.'
  },
  {
    id: 'aud_008',
    timestamp: '2026-09-04T06:30:05Z',
    actor: 'System',
    entity: 'Decision',
    entity_id: 'DEC-7E29C3',
    payment_id: 'pay_Upi_6800_degraded',
    event_type: 'AI_FALLBACK_ENGAGED',
    details: 'AI diagnosis timeout circuit-breaker tripped. Pipeline smoothly engaged Rule-based Fallback Heuristic RB-04.'
  },
  {
    id: 'aud_009',
    timestamp: '2026-09-02T14:30:00Z',
    actor: 'Operator (Admin)',
    entity: 'Policy',
    entity_id: 'merch_acme_01',
    event_type: 'POLICY_CONFIG_UPDATED',
    details: 'Operator operator_priya@acme.com updated policy config: max_retries=3, cooldown_minutes=15, min_erv_threshold=₹50.00.'
  }
];
