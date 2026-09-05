// Package cache is the Phase 6 ephemeral coordination layer: Redis-backed cooldown TTL keys,
// atomic per-customer rate-limit counters, and a lightweight job queue (PLAN.md §6/§13).
//
// Redis is NEVER authoritative (PLAN.md §13): everything it holds is reconstructible from
// Postgres. Every method degrades gracefully — when REDIS_URL is unset or Redis is unreachable,
// the constructor returns a no-op Cache whose reads report "unknown/absent", so callers fall
// back to the Postgres-derived checks that the pipeline already computes. Correctness therefore
// never depends on Redis being up; Redis is only an accelerator.
//
// To keep the decision engine dependency-free and buildable offline, this uses a tiny stdlib
// RESP client (net only) rather than a third-party Redis library — the command surface we need
// (PING/SET EX/GET/INCR/EXPIRE/LPUSH/RPOP) is small and stable.
package cache

import (
	"context"
	"time"
)

// Cache is the ephemeral coordination surface. All methods are best-effort: on any error the
// caller should fall back to the Postgres-derived truth rather than fail the request.
type Cache interface {
	// Available reports whether a live Redis connection is configured and last known healthy.
	Available() bool
	// Ping checks connectivity (used by health/readiness).
	Ping(ctx context.Context) error

	// SetCooldown marks a cooldown window on key for ttl (accelerator for the retry cooldown).
	SetCooldown(ctx context.Context, key string, ttl time.Duration) error
	// CooldownActive reports whether a cooldown key is still live.
	CooldownActive(ctx context.Context, key string) (bool, error)

	// IncrCounter atomically increments key and (on first creation) sets its ttl, returning the
	// new value — the per-customer daily action counter accelerator.
	IncrCounter(ctx context.Context, key string, ttl time.Duration) (int64, error)
	// GetCounter returns key's current value (0 when absent).
	GetCounter(ctx context.Context, key string) (int64, error)

	// Enqueue pushes payload onto a Redis list (LPUSH) — the async dispatch job queue.
	Enqueue(ctx context.Context, queue, payload string) error
	// Dequeue pops the oldest queued payload (RPOP); ok=false when the queue is empty.
	Dequeue(ctx context.Context, queue string) (payload string, ok bool, err error)

	Close() error
}

// New returns a Cache for redisURL. An empty URL (or an initial connection failure) yields a
// no-op Cache so the engine runs without Redis. err is non-nil only for a malformed URL — a
// connection failure is swallowed into the no-op fallback (Redis is optional by design).
func New(redisURL string) (Cache, error) {
	if redisURL == "" {
		return Noop{}, nil
	}
	c, err := dial(redisURL)
	if err != nil {
		// Malformed URL is a config error worth surfacing; a live-connection failure is not.
		if _, ok := err.(*urlError); ok {
			return Noop{}, err
		}
		return Noop{}, nil
	}
	return c, nil
}

// Noop is the graceful fallback Cache used when Redis is unconfigured or down. Reads report
// "absent/unknown" so callers use the Postgres-derived truth; writes are silently dropped.
type Noop struct{}

func (Noop) Available() bool                                          { return false }
func (Noop) Ping(context.Context) error                               { return nil }
func (Noop) SetCooldown(context.Context, string, time.Duration) error { return nil }
func (Noop) CooldownActive(context.Context, string) (bool, error)     { return false, nil }
func (Noop) IncrCounter(context.Context, string, time.Duration) (int64, error) {
	return 0, nil
}
func (Noop) GetCounter(context.Context, string) (int64, error) { return 0, nil }
func (Noop) Enqueue(context.Context, string, string) error     { return nil }
func (Noop) Dequeue(context.Context, string) (string, bool, error) {
	return "", false, nil
}
func (Noop) Close() error { return nil }
