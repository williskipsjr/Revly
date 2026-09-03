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

- Phase 4: `POST /internal/diagnose` — LLM classifier, JSON-schema-constrained output, with
  fallback to the Phase-2 rule table on timeout/invalid schema.
- The statistical `P(success)` model lives separately (`../ml/`), served/loaded by the
  decision engine — a different code path, so LLM text can never become the probability term.
