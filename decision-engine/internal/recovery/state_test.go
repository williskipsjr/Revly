package recovery

import (
	"testing"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/domain"
)

// TestHappyPath_RecoveredToDone walks the full success journey and asserts the recorded
// history matches §6a.
func TestHappyPath_RecoveredToDone(t *testing.T) {
	m := NewMachine()
	for _, s := range []domain.RecoveryState{
		domain.StateDiagnosed, domain.StateRecoveryEligible, domain.StateActionSelected,
		domain.StateActionPending, domain.StateRecovered, domain.StateDone,
	} {
		if err := m.To(s); err != nil {
			t.Fatalf("legal transition to %s failed: %v", s, err)
		}
	}
	if !Terminal(m.State()) {
		t.Fatalf("expected terminal state, got %s", m.State())
	}
	want := []domain.RecoveryState{
		domain.StateFailed, domain.StateDiagnosed, domain.StateRecoveryEligible,
		domain.StateActionSelected, domain.StateActionPending, domain.StateRecovered, domain.StateDone,
	}
	got := m.History()
	if len(got) != len(want) {
		t.Fatalf("history length = %d, want %d (%v)", len(got), len(want), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("history[%d] = %s, want %s", i, got[i], want[i])
		}
	}
}

// TestFailedActionPath: a dispatched action that does not recover walks
// ACTION_PENDING → FAILED → RE_EVALUATE → STOPPED.
func TestFailedActionPath(t *testing.T) {
	m := NewMachine()
	path := []domain.RecoveryState{
		domain.StateDiagnosed, domain.StateRecoveryEligible, domain.StateActionSelected,
		domain.StateActionPending, domain.StateFailed, domain.StateReEvaluate, domain.StateStopped,
	}
	for _, s := range path {
		if err := m.To(s); err != nil {
			t.Fatalf("legal transition to %s failed: %v", s, err)
		}
	}
	if m.State() != domain.StateStopped || !Terminal(m.State()) {
		t.Fatalf("expected terminal STOPPED, got %s", m.State())
	}
}

// TestKillSwitchPath: a hard block stops right after diagnosis (DIAGNOSED → STOPPED).
func TestKillSwitchPath(t *testing.T) {
	m := NewMachine()
	if err := m.To(domain.StateDiagnosed); err != nil {
		t.Fatal(err)
	}
	if err := m.To(domain.StateStopped); err != nil {
		t.Fatalf("DIAGNOSED->STOPPED should be legal: %v", err)
	}
	if !Terminal(m.State()) {
		t.Fatal("STOPPED must be terminal")
	}
}

// TestNoActionPath: choosing no_action stops from ACTION_SELECTED (ACTION_SELECTED → STOPPED).
func TestNoActionPath(t *testing.T) {
	m := NewMachine()
	for _, s := range []domain.RecoveryState{domain.StateDiagnosed, domain.StateRecoveryEligible, domain.StateActionSelected, domain.StateStopped} {
		if err := m.To(s); err != nil {
			t.Fatalf("transition to %s failed: %v", s, err)
		}
	}
	if m.State() != domain.StateStopped {
		t.Fatalf("expected STOPPED, got %s", m.State())
	}
}

// TestIllegalTransitions rejects transitions outside the graph and leaves state unchanged.
func TestIllegalTransitions(t *testing.T) {
	cases := []struct{ from, to domain.RecoveryState }{
		{domain.StateFailed, domain.StateActionPending}, // skips diagnosis
		{domain.StateDiagnosed, domain.StateRecovered},  // skips selection/dispatch
		{domain.StateDone, domain.StateFailed},          // terminal has no out-edge
		{domain.StateStopped, domain.StateDiagnosed},    // terminal has no out-edge
		{domain.StateRecovered, domain.StateStopped},    // RECOVERED only goes to DONE
	}
	for _, c := range cases {
		if CanTransition(c.from, c.to) {
			t.Errorf("CanTransition(%s,%s) = true, want false", c.from, c.to)
		}
	}

	m := NewMachine()
	if err := m.To(domain.StateActionPending); err == nil {
		t.Fatal("expected illegal FAILED->ACTION_PENDING to error")
	}
	if m.State() != domain.StateFailed {
		t.Fatalf("state changed after illegal transition: %s", m.State())
	}
	if len(m.History()) != 1 {
		t.Fatalf("history grew after illegal transition: %v", m.History())
	}
}

// TestTerminalStates: exactly STOPPED and DONE are terminal.
func TestTerminalStates(t *testing.T) {
	terminal := map[domain.RecoveryState]bool{domain.StateStopped: true, domain.StateDone: true}
	all := []domain.RecoveryState{
		domain.StateFailed, domain.StateDiagnosed, domain.StateRecoveryEligible, domain.StateActionSelected,
		domain.StateActionPending, domain.StateRecovered, domain.StateReEvaluate, domain.StateStopped, domain.StateDone,
	}
	for _, s := range all {
		if Terminal(s) != terminal[s] {
			t.Errorf("Terminal(%s) = %v, want %v", s, Terminal(s), terminal[s])
		}
	}
}
