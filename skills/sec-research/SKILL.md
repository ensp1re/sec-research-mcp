---
name: sec-research
description: >
  Use the SEC Research MCP for company resolve, financial series, filing text,
  charts, and evidence packets. Use when the user asks about SEC filings,
  EDGAR, 10-K/10-Q numbers, company financials, or to connect this MCP.
---

# SEC Research MCP

Connect to the stdio server, then call tools. Do not compute financials in the model.

## Setup

Repo root, Node 24+:

```bash
npm install
npm run build
```

Client config (cwd must be the repo root):

```json
{
  "mcpServers": {
    "sec-research": {
      "command": "node",
      "args": ["apps/mcp/dist/server.js"],
      "cwd": "<repo-root>"
    }
  }
}
```

Live EDGAR is the default. If `SEC_USER_AGENT` is unset, the runtime generates one. Set `SEC_DEMO=1` for fixtures. Load [references/clients.md](references/clients.md) for other clients.

## Workflow

1. `sec_coverage_get` — see demo vs live and supported metrics.
2. `sec_company_resolve` with the user's ticker, CIK, or name. If the result lists `candidates`, stop and ask which entity.
3. `sec_filings_search` then `sec_filing_read` (accession + optional section). Compare two filings with `sec_filing_compare`.
4. `sec_concepts_search` then `sec_financials_get` for a reviewed metric.
5. `sec_companies_compare` for several entities; do not calendar-align fiscal periods silently.
6. `sec_dataset_describe` / `sec_dataset_query` / `sec_dataset_export` on the `dataset_id` from financials or compare.
7. `sec_chart_create` only after a series exists. Show SVG/CSV; do not invent plot points.
8. `sec_research_run` when the user wants a packet (question, table, coverage, sources).
9. `sec_holdings_get` for 13F-style holdings. `sec_rulemaking_get` for rulemaking rows.
10. `sec_watch_create`, `sec_watch_list`, `sec_watch_events` for persistent watches.

Load [references/tools.md](references/tools.md) for arguments. Load [references/contracts.md](references/contracts.md) before interpreting numbers.

## Hard rules

- Quote `value` as the decimal string from the tool. Never coerce missing to `0`.
- If `missingness` is set, say that state in words.
- If `derivation` is `derived`, say it is derived and keep operands visible when present.
- If coverage `status` is not `complete_within_scope`, say what is missing.
- Do not call live SEC URLs yourself. The broker allowlists hosts.

For several companies or several agents, load `sec-research-orchestrate` instead of doing it all in one worker.
