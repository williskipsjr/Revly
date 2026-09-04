# AI Revenue Recovery Decision Platform — Architecture & Workflow Diagram

> **Final intended system** for Razorpay AI Buildathon Track 03.
> This diagram represents the complete platform as defined in
> [`../PS and Solution/PROBLEM_STATEMENT.md`](../PS%20and%20Solution/PROBLEM_STATEMENT.md) (WHAT/WHY)
> and [`../PS and Solution/PLAN.md`](../PS%20and%20Solution/PLAN.md) (HOW) — not merely the
> currently implemented Phase 1–3 state. Every element traces to those two documents
> (see [Provenance](#provenance)); nothing here is invented.

**The invariant that governs everything below:**

> **The LLM proposes. ML estimates P(success). ERV ranks. Policy constrains. Go executes. PostgreSQL records.**
> No layer skips the one after it. Economics ranks actions; safety constrains actions.

---

## 1. System Architecture (the three planes)

The platform owns the financial decision architecture; an AI-assisted, bounded recovery
agent runs *inside* it. Three cleanly separated planes, one durable source of truth,
one ephemeral coordinator.

```mermaid
flowchart TB
  classDef ext fill:#fdecec,stroke:#c0392b,color:#5b1a12;
  classDef intel fill:#e9f2fd,stroke:#2c6fbb,color:#0f2a44;
  classDef dec fill:#e7f6ec,stroke:#2e8b57,color:#123a24;
  classDef exec fill:#fff3df,stroke:#d68910,color:#5a3a09;
  classDef store fill:#efeafb,stroke:#6c3fb0,color:#2c1a4d;
  classDef prod fill:#f2f2f2,stroke:#555,color:#222;

  %% ---------- External / untrusted ----------
  subgraph EXT["External · third-party (untrusted)"]
    WH["Payment / webhook events<br/>payment.failed<br/><i>at-least-once delivery</i>"]
    RZP["Razorpay API — sandbox<br/><i>idempotency-key header</i>"]
    LLMP["LLM provider<br/>Anthropic / OpenAI<br/><i>JSON-schema-constrained</i>"]
  end

  %% ---------- Intelligence plane ----------
  subgraph INT["Intelligence plane · Python / FastAPI<br/>isolated · no payment credentials · writes only diagnoses"]
    DIAG["Diagnosis Service<br/>rule table → LLM classifier<br/><b>advisory only</b>: root cause +<br/>confidence + candidate actions"]
    SM["Statistical Success Model<br/>logistic regression<br/><b>P(success | context, action)</b>"]
  end

  %% ---------- Decision plane ----------
  subgraph DEC["Decision plane · Go — must never be bypassed"]
    ING["Event Ingestor<br/>normalize → PaymentEvent<br/><i>idempotent on external_event_id</i>"]
    CTX["Context Builder<br/>customer history · prior attempts ·<br/>method / amount tier · <b>merchant config</b>"]
    ERV["ERV Optimizer<br/>rank candidate actions, merchant-aware<br/>P(success)×amount − cost − friction"]
    POL["Policy / Safety Engine<br/>pure rules · <b>zero ML</b> · versioned<br/>ALLOW · BLOCK · HUMAN_REVIEW"]
  end

  %% ---------- Execution plane ----------
  subgraph EXEC["Execution plane · Go"]
    EXECU["Action Executor<br/>idempotent dispatch (unique key)<br/><i>at-least-once</i> · pending_confirmation"]
    REC["Outcome Listener + Reconciler<br/>resolves ambiguous outcomes<br/>against gateway status"]
  end

  %% ---------- Persistence ----------
  subgraph STORE["Persistence"]
    PG[("PostgreSQL — single source of truth<br/>payments · payment_events · diagnoses ·<br/>success_model_scores · erv_scores · decisions ·<br/>actions · outcomes · merchants · *_config · audit_log")]
    RD[("Redis — ephemeral only<br/>cooldown TTLs · rate-limit counters · job queue<br/><i>fully reconstructable from Postgres</i>")]
  end

  %% ---------- Product surface ----------
  subgraph PROD["Product surface"]
    DASH["Merchant / Operator Dashboard<br/>Next.js — <b>primary surface</b><br/>live feed · ERV breakdown · overrides · kill switch"]
    GRAF["Grafana<br/><i>engineering telemetry — secondary</i>"]
  end

  %% ---------- Primary flow ----------
  WH --> ING --> CTX
  CTX -->|"context (timeout-bounded)"| DIAG
  CTX --> ERV
  DIAG -->|"root cause + candidates + confidence"| ERV
  DIAG -->|"confidence gate"| POL
  DIAG <-->|"schema-validated JSON"| LLMP
  ERV <-->|"P(success | context, action)"| SM
  ERV -->|"ranked candidates"| POL
  POL -->|"ALLOW"| EXECU
  EXECU -->|"idempotency-key header"| RZP
  RZP -.->|"outcome webhook (async)"| REC

  %% ---------- Persistence access ----------
  ING --> PG
  DIAG --> PG
  SM --> PG
  ERV --> PG
  POL --> PG
  EXECU --> PG
  REC --> PG
  EXECU <-->|"cooldown / rate-limit / enqueue"| RD
  POL <-->|"cooldown / rate-limit"| RD

  %% ---------- Product reads ----------
  PG --> DASH
  PG -.->|"metrics"| GRAF
  RD -.-> GRAF

  class WH,RZP,LLMP ext;
  class DIAG,SM intel;
  class ING,CTX,ERV,POL dec;
  class EXECU,REC exec;
  class PG,RD store;
  class DASH,GRAF prod;
```

**Read it as:** events enter the **Decision plane**, which consults the **Intelligence
plane** for advice (diagnosis) and estimates (`P(success)`), ranks actions by ERV,
then hands the ranked list to the deterministic **Policy/Safety Engine** — the only layer
that can authorize an action. Approved actions go to the **Execution plane**, which acts
idempotently against the payment gateway. **PostgreSQL records everything**; **Redis** only
accelerates coordination and can be lost without affecting correctness.

---

## 2. End-to-End Recovery Workflow (single failed payment)

The runtime decision → recovery loop, with synchronous vs. asynchronous flows and the
failure/fallback branches made explicit.

**Legend:** `──▶` synchronous (in-request) · `╌╌▶` asynchronous (background / webhook / queue) ·
🔶 decision point · 🟥 fallback / safety path.

```mermaid
flowchart TD
  classDef step fill:#eef4fb,stroke:#2c6fbb,color:#0f2a44;
  classDef decpt fill:#fff7e0,stroke:#d68910,color:#5a3a09;
  classDef fallback fill:#fdecec,stroke:#c0392b,color:#5b1a12;
  classDef terminal fill:#e7f6ec,stroke:#2e8b57,color:#123a24;
  classDef store fill:#efeafb,stroke:#6c3fb0,color:#2c1a4d;

  A["1 · Webhook: payment.failed<br/>Event Ingestor — idempotent on external_event_id"]:::step
  DUP{"Duplicate webhook?"}:::decpt
  DROP["Ignore — one payment_events row only<br/><i>(at-least-once absorbed)</i>"]:::fallback
  B["2 · Context Builder<br/>customer history · prior attempts · merchant policy/cost config"]:::step

  C["3 · Diagnosis Service (timeout-bounded)"]:::step
  CQ{"LLM available &<br/>schema-valid?"}:::decpt
  CF["Fallback: rule-based root-cause table<br/><i>pipeline never stalls</i>"]:::fallback

  D["4 · Statistical Success Model<br/>P(success | context, action) per candidate:<br/>retry · delayed_retry · alt_method · payment_link ·<br/>notify · escalate · no_action"]:::step
  E["5 · ERV Optimizer (merchant-aware)<br/>ERV = P(success)×recoverable_amount − cost − friction_penalty<br/>sort descending"]:::step

  F["6 · Policy / Safety Engine — pure rules, zero ML<br/>max retries · cooldown · min ERV · confidence floor ·<br/>fraud hard-stop · amount ceiling · daily cap · kill switch"]:::step
  FQ{"Policy result"}:::decpt
  BLOCK["BLOCK → no_action / STOP"]:::fallback
  HUMAN["HUMAN_REVIEW → operator queue<br/><i>(audited)</i>"]:::fallback

  G["7 · Decision record persisted<br/>immutable · merchant-scoped · recovery_state set"]:::step
  H["8 · Action Executor — idempotent dispatch<br/>check idempotency_key (DB unique) before acting<br/>pass idempotency-key to external API"]:::step
  HQ{"External call outcome"}:::decpt
  AMB["status = pending_confirmation<br/><b>never blindly retried</b>"]:::fallback
  REC["9 · Reconciler (async) — resolve against gateway status"]:::step

  I{"Recovered?"}:::decpt
  OK["RECOVERED → DONE<br/>outcomes row + recovered_amount"]:::terminal
  RE["RE-EVALUATE next action<br/><i>respects max-retry / cooldown — no bypass</i>"]:::decpt
  STOP["STOP AUTOMATED RECOVERY<br/><i>limits reached / no positive-ERV action</i>"]:::terminal

  M["10 · Metrics aggregator (async)<br/>recovery rate · cost · net recovered · false-action rate"]:::step
  PG[("PostgreSQL — source of truth")]:::store
  DASH["Merchant / Operator Dashboard"]:::step

  A --> DUP
  DUP -->|yes| DROP
  DUP -->|no| B --> C --> CQ
  CQ -->|yes| D
  CQ -->|no| CF --> D
  D --> E --> F --> FQ
  FQ -->|BLOCK| BLOCK
  FQ -->|HUMAN_REVIEW| HUMAN
  FQ -->|ALLOW| G --> H --> HQ
  HQ -->|"confirmed / failed"| I
  HQ -->|"timeout / ambiguous"| AMB
  AMB -.-> REC -.-> I
  I -->|yes| OK
  I -->|no| RE
  RE -->|"another action ALLOWed"| F
  RE -->|"no eligible action"| STOP

  OK -.-> M
  STOP -.-> M
  BLOCK -.-> M
  OK --> PG
  G --> PG
  H --> PG
  M -.-> PG
  PG --> DASH
```

### Redis-down degradation (correctness never depends on Redis)

```mermaid
flowchart LR
  classDef step fill:#eef4fb,stroke:#2c6fbb,color:#0f2a44;
  classDef decpt fill:#fff7e0,stroke:#d68910,color:#5a3a09;
  classDef fallback fill:#fdecec,stroke:#c0392b,color:#5b1a12;

  N["Policy / Executor needs<br/>cooldown + rate-limit check"]:::step
  Q{"Redis available?"}:::decpt
  R["Redis: TTL keys +<br/>atomic counters (fast path)"]:::step
  P["Fallback: derive from recent<br/>actions/decisions rows in Postgres"]:::fallback
  N --> Q
  Q -->|yes| R
  Q -->|no| P
```

---

## 3. Recovery State Machine

Every recovery event carries an explicit, auditable state. This is **not a separate
service** — it is the `decisions.recovery_state` column, transitioned inside the existing
Go decision/execution plane. It prevents uncontrolled retries and makes progress auditable.

```mermaid
stateDiagram-v2
  [*] --> FAILED
  FAILED --> DIAGNOSED: Diagnosis Service produces root cause
  DIAGNOSED --> RECOVERY_ELIGIBLE: Policy — not hard-blocked (no fraud flag, under caps)
  RECOVERY_ELIGIBLE --> ACTION_SELECTED: ERV rank + Policy ALLOW on top candidate
  ACTION_SELECTED --> ACTION_PENDING: Executor dispatches idempotently
  ACTION_PENDING --> RECOVERED: outcome = success
  ACTION_PENDING --> FAILED: outcome = action failed
  RECOVERED --> DONE
  FAILED --> RE_EVALUATE: re-evaluate options
  RE_EVALUATE --> ACTION_SELECTED: next action (within max-retry / cooldown)
  RE_EVALUATE --> STOPPED: limits reached / no positive-ERV action
  DONE --> [*]
  STOPPED --> [*]
```

> **ACTION_FAILED vs. OUTCOME_UNKNOWN:** an ambiguous external result (timeout after send)
> does **not** move to `FAILED`. The action is marked `pending_confirmation` and reconciled
> against the gateway's idempotent status check before any ledger change — preventing
> accidental duplicate actions.

---

## 4. Merchant-Specific Economics & Multi-Merchant Boundary

Two merchants with an otherwise identical failed payment can rationally choose different
actions, because `cost` and `friction_penalty` take `merchant` as input and policy
thresholds are merchant-overridable (within platform ceilings). Tenancy is a simple
row-level `merchant_id` boundary — no schema-per-tenant, no Kafka, no Kubernetes.

```mermaid
flowchart TB
  classDef cfg fill:#efeafb,stroke:#6c3fb0,color:#2c1a4d;
  classDef step fill:#eef4fb,stroke:#2c6fbb,color:#0f2a44;

  subgraph CFG["Merchant configuration (PostgreSQL)"]
    P1["merchant_policy_config<br/>max_retries · cooldown · min_erv_threshold ·<br/>daily_action_cap · amount_ceiling · confidence_floor_override"]:::cfg
    P2["merchant_action_costs<br/>monetary_cost · friction_weight (per action)"]:::cfg
    P3["merchants.risk_tolerance_tier"]:::cfg
  end

  ERV["ERV Optimizer<br/>uses cost + friction_penalty"]:::step
  POL["Policy / Safety Engine<br/>uses thresholds + ceilings"]:::step
  CTX["Context Builder<br/>attaches merchant config"]:::step

  P2 --> ERV
  P1 --> POL
  P3 --> POL
  P1 --> CTX
  ERV --> POL
```

Platform-level safety floors (e.g. the diagnosis **confidence floor**, the **fraud hard-stop**,
and the **kill switch**) are **not** merchant-overridable.

---

## Provenance

Every element above maps to the authoritative documents — nothing is invented.

| Diagram element | Source |
|---|---|
| Three-plane separation, "must never be bypassed" | PLAN §2 |
| Event Ingestor, Context Builder, Diagnosis, Success Model, ERV, Policy, Executor, Reconciler, Audit/Metrics, Dashboard | PLAN §3 (Major Components) |
| Numbered end-to-end data flow (steps 1–10) | PLAN §4 |
| ERV formula `P(success)×amount − cost − friction` | PLAN §5 / PROBLEM_STATEMENT §8 |
| Policy constraints (retries, cooldown, min ERV, confidence floor, fraud hard-stop, amount ceiling, daily cap, kill switch), ALLOW/BLOCK/HUMAN_REVIEW | PLAN §6 |
| Recovery state machine on `decisions.recovery_state` (not a new service) | PLAN §6a / PROBLEM_STATEMENT §10 |
| LLM advisory-only boundaries; statistical model separate from LLM | PLAN §7 / PROBLEM_STATEMENT §9, §23, §24 |
| Data model / stores enumerated in PostgreSQL | PLAN §8 |
| Candidate actions (retry, delayed_retry, alt_method, payment_link, notify, escalate, no_action) | PLAN §4 / PROBLEM_STATEMENT §7 |
| Idempotency key = unique DB constraint; `pending_confirmation`; ACTION_FAILED vs OUTCOME_UNKNOWN | PLAN §8 / PROBLEM_STATEMENT §11, §12 |
| Redis ephemeral, reconstructable from Postgres; Postgres-only vertical slice | PLAN §2, §13 / PROBLEM_STATEMENT §22 |
| Merchant-specific config/economics; row-level tenancy | PLAN §5, §6, §9 / PROBLEM_STATEMENT §14 |
| Dashboard primary, Grafana secondary | PLAN §10, §11 / PROBLEM_STATEMENT §20, §21 |
| At-least-once webhooks; async outcome webhook + reconciliation job; Redis job queue | PLAN §3, §4, §6, §13 |

**Honest limitation (per both documents):** the buildathon `P(success)` model is trained on
synthetic/simulated data; results demonstrate performance in a simulated environment and do
not represent real Razorpay customer behaviour.
