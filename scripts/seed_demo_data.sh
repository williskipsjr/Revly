#!/usr/bin/env bash
# seed_demo_data.sh — Phase 11 one-command demo seed.
#
# Applies migrations + dev seed (two contrasting merchants + platform policy), then POSTs a
# spread of demo failed-payment events through the real ingestion + recovery pipeline so the
# dashboard has a live decision feed across scenarios and both merchant configs.
#
# Usage (from repo root, with the stack up — `docker compose up -d`):
#   ./scripts/seed_demo_data.sh
# Env overrides: BASE_URL (default http://localhost:8080), PSQL_URL, WEBHOOK_SECRET (if set,
# signature verification is on and this script cannot sign — leave it unset for the demo).
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
PSQL_URL="${PSQL_URL:-postgres://revrec:revrec_dev_pw@localhost:5432/revrecovery?sslmode=disable}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Applying migrations + seed to $PSQL_URL"
for f in 001_init 002_phase2_kill_switch 003_phase5_policy 004_phase6_execution; do
  psql "$PSQL_URL" -v ON_ERROR_STOP=1 -f "$ROOT/migrations/$f.sql"
done
psql "$PSQL_URL" -v ON_ERROR_STOP=1 -f "$ROOT/scripts/seed_dev.sql"

post_event() {
  local merchant="$1" pid="$2" ext="$3" method="$4" amount="$5" reason="$6" etype="${7:-payment.failed}" cust="${8:-cust_demo}"
  curl -sS -o /dev/null -w "  %{http_code} $merchant $pid ($reason)\n" \
    -X POST "$BASE_URL/v1/merchants/$merchant/events/payment-failed" \
    -H 'Content-Type: application/json' \
    -d "{\"schema_version\":\"0.1.0\",\"external_event_id\":\"$ext\",\"merchant_id\":\"$merchant\",\"payment_id\":\"$pid\",\"customer_id\":\"$cust\",\"event_type\":\"$etype\",\"amount\":$amount,\"currency\":\"INR\",\"method\":\"$method\",\"failure_reason\":\"$reason\",\"prior_attempts\":0,\"occurred_at\":\"2026-09-05T10:00:00Z\"}"
}

echo "==> Posting demo events to $BASE_URL"
# Aggressive merchant: recovers a range of causes.
post_event merch_aggressive   pay_demo_a1 evt_demo_a1 card 250000 "Issuer declined, please try again"
post_event merch_aggressive   pay_demo_a2 evt_demo_a2 card 300000 "Card expired"
post_event merch_aggressive   pay_demo_a3 evt_demo_a3 upi  150000 "Insufficient funds"
post_event merch_aggressive   pay_demo_a4 evt_demo_a4 card 900000 "transaction flagged as suspected fraud"
post_event merch_aggressive   pay_demo_a5 evt_demo_a5 card 120000 "customer left before paying" checkout.abandoned
# Conservative merchant: stricter policy (higher confidence floor, lower caps) → different outcomes.
post_event merch_conservative pay_demo_c1 evt_demo_c1 card 250000 "Issuer declined, please try again"
post_event merch_conservative pay_demo_c2 evt_demo_c2 card 6000000 "Card expired"   # over ₹50k ceiling
post_event merch_conservative pay_demo_c3 evt_demo_c3 card 400000 "transaction flagged as suspected fraud"

echo "==> Done. Open the dashboard, or:"
echo "    curl -s $BASE_URL/v1/merchants/merch_aggressive/metrics/recovery-summary | jq"
