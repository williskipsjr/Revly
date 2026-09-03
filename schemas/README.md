# Frozen cross-service contracts

These JSON Schemas are the **shared contracts** between the Go decision engine, the Python
intelligence plane, and the Next.js dashboard. Per PLAN.md Phase 0, contracts are frozen
before code so services can be built independently against a stable interface.

| Schema | Produced by | Consumed by |
|---|---|---|
| `payment_event.schema.json` | Event Ingestor (Go) | Whole pipeline |
| `diagnosis.schema.json` | Diagnosis Service (Python/LLM, or rule-based fallback) | Decision plane (Go) |
| `decision.schema.json` | Decision plane (Go) | Dashboard, audit |
| `merchant.schema.json` | Merchant config store | Decision plane, dashboard |

## Conventions

- **Money is integer minor units (paise).** `amount` and `recoverable_amount` are integers.
  `cost`, `friction_penalty`, and `erv` are numbers in the same minor-unit scale and may be
  fractional (a friction weight can produce fractions of a paisa).
- **`schema_version`** is a required constant on each top-level object (currently `"0.1.0"`).
  A breaking change bumps this; consumers may reject unknown versions.
- **Action enum** (canonical, from PLAN.md §4). Mapping to the PROBLEM_STATEMENT wording:

  | Enum value | Meaning |
  |---|---|
  | `retry` | immediate retry of the payment |
  | `delayed_retry` | retry after a cooldown |
  | `alt_method` | request an updated / alternate payment method |
  | `payment_link` | generate & send a payment link |
  | `notify` | send a payment reminder |
  | `escalate` | escalate to merchant/operator |
  | `no_action` | stop automated recovery |

- **`confidence`** (in `diagnosis`) is a **gating signal only**. It is never used as the
  `P(success)` probability inside ERV. Risk/fraud never appear as ERV terms either — they are
  categorical ALLOW/BLOCK/HUMAN_REVIEW rules in the Policy/Safety engine.
