#!/usr/bin/env bash
# chaos_demo.sh — Phase 11 scripted resilience/safety scenarios (PLAN.md §12).
#
# Demonstrates the deterministic safety layer and graceful degradation live:
#   1. fraud hard-stop        → decision = HUMAN_REVIEW, chosen = escalate
#   2. kill-switch instant halt→ every intervention blocked → no_action
#   3. AI-service-down fallback→ diagnosis degrades to the rule table (pipeline keeps working)
#   4. Redis-down degradation → cooldown/rate checks fall back to Postgres (pipeline keeps working)
#
# Usage (from repo root, stack up):
#   ADMIN_API_KEY=... ./scripts/chaos_demo.sh
# Env: BASE_URL (default http://localhost:8080), ADMIN_API_KEY (for the kill-switch scenario).
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
ADMIN_API_KEY="${ADMIN_API_KEY:-}"
M="merch_aggressive"
hdr_admin=(-H "X-API-Key: ${ADMIN_API_KEY}")
jqf() { command -v jq >/dev/null && jq "$@" || cat; }

post_event() {
  curl -sS -X POST "$BASE_URL/v1/merchants/$M/events/payment-failed" \
    -H 'Content-Type: application/json' \
    -d "{\"schema_version\":\"0.1.0\",\"external_event_id\":\"$2\",\"merchant_id\":\"$M\",\"payment_id\":\"$1\",\"customer_id\":\"chaos_cust\",\"event_type\":\"payment.failed\",\"amount\":500000,\"currency\":\"INR\",\"method\":\"card\",\"failure_reason\":\"$3\",\"prior_attempts\":0,\"occurred_at\":\"2026-09-05T10:00:00Z\"}" >/dev/null
}
show_last_decision() {
  curl -sS "$BASE_URL/v1/merchants/$M/payments/$1/decisions" | jqf '.decisions[0] | {chosen_action, policy_check_result, recovery_state}'
}

echo "== Scenario 1: fraud hard-stop =="
post_event chaos_fraud "chaos_fraud_$(date +%s)" "transaction flagged as suspected fraud"
show_last_decision chaos_fraud
echo "   expect: chosen_action=escalate, policy_check_result=HUMAN_REVIEW, recovery_state=STOPPED"
echo

echo "== Scenario 2: kill-switch instant halt =="
if [ -z "$ADMIN_API_KEY" ]; then echo "   (set ADMIN_API_KEY to run; skipping)"; else
  curl -sS -X POST "$BASE_URL/v1/merchants/$M/policy/kill-switch" "${hdr_admin[@]}" \
    -H 'Content-Type: application/json' -d '{"scope":"merchant","enabled":true}' >/dev/null
  post_event chaos_kill "chaos_kill_$(date +%s)" "Issuer declined, please try again"
  show_last_decision chaos_kill
  echo "   expect: chosen_action=no_action, recovery_state=STOPPED"
  curl -sS -X POST "$BASE_URL/v1/merchants/$M/policy/kill-switch" "${hdr_admin[@]}" \
    -H 'Content-Type: application/json' -d '{"scope":"merchant","enabled":false}' >/dev/null
  echo "   (kill switch reset to false)"
fi
echo

echo "== Scenario 3: AI-service-down fallback =="
echo "   docker compose stop diagnosis-service"
echo "   then post an event — diagnosis degrades to the rule table; pipeline still decides."
echo "   verify: metrics show decision_engine_diagnoses_total{source=\"rule_based_fallback\"} rising:"
echo "     curl -s $BASE_URL/metrics | grep diagnoses_total"
echo

echo "== Scenario 4: Redis-down graceful degradation =="
echo "   docker compose stop redis"
echo "   post events — cooldown/daily-cap checks fall back to Postgres-derived facts; decisions"
echo "   remain correct. Health shows redis=down but service stays up/ready:"
echo "     curl -s $BASE_URL/health | jqf ; curl -s $BASE_URL/ready"
