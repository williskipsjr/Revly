# Backend Contracts — API

The **actual** HTTP surface implemented by the Go `decision-engine` (as of Phase 7). All money is
integer **paise**. All bodies are JSON. Base URL default: `http://localhost:8080`.

## Auth model
- **Merchant-gated** routes require the merchant API key. **Admin-gated** routes (kill switch,
  policy-config edit) require the admin API key.
- Present the key as either `X-API-Key: <key>` **or** `Authorization: Bearer <key>`.
- Keys come from env: `API_KEY` (merchant), `ADMIN_API_KEY` (admin). **If a key is empty, that
  tier's check is disabled** (dev convenience; logged at startup). In production set both.
- Tenant boundary is row-level `merchant_id` from the `{id}` path segment (MVP; no per-merchant
  RBAC yet — PLAN.md §9).

## Error format
All errors: `{"error":"<code>"}`, some add `"detail"`. Common: `400 invalid_json`,
`400 validation_failed`, `401 unauthorized`, `403 forbidden`, `404 not_found`,
`500 internal_error`.

---

## Ingestion

### POST `/v1/merchants/{id}/events/payment-failed`
- **Purpose:** ingest a failed-payment webhook; runs the full recovery pipeline synchronously.
- **Auth:** none by default; HMAC signature when `WEBHOOK_SECRET` is set (`X-Signature` header).
- **Idempotency:** durable on `external_event_id` (unique). Duplicate → `200 {"duplicate":true}`, no reprocessing.
- **Request body** (frozen `PaymentEvent`, `schema_version` `0.1.0`):
```json
{"schema_version":"0.1.0","external_event_id":"evt_1","merchant_id":"merch_aggressive",
 "payment_id":"pay_1","customer_id":"cust_1","event_type":"payment.failed","amount":250000,
 "currency":"INR","method":"card","failure_reason":"Issuer declined","prior_attempts":0,
 "occurred_at":"2026-09-05T10:00:00Z"}
```
- **Response:** `201` (new) / `200` (duplicate)
```json
{"status":"ingested","duplicate":false,"payment_event_id":"<uuid>","external_event_id":"evt_1"}
```
- **Status:** `201`, `200`, `400`, `401`, `413`, `500`.
- **Frontend use:** not called by the dashboard; the demo seed/webhook source calls it.

---

## Decisions (merchant-gated)

### GET `/v1/merchants/{id}/decisions?limit=N`
- **Purpose:** recent decision feed (default 50, max 200). **Frontend:** live decision feed.
- **Response:** `{"merchant_id":"...","decisions":[DecisionSummary,...]}`
- `DecisionSummary`: `{decision_id, payment_event_id, payment_id, chosen_action, erv_at_decision, policy_check_result, policy_version, recovery_state, decided_at}`
- **Status:** `200`, `401`.

### GET `/v1/merchants/{id}/payments/{payment_id}/decisions`
- **Purpose:** all decisions for one payment. **Frontend:** payment drill-down.
- **Response:** `{"merchant_id","payment_id","decisions":[DecisionSummary,...]}` — `200`, `401`.

### GET `/v1/merchants/{id}/decisions/{decision_id}`
- **Purpose:** full explainability trace (diagnosis + per-candidate ERV breakdown + policy checks).
- **Frontend:** per-decision drill-down / ERV bar chart / policy pass-fail view.
- **Response** (`DecisionDetail`):
```json
{"decision_id":"...","payment_event_id":"...","payment_id":"pay_1","chosen_action":"delayed_retry",
 "erv_at_decision":112340.0,"policy_check_result":"ALLOW","policy_version":"policy-v2",
 "recovery_state":"DONE","decided_at":"2026-09-05T10:00:01Z","merchant_id":"merch_aggressive",
 "root_cause":"temporary_bank_decline","confidence":0.6,"rationale":"...",
 "diagnosis_model_version":"rules-v1","success_model_version":"heuristic-v1",
 "candidates":[{"action":"delayed_retry","p_success":0.55,"recoverable_amount":250000,"cost":200,"friction_penalty":180,"erv":137320}],
 "policy_checks":{"policy_version":"policy-v2","chosen_action":"delayed_retry","chosen_result":"ALLOW","chosen_checks":[...],"candidates":[...]}}
```
- **Status:** `200`, `401`, `404`.

### POST `/v1/merchants/{id}/decisions/{decision_id}/override`
- **Purpose:** operator manual override — **audited**, `reason` mandatory. Recorded to `audit_log`;
  the immutable decision is **not** mutated (PLAN.md §11).
- **Request:** `{"action":"escalate","reason":"VIP customer, handle manually"}`
- **Response:** `200 {"status":"override_recorded","decision_id":"...","action":"escalate","reason":"..."}`
- **Errors:** `400 reason_required`, `400 invalid_action`, `404 not_found`.
- **Frontend:** override button (mandatory reason field).

---

## Metrics & audit (merchant-gated)

### GET `/v1/merchants/{id}/metrics/recovery-summary`
- **Purpose:** aggregate recovery KPIs. **Frontend:** aggregate metrics panel.
- **Response** (`RecoverySummary`):
```json
{"merchant_id":"merch_aggressive","total_decisions":42,"total_actions":31,"recovered_count":18,
 "recovered_amount":4200000,"intervention_cost":6200.0,"net_recovered":4193800.0,
 "recovery_rate":0.4286,"human_review_count":2,"no_action_count":11}
```
- **Status:** `200`, `401`.

### GET `/v1/merchants/{id}/audit/{payment_id}`
- **Purpose:** full causal audit chain for a payment (decisions + actions). **Frontend:** "why did
  you do this?" audit view.
- **Response:** `{"merchant_id","payment_id","audit":[{id, entity_type, entity_id, actor, details, at},...]}` — `200`, `401`.

---

## Policy config & kill switch

### GET `/v1/merchants/{id}/policy-config` (merchant-gated)
- **Purpose:** read a merchant's raw policy config. **Frontend:** policy-config screen (load).
- **Response** (`MerchantPolicyConfig`): `{max_retries, cooldown_minutes, min_erv_threshold, daily_action_cap, amount_ceiling, confidence_floor_override?, kill_switch}` — `200`, `401`, `404`.

### PUT `/v1/merchants/{id}/policy-config` (**admin-gated**)
- **Purpose:** edit policy config, **validated against platform ceilings** (PLAN.md §6). Audited.
- **Request:** a full `MerchantPolicyConfig` (without `kill_switch`; use the kill-switch route).
- **Response:** `200 {"status":"policy_config_updated","merchant_id":"..."}`
- **Errors:** `400 policy_bounds_violation` (with detail, e.g. "max_retries 99 exceeds platform ceiling 5"),
  `400 invalid_value`, `403 forbidden`, `404 not_found`.
- **Frontend:** policy-config screen (save) — bounds errors surfaced inline.

### POST `/v1/merchants/{id}/policy/kill-switch` (**admin-gated**)
- **Purpose:** halt autonomous recovery (merchant or global scope). Audited.
- **Request:** `{"scope":"merchant","enabled":true}` (`scope`: `"merchant"` default | `"global"`).
- **Response:** `200 {"status":"kill_switch_updated","scope":"merchant","enabled":true}`
- **Errors:** `400 invalid_scope`, `403 forbidden`, `404 not_found` (merchant scope).
- **Frontend:** kill-switch toggle (admin-gated).

---

## Internal endpoints (service-to-service, never public)

### POST `/internal/success-model/score`
- **Purpose:** P(success) per action for a context. **Request:** `{method, prior_attempts, amount, actions?}`.
- **Response:** `{model_version, scores:[{action, p_success}]}` — `200`, `400`.

### POST `/internal/erv/compute`
- **Purpose:** per-term ERV breakdown for a merchant + context.
- **Request:** `{merchant_id, method, prior_attempts, amount, actions?}`.
- **Response:** `{merchant_id, model_version, candidates:[{action,p_success,recoverable_amount,cost,friction_penalty,erv}]}` — `200`, `400`, `404`, `503` (no DB).

### POST `/internal/execute-action`
- **Purpose:** idempotently dispatch one policy-authorized action (Phase 6).
- **Request:** `{decision_id, payment_id, merchant_id, action, amount}`.
- **Idempotency:** key = `hash(payment_id, decision_id, action)`; a duplicate → `created:false`, no duplicate financial action.
- **Response:** `{action_status, created, recovered, recovery_state, idempotency_key}` — `200`, `400`, `502`.

### POST `/internal/reconcile-pending-actions`
- **Purpose:** settle `pending_confirmation` actions (ambiguous outcomes) — never blind-retries.
- **Request (optional):** `{"limit":100}`.
- **Response** (`Report`): `{scanned, settled, recovered, failed, still_pending}` — `200`, `500`, `503`.

> Note: a PSP outcome webhook is covered by this reconcile path + the `pending_confirmation`
> state; a dedicated inbound webhook route is a deferred production add (see hardening notes).

---

## Operational

| Method | Path | Purpose | Auth | Codes |
|---|---|---|---|---|
| GET | `/health` | liveness + `{db, redis}` status | none | `200` |
| GET | `/ready` | readiness (200 only if DB reachable; Redis optional) | none | `200`/`503` |
| GET | `/version` | service/version | none | `200` |
| GET | `/metrics` | Prometheus text exposition (Phase 10) | none | `200` |
