# dashboard (Next.js)

The **primary product surface** (PLAN.md §10). Next.js App Router + TypeScript + Tailwind.
Recharts is added in Phase 8 for the ERV term-breakdown charts.

## Phase 0

```bash
npm install
npm run dev        # http://localhost:3000
curl -s localhost:3000/api/health
```

## By phase (Phase 8)

- Live decision feed (per merchant): failure event → chosen action → outcome.
- Per-decision drill-down: diagnosis rationale, per-term ERV breakdown, policy checks
  (ALLOW/BLOCK/HUMAN_REVIEW), current recovery state.
- Merchant policy-config screen (bounded by platform ceilings).
- Manual override (mandatory reason → audit log), admin-gated kill switch.
- Aggregate metrics: recovery rate, cost per recovered rupee, retries avoided.
- "AI degraded — running on rule-based fallback" banner.
