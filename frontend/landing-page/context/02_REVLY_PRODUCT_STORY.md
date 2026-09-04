# Revly --- Product Story

## Product Identity

**REVLY**

**Revenue Recovery Intelligence**

Core promise:

> Turn revenue at risk into intelligent recovery.

Supporting idea:

> Revly finds the right intervention, at the right time, for the right
> reason --- and knows when to stop.

## The Problem

Revenue does not disappear in one clean event.

A payment fails. A checkout is abandoned. A subscription payment fails
again. An invoice becomes overdue. A mandate does not go through.

Each creates revenue at risk, but the correct response is different.

Blindly retrying everything creates unnecessary customer friction and
wasted intervention cost.

Doing nothing leaves recoverable revenue behind.

The real question is:

> **What should happen next?**

## The Solution

Revly is an AI-assisted, bounded revenue recovery decision platform.

It determines:

1.  what revenue is at risk
2.  why it is at risk
3.  whether recovery is likely
4.  which intervention is most likely to work
5.  whether that intervention is economically worthwhile
6.  whether policy allows it
7.  what happens if it fails
8.  when to stop
9.  how much revenue was actually recovered

## Core Loop

``` text
REVENUE AT RISK
      ↓
DETECT
      ↓
DIAGNOSE
      ↓
ESTIMATE RECOVERABILITY
      ↓
RANK INTERVENTIONS
      ↓
POLICY / SAFETY
      ↓
EXECUTE
      ↓
OBSERVE OUTCOME
      ↓
RECOVER / RE-EVALUATE / STOP
```

## Intelligence Boundary

The product is intentionally not an unrestricted autonomous agent.

The governing invariant is:

> **LLM proposes → ML scores → ERV ranks → deterministic Policy/Safety
> approves → Go executor acts → PostgreSQL records.**

### LLM

Contextual diagnosis and reasoning.

### ML

Estimates `P(success | context, action)`.

### ERV

Ranks actions economically:

`ERV = P(success | context, action) × recoverable_amount − action_cost − friction_cost`

### Policy/Safety

Constrains what can happen:

-   ALLOW
-   BLOCK
-   HUMAN_REVIEW

### Executor

Performs the bounded action.

### PostgreSQL

Authoritative financial decision and audit state.

## Product Personality

Revly should feel:

-   intelligent
-   precise
-   calm
-   financially serious
-   technical
-   trustworthy
-   operational

It should not feel like:

-   a chatbot
-   an AI gimmick
-   a generic analytics dashboard
-   an aggressive collections system
-   an unrestricted autonomous agent

## Emotional Arc

1.  **Recognition:** revenue leakage is more complicated than failed
    payments.
2.  **Tension:** blanket retries waste money and customer goodwill.
3.  **Curiosity:** what decides the right intervention?
4.  **Understanding:** Revly combines diagnosis, probability, economics,
    and policy.
5.  **Trust:** AI does not directly control money.
6.  **Proof:** decisions, outcomes, and recovery can be measured.
7.  **Desire:** this is how revenue recovery should work.

## Strong Conceptual Line

> **The goal isn't to intervene more. It's to recover smarter.**

## Claims Discipline

Do not present future capabilities as already production-real.

Current implementation includes the Phase 2 vertical slice:

-   deterministic/rule-based diagnosis
-   bounded candidate actions
-   P(success) heuristic
-   ERV v1
-   deterministic policy/safety evaluation
-   idempotent mocked execution
-   outcome capture
-   persisted decision state

Later capabilities include statistical P(success), merchant-aware
economics, LLM diagnosis, Redis coordination, broader
evaluation/simulation, and observability hardening.

Any demo/synthetic metric must be clearly labelled as simulated or
evaluation data.
