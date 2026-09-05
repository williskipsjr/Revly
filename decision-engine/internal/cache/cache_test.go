package cache

import (
	"context"
	"testing"
	"time"
)

// TestNew_EmptyURLIsNoop: with no REDIS_URL the engine gets a no-op cache that reports "absent"
// so callers fall back to Postgres-derived facts (Redis is never authoritative).
func TestNew_EmptyURLIsNoop(t *testing.T) {
	c, err := New("")
	if err != nil {
		t.Fatalf("New(\"\") error: %v", err)
	}
	if _, ok := c.(Noop); !ok {
		t.Fatalf("New(\"\") = %T, want Noop", c)
	}
}

// TestNew_MalformedURLIsConfigError: a bad scheme is surfaced as a config error (still a usable
// no-op cache), unlike a mere connection failure which is swallowed.
func TestNew_MalformedURLIsConfigError(t *testing.T) {
	c, err := New("http://not-redis:6379")
	if err == nil {
		t.Fatal("expected a config error for a non-redis scheme")
	}
	if _, ok := c.(Noop); !ok {
		t.Fatalf("fallback = %T, want Noop", c)
	}
}

// TestNoop_ReadsReportAbsent: every no-op read is benign so a caller always safely falls back.
func TestNoop_ReadsReportAbsent(t *testing.T) {
	ctx := context.Background()
	n := Noop{}
	if n.Available() {
		t.Error("Noop.Available() = true, want false")
	}
	if active, _ := n.CooldownActive(ctx, "k"); active {
		t.Error("Noop cooldown should be inactive")
	}
	if v, _ := n.IncrCounter(ctx, "k", time.Minute); v != 0 {
		t.Errorf("Noop counter = %d, want 0", v)
	}
	if _, ok, _ := n.Dequeue(ctx, "q"); ok {
		t.Error("Noop dequeue should be empty")
	}
	if err := n.SetCooldown(ctx, "k", time.Minute); err != nil {
		t.Errorf("Noop SetCooldown error: %v", err)
	}
}
