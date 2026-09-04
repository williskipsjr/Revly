// Package recovery implements the recovery state machine (PLAN.md §6a) as ordinary,
// validated state transitions — not a new service or store. The current state lives on the
// decisions.recovery_state column; this package only defines the legal transition graph and
// a small in-memory Machine the pipeline drives, recording the visited path so the full
// sequence of transitions is auditable (PLAN.md §11).
//
// Graph (PLAN.md §6a):
//
//	FAILED ──▶ DIAGNOSED ──▶ RECOVERY_ELIGIBLE ──▶ ACTION_SELECTED ──▶ ACTION_PENDING
//	                │                 │                    │                 ├─▶ RECOVERED ─▶ DONE
//	                ▼                 ▼                    ▼                 └─▶ FAILED ─▶ RE_EVALUATE ─▶ STOP/NEXT
//	             STOPPED           STOPPED              STOPPED/DONE
//
// Terminal states are STOPPED and DONE. FAILED has two out-edges: the initial FAILED→DIAGNOSED,
// and the post-execution FAILED→RE_EVALUATE when a dispatched action did not recover the payment.
package recovery

import (
	"fmt"

	"github.com/williskipsjr/razorpay-ai-buildathon/decision-engine/internal/domain"
)

// transitions is the legal transition graph. A state mapped to an empty set is terminal.
var transitions = map[domain.RecoveryState]map[domain.RecoveryState]bool{
	domain.StateFailed: {
		domain.StateDiagnosed:  true, // initial: diagnosis produced a root cause
		domain.StateReEvaluate: true, // post-execution: action did not recover the payment
	},
	domain.StateDiagnosed: {
		domain.StateRecoveryEligible: true, // policy confirms not hard-blocked
		domain.StateStopped:          true, // hard-blocked (kill switch / fraud stop)
	},
	domain.StateRecoveryEligible: {
		domain.StateActionSelected: true, // ERV ranking + policy ALLOW on a candidate
		domain.StateStopped:        true, // no eligible action survived
	},
	domain.StateActionSelected: {
		domain.StateActionPending: true, // executor dispatches the chosen action
		domain.StateStopped:       true, // chosen no_action / nothing dispatched
		domain.StateDone:          true, // selection alone completes the journey
	},
	domain.StateActionPending: {
		domain.StateRecovered: true, // outcome: payment recovered
		domain.StateFailed:    true, // outcome: still not recovered
	},
	domain.StateRecovered: {
		domain.StateDone: true,
	},
	domain.StateReEvaluate: {
		domain.StateActionSelected: true, // rank + policy-check a next candidate
		domain.StateStopped:        true, // stop (Phase 2: always stops — no auto next action)
	},
	// Terminal states.
	domain.StateStopped: {},
	domain.StateDone:    {},
}

// CanTransition reports whether from→to is a legal transition.
func CanTransition(from, to domain.RecoveryState) bool {
	return transitions[from][to]
}

// Terminal reports whether s is a terminal state (no outgoing transitions).
func Terminal(s domain.RecoveryState) bool {
	next, ok := transitions[s]
	return ok && len(next) == 0
}

// Machine tracks the current recovery state and the ordered path of states visited. It
// always starts at FAILED — the state of a freshly ingested failed payment.
type Machine struct {
	state   domain.RecoveryState
	history []domain.RecoveryState
}

// NewMachine returns a Machine positioned at the initial FAILED state.
func NewMachine() *Machine {
	return &Machine{state: domain.StateFailed, history: []domain.RecoveryState{domain.StateFailed}}
}

// State returns the current state.
func (m *Machine) State() domain.RecoveryState { return m.state }

// History returns the ordered path of states visited, starting with FAILED.
func (m *Machine) History() []domain.RecoveryState {
	out := make([]domain.RecoveryState, len(m.history))
	copy(out, m.history)
	return out
}

// To advances to next, returning an error (and leaving the state unchanged) if the
// transition is not legal. This makes an illegal pipeline transition a caught bug, never a
// silently corrupt recovery_state.
func (m *Machine) To(next domain.RecoveryState) error {
	if !CanTransition(m.state, next) {
		return fmt.Errorf("recovery: illegal transition %s -> %s", m.state, next)
	}
	m.state = next
	m.history = append(m.history, next)
	return nil
}

// MustTo advances to next and panics on an illegal transition. Intended only for pipeline
// code that constructs transitions from a fixed, tested set — an illegal one there is a
// programming error, not a runtime condition.
func (m *Machine) MustTo(next domain.RecoveryState) {
	if err := m.To(next); err != nil {
		panic(err)
	}
}
