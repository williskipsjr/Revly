# diagnosis-service (Python / FastAPI)

The **Intelligence plane**. Isolated by design: no payment credentials, write access limited
(from Phase 1) to a `diagnoses` table. Turns event + context into a schema-validated
`Diagnosis` (see `../schemas/diagnosis.schema.json`).

**Boundaries (hard):** never computes `P(success)` used in ERV, never calls the payment API,
never bypasses policy, never determines an amount. `confidence` is a gate, not a probability.

## Phase 0

```bash
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
curl -s localhost:8000/health
```

## By phase

### Phase 4 — `POST /internal/diagnose`

LLM root-cause classifier. Takes the **moneyless** event slice and returns a
`diagnosis.schema.json`-valid `Diagnosis`:

```jsonc
// request — no amount, merchant, or payment credential ever crosses this boundary
{ "event_type": "payment.failed", "failure_reason": "Issuer declined", "method": "card", "prior_attempts": 0 }
```

The model is forced to call one tool (`emit_diagnosis`) whose input schema constrains the four
generated fields (`root_cause`, `confidence`, `rationale`, `candidate_actions`); the service stamps
`schema_version` / `model_version` / `source="llm"` and returns the assembled document. `confidence`
is a **gate, not a probability** — never the ERV `P(success)` term.

**Fallback is owned by the Go decision plane, not this service** (single source of truth = the Go
rule table). This endpoint never reimplements the rules: on *any* failure — no credential, transport
error, timeout, a response with no tool call, or output that fails contract validation — it returns a
structured **non-2xx** (`503 llm_unavailable` when unconfigured, `502` otherwise). The Go client
(`decision-engine/internal/diagnosis/llm`) treats any non-200 / connection error / schema violation as
"use `diagnosis.Diagnose` (rule table), tagged `rule_based_fallback`." Result: killing this service
mid-demo yields automatic, correct rule-based diagnosis with no pipeline stall (PLAN §15).

### Inference gateway (AgentRouter, Anthropic-compatible)

Configured entirely by environment (see repo `.env.example`); the `anthropic` SDK is imported lazily
so the module still imports where the package is absent (offline sandbox / tests):

| Env | Meaning | Default |
|-----|---------|---------|
| `ANTHROPIC_BASE_URL` | Gateway origin, **without** a `/v1` suffix (the SDK appends the path) | `https://agentrouter.org` |
| `ANTHROPIC_AUTH_TOKEN` | AgentRouter key, sent as `Authorization: Bearer …`. `ANTHROPIC_API_KEY` accepted as an alias. Unset ⇒ endpoint 503s ⇒ Go rule-based fallback | — |
| `LLM_MODEL` | Model id | `claude-sonnet-5` |
| `LLM_MAX_TOKENS` / `LLM_TIMEOUT_SECONDS` | Per-call output cap / client timeout | `1024` / `8.0` |

The statistical `P(success)` model lives separately (`../ml/`), loaded by the decision engine — a
different code path, so LLM text can never become the probability term.

### Tests

Offline, stdlib `unittest` (no network, no `anthropic`, no `pytest` needed):

```bash
.venv/bin/python -m unittest discover -s tests -v
```

