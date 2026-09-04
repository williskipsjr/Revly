// Package executor is the Phase 2 execution plane: it derives the idempotency key that the
// database uniquely constrains, and dispatches the chosen action through a MOCK external
// integration (PLAN.md §15: external payment/action calls are mocked in Phase 2; the real
// Razorpay sandbox integration is Phase 6).
//
// The actual duplicate-prevention guarantee is NOT in this package — it is the UNIQUE
// constraint on actions.idempotency_key in Postgres (PLAN.md §8). This package only computes
// the key deterministically; the store's ON CONFLICT DO NOTHING insert enforces "no
// duplicate financial action" even under concurrent fire (proved by the store integration
// tests).
package executor

import (
	"crypto/sha256"
	"encoding/hex"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/domain"
)

// IdempotencyKey deterministically derives actions.idempotency_key = hash(payment_id,
// decision_id, action_type) (PLAN.md §8). The same (payment, decision, action) always maps
// to the same key, so a duplicate dispatch collides on the unique index; different actions
// or different decisions map to different keys. The separator ('|') is a byte that cannot
// appear in the hashed identifiers' semantics, so distinct field tuples cannot alias.
func IdempotencyKey(paymentID, decisionID string, action domain.Action) string {
	h := sha256.Sum256([]byte(paymentID + "|" + decisionID + "|" + string(action)))
	return hex.EncodeToString(h[:])
}
