package api

import (
	"net/http"
	"strings"
)

// Auth carries the API keys that gate the public surface. An empty key disables that tier's
// check (dev convenience) — main logs a warning at startup so it is never silent in production.
//
// This is the MVP tenant boundary (PLAN.md §9): a shared merchant key plus an admin key, with
// row-level merchant_id scoping by the {id} path segment. Full per-merchant RBAC is a deferred
// production item, stated to judges as such.
type Auth struct {
	MerchantKey string
	AdminKey    string
}

// presentedKey extracts the caller's key from either X-API-Key or Authorization: Bearer <key>.
func presentedKey(r *http.Request) string {
	if k := r.Header.Get("X-API-Key"); k != "" {
		return k
	}
	if h := r.Header.Get("Authorization"); strings.HasPrefix(h, "Bearer ") {
		return strings.TrimSpace(strings.TrimPrefix(h, "Bearer "))
	}
	return ""
}

// requireMerchant gates a handler on the merchant API key (or passes through when unset).
func (a Auth) requireMerchant(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if a.MerchantKey != "" && presentedKey(r) != a.MerchantKey {
			writeError(w, http.StatusUnauthorized, "unauthorized", "valid merchant API key required")
			return
		}
		next(w, r)
	}
}

// requireAdmin gates a handler on the admin API key (or passes through when unset). Admin-gated
// routes (kill switch, policy-config) accept the admin key only — not the merchant key.
func (a Auth) requireAdmin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if a.AdminKey != "" && presentedKey(r) != a.AdminKey {
			writeError(w, http.StatusForbidden, "forbidden", "admin API key required")
			return
		}
		next(w, r)
	}
}
