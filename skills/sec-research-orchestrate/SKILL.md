---
name: sec-research-orchestrate
description: >
  Coordinate several agents on SEC research: resolve entities, fetch series,
  read filings, render charts, and critic-check numbers. Use when comparing
  companies, splitting research, or running a multi-agent EDGAR workflow.
---

# Multi-agent SEC research

One coordinator. Workers do not invent numbers. Shared artifact is the evidence packet from `sec_research_run` / the CLI demo.

Load this skill plus [../sec-research/SKILL.md](../sec-research/SKILL.md). Tool details: [../sec-research/references/tools.md](../sec-research/references/tools.md). Roles: [references/roles.md](references/roles.md).

## Coordinator

1. Parse the question into entities, metrics, period intent, and output (table / chart / packet).
2. Call `sec_coverage_get` once. Tell workers demo vs live.
3. Dispatch **resolve** workers in parallel (one query per worker). Join on stable `entity.id` / CIK.
4. If any resolve returns `candidates`, stop the DAG and return the list. Do not pick silently.
5. Dispatch **financials** workers in parallel (entity × metric). Each worker may only call `sec_financials_get` (and coverage if needed).
6. Optional **filing** worker: `sec_filing_read` for text. Do not mix filing prose into numeric cells.
7. Optional **chart** worker: `sec_chart_create` only on series that already exist.
8. **Critic** worker: compare packet numbers to financials rows. Fail the run if any quoted figure is not in the tool output.
9. Coordinator writes the user answer from tool JSON only. Attach coverage and source accessions.

## Parallelism

- Safe in parallel: resolve of different queries; financials of different entities; chart after its own series is ready.
- Not parallel with its input: chart before financials; critic before all numeric workers return.
- Do not spawn extra live MCP servers to go faster. One broker budget.

## Handoff blob (between agents)

```json
{
  "question": "",
  "entity_id": "",
  "cik": "",
  "metric_id": "",
  "coverage_status": "",
  "rows": [],
  "warnings": [],
  "next": "financials|chart|critic|stop"
}
```

`rows` are tool fact rows, not model-written numbers.

## Stop conditions

- Ambiguous entity
- Metric unavailable
- Coverage incomplete for the asked periods — return partial rows plus gaps
- Critic mismatch — return both the bad quote and the tool row
