package ingest

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"strings"
)

// SignatureHeader is the HTTP header carrying the webhook HMAC signature.
const SignatureHeader = "X-Webhook-Signature"

// ComputeSignature returns the hex-encoded HMAC-SHA256 of body under secret. Exposed so
// tests and demo/curl scripts can produce a valid signature for a given body.
func ComputeSignature(body []byte, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}

// VerifySignature reports whether sigHeader is a valid HMAC-SHA256 of body under secret.
// It accepts an optional "sha256=" prefix (GitHub-style) on the header value. The compare
// is constant-time to avoid leaking the expected digest via timing.
//
// This implements PLAN.md Phase 1's "webhook signature verification". It is intentionally
// minimal — a shared-secret HMAC over the raw body, the same scheme Razorpay uses for its
// webhook signatures — not a general auth/authz framework.
func VerifySignature(body []byte, sigHeader, secret string) bool {
	if secret == "" || sigHeader == "" {
		return false
	}
	provided := strings.TrimSpace(sigHeader)
	provided = strings.TrimPrefix(provided, "sha256=")

	providedBytes, err := hex.DecodeString(provided)
	if err != nil {
		return false
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	expected := mac.Sum(nil)

	// hmac.Equal is itself constant-time; subtle.ConstantTimeEq guards the length branch.
	if subtle.ConstantTimeEq(int32(len(providedBytes)), int32(len(expected))) != 1 {
		return false
	}
	return hmac.Equal(providedBytes, expected)
}
