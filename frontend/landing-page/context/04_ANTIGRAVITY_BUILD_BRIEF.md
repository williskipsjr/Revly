# Revly Landing Page --- Antigravity Build Brief

## Mission

Build **only the Revly marketing/storytelling landing page**.

Do not build the recovery backend, authentication, billing, payment
processing, merchant dashboard, or unrelated application screens in this
task.

The page should sell the Razorpay AI Buildathon Track 03 problem and
Revly's solution.

## Context Files

Read these before implementation:

1.  `01_SENTINELX_DESIGN_REFERENCE.md`
2.  `02_REVLY_PRODUCT_STORY.md`
3.  `03_REVLY_PAGE_STRUCTURE.md`
4.  Existing `PROBLEM_STATEMENT.md`
5.  Existing `PLAN.md`

Preserve existing project terminology and architecture. Do not invent
conflicting product behavior.

## Design Reference

Reference site:

https://sentinelx-neon.vercel.app/

Reproduce the **design language**:

-   cinematic dark technical atmosphere
-   editorial typography
-   generous whitespace
-   thin borders
-   blue/violet lighting
-   progressive scroll storytelling
-   technical system diagrams
-   live-state visualizations
-   restrained UI
-   evidence-driven sections

Do not copy SentinelX's wording, cybersecurity content, logo, assets, or
exact content.

## Brand

Product: `REVLY`

Descriptor: `Revenue Recovery Intelligence`

Established colors:

``` text
#0B1020  Deep navy / black
#2563FF  Electric blue
#7C3AED  Violet
#E9EAFE  Pale lavender
```

Use the existing Revly logo. Do not redesign it.

## Typography

Use Inter or Geist.

-   huge compact headlines
-   strong weight contrast
-   small uppercase tracked labels
-   muted secondary copy
-   monospace for system traces only

## Stack

Use the existing frontend stack.

Prefer the project's current:

-   Next.js
-   React
-   TypeScript
-   Tailwind or existing styling system
-   Motion/Framer Motion if already installed

Do not add unnecessary dependencies.

## Component Direction

Create reusable components for:

-   Hero
-   ProblemSection
-   RecoveryQuestion
-   RecoveryPipeline
-   DiagnosisCard
-   ActionScoreCard
-   ERVSection
-   ArchitectureBoundary
-   ExecutionState
-   StopRule
-   ImpactMetrics
-   AuditTimeline
-   FinalCTA

## Motion

Motion should communicate system state.

Use:

-   scroll reveals
-   number counters
-   line/path drawing
-   pipeline activation
-   state transitions
-   subtle parallax
-   atmospheric glow
-   sticky visual panels

Support `prefers-reduced-motion`.

Do not animate everything.

## Product Truth

The page must respect:

> **LLM proposes → ML scores → ERV ranks → deterministic Policy/Safety
> approves → Go executor acts → PostgreSQL records.**

The LLM must never be portrayed as directly moving money.

The product is bounded autonomy, not unrestricted autonomy.

## Content Rules

Never fabricate:

-   customer logos
-   testimonials
-   production performance
-   recovery percentages
-   merchant counts
-   transaction volumes
-   accuracy claims
-   revenue claims

Example values are allowed only when clearly presented as `EXAMPLE` or
`SIMULATED`.

## Story

The visitor should understand:

> Revly detects revenue at risk, understands why it happened, estimates
> what might work, chooses the economically sensible intervention,
> applies deterministic safety constraints, executes it safely, observes
> the result, and stops when further intervention is not worthwhile.

## Quality Bar

Before finishing, verify:

### Visual

-   premium
-   serious fintech/AI
-   consistent navy/blue/violet identity
-   logo feels native
-   strong typography
-   responsive

### Story

-   problem is immediately obvious
-   tension builds
-   recovery loop is understandable
-   Revly is clearly more than a retry engine
-   AI boundary is clear
-   measurable impact is introduced

### Technical

-   responsive
-   accessible
-   smooth
-   no console errors
-   no broken links
-   no fabricated claims
-   lightweight
-   reduced-motion support

## North Star

> **Make Revly feel like a financial intelligence system the user is
> watching operate --- not a website explaining a SaaS product.**
