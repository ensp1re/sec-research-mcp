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

Demo mode (default): labeled fixtures, no EDGAR. Live mode: set `SEC_USER_AGENT` to a descriptive contact string. Load [references/clients.md](references/clients.md) for other clients.

## Workflow

1. `sec_coverage_get` — see demo vs live and supported metrics.
2. `sec_company_resolve` with the user's ticker, CIK, or name. If the result lists `candidates`, stop and ask which entity.
3. `sec_financials_get` for a reviewed metric (`revenue`, `net_income`, `cash`, `gross_margin`, `operating_cash_flow`).
4. `sec_chart_create` only after a series exists. Show SVG/CSV; do not invent plot points.
5. `sec_filing_read` for text. Demo returns a sample 10-K excerpt labeled as a fixture.
6. `sec_research_run` when the user wants a packet (question, table, coverage, sources).

Load [references/tools.md](references/tools.md) for arguments. Load [references/contracts.md](references/contracts.md) before interpreting numbers.

## Hard rules

- Quote `value` as the decimal string from the tool. Never coerce missing to `0`.
- If `missingness` is set, say that state in words.
- If `derivation` is `derived`, say it is derived and keep operands visible when present.
- If coverage `status` is not `complete_within_scope`, say what is missing.
- Do not call live SEC URLs yourself. The broker allowlists hosts.

For several companies or several agents, load `sec-research-orchestrate` instead of doing it all in one worker.
