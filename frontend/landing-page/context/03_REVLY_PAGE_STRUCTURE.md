# Revly Landing Page --- Storyboard

## Objective

Build a single-page, scroll-driven marketing experience that **sells the
problem and the solution through a story**.

Primary visual reference: https://sentinelx-neon.vercel.app/

------------------------------------------------------------------------

## 01 --- HERO

Purpose: establish Revly and create tension immediately.

Visual:

-   near-black navy background
-   Revly logo
-   `REVLY`
-   `Revenue Recovery Intelligence`
-   blue/violet atmospheric glow
-   minimal navigation

Suggested headline:

> **Revenue doesn't disappear. It slips through decisions.**

Supporting copy:

> Revly detects revenue at risk, determines the smartest recovery path,
> and executes bounded interventions without turning every failure into
> another retry.

CTA:

`Explore the recovery loop`

------------------------------------------------------------------------

## 02 --- THE LEAK

Show revenue degradation:

``` text
Payment
  ↓
Failure
  ↓
Retry
  ↓
Failure
  ↓
Customer friction
  ↓
Revenue lost
```

Then reveal that different failures need different responses.

Key statement:

> **A failed payment is an event. Revenue recovery is a decision.**

------------------------------------------------------------------------

## 03 --- THE QUESTION

Large statement:

> **So what should happen next?**

Show candidate actions:

`RETRY · REMIND · PAYMENT LINK · ESCALATE · WAIT · STOP`

Each action has probability, cost, friction, and policy constraints.

The visitor should realize that retrying everything is not intelligence.

------------------------------------------------------------------------

## 04 --- THE REVLY LOOP

This is the visual centerpiece.

Sticky/animated pipeline:

`01 DETECT → 02 DIAGNOSE → 03 SCORE → 04 RANK → 05 GATE → 06 EXECUTE → 07 OBSERVE → 08 RECOVER`

As the visitor scrolls:

-   stages activate
-   a glowing line travels through the system
-   one revenue event moves through the pipeline
-   explanation changes beside it

------------------------------------------------------------------------

## 05 --- DIAGNOSIS

Show one concrete example:

``` text
PAYMENT #RV-28491

₹8,499

STATUS
Failed

DIAGNOSIS
Temporary bank decline

SIGNALS
High historical success rate
No recent recovery attempts
Low customer friction
```

Message:

> Revly doesn't treat every failure the same.

------------------------------------------------------------------------

## 06 --- RECOVERABILITY

Show candidate actions:

``` text
RETRY
P(success) 89%

PAYMENT LINK
P(success) 74%

REMINDER
P(success) 61%
```

Label these as example/demo values unless they come from actual
evaluation.

Message:

> **The best action is the one most likely to recover value --- not the
> one that is easiest to automate.**

------------------------------------------------------------------------

## 07 --- ECONOMICS

Introduce ERV visually:

``` text
EXPECTED RECOVERY
        −
INTERVENTION COST
        −
CUSTOMER FRICTION
        =
EXPECTED RECOVERY VALUE
```

Case A:

``` text
High value
High recovery probability
Low cost
Low friction

→ ACT
```

Case B:

``` text
Low value
Low recovery probability
Repeated contact
High friction

→ STOP
```

Core message:

> **Recovery is an economic decision, not an automation contest.**

------------------------------------------------------------------------

## 08 --- AI BOUNDARY

Strong statement:

> **AI proposes. The system decides.**

Visual:

``` text
LLM
Diagnosis / proposal
       ↓
ML
P(success)
       ↓
ERV
Economic ranking
       ↓
POLICY
Safety boundary
       ↓
GO
Execution
       ↓
POSTGRES
Audit trail
```

This should be one of the main trust-building moments.

------------------------------------------------------------------------

## 09 --- BOUNDED EXECUTION

Show an approved action:

``` text
ACTION
Retry payment

POLICY
Retry allowed

ATTEMPTS
0 / 2

IDEMPOTENCY
Verified

DECISION
ALLOW
```

Optionally demonstrate a failure:

``` text
ACTION FAILED
       ↓
OUTCOME UNKNOWN
       ↓
PENDING CONFIRMATION
       ↓
RECONCILIATION
```

------------------------------------------------------------------------

## 10 --- KNOW WHEN TO STOP

Headline:

> **Recovery without restraint becomes friction.**

Show:

``` text
Attempt 1
   ↓
Failed
   ↓
Attempt 2
   ↓
Failed
   ↓
Policy / economics
   ↓
STOP
```

Message:

> Revly is designed to recover revenue without turning persistence into
> harassment.

------------------------------------------------------------------------

## 11 --- MEASURABLE IMPACT

Shift from an individual decision to batch economics.

Show:

``` text
REVENUE AT RISK
₹X

RECOVERED
₹Y

RECOVERY RATE
Z%

ACTIONS EXECUTED
N

ACTIONS AVOIDED
M
```

Only use real measured evaluation results.

For synthetic/demo data, explicitly show:

`SIMULATED EVALUATION`

Core statement:

> **The objective is not activity. The objective is recovered value.**

------------------------------------------------------------------------

## 12 --- AUDIT TRAIL

Show an event timeline:

``` text
09:41:02  PAYMENT_FAILED
09:41:03  DIAGNOSIS_CREATED
09:41:03  ACTIONS_SCORED
09:41:03  ERV_RANKED
09:41:03  POLICY_ALLOWED
09:41:04  ACTION_EXECUTED
09:41:31  OUTCOME_CONFIRMED
```

Make it feel like a real system event stream.

------------------------------------------------------------------------

## 13 --- FINAL STATEMENT

Minimal cinematic ending:

> **Turn revenue at risk into intelligent recovery.**

Supporting:

> Revly brings intelligence, economics, and safety into the recovery
> loop --- so merchants can recover more value without intervening
> blindly.

Footer:

`REVLY · REVENUE RECOVERY INTELLIGENCE`

## Navigation

Keep it minimal:

-   Revly
-   Problem
-   Recovery Loop
-   Architecture
-   Impact
-   CTA

## Interaction Principle

Every animation must answer a question:

-   What failed?
-   Why?
-   Is it recoverable?
-   What could we do?
-   Which action wins?
-   Why?
-   Is it allowed?
-   What happened?
-   Did we recover the money?
-   Should we stop?
