# SEC Research MCP

Local SEC research tools for people and agents. You ask a question and get numbers, periods, sources, and a chart you can check. No paid data vendor and no hosted account for the core path.

Working name. Package and trademark checks are still open.

## What it does

- Resolve a company from a ticker, CIK, or name
- Return financial series as **decimal strings** (missing is not zero)
- Extract filing text
- Render a line chart (SVG, PNG, CSV, Vega-Lite spec)
- Build a short evidence packet with coverage and accessions

Live EDGAR is the default. If `SEC_USER_AGENT` is unset, the runtime generates one. Set `SEC_DEMO=1` for labeled Apple / Microsoft fixtures.

## Install

Node.js 24+.

```bash
git clone https://github.com/ensp1re/sec-research-mcp.git
cd sec-research-mcp
npm install
npm run build
```

## First run

```bash
npm run demo
```

That prints an evidence packet for AAPL revenue from fixtures. Then:

```bash
node apps/cli/dist/main.js doctor
node apps/cli/dist/main.js resolve AAPL
node apps/cli/dist/main.js filings AAPL 10-K
node apps/cli/dist/main.js financials AAPL revenue
node apps/cli/dist/main.js compare AAPL,MSFT revenue
node apps/cli/dist/main.js chart AAPL revenue
node apps/cli/dist/main.js filing AAPL
SEC_DEMO=1 node apps/cli/dist/main.js holdings AAPL
SEC_DEMO=1 node apps/cli/dist/main.js rulemaking
SEC_DEMO=1 node apps/cli/dist/main.js watch-create AAPL
```

Metrics in the demo set: `revenue`, `net_income`, `cash`, `gross_margin`, `operating_cash_flow`.

## MCP (stdio)

Point an MCP client at the built server. Logs stay on stderr.

```json
{
  "mcpServers": {
    "sec-research": {
      "command": "node",
      "args": ["apps/mcp/dist/server.js"],
      "cwd": "/absolute/path/to/sec-research-mcp"
    }
  }
}
```

HTTP (loopback): `npm run api` then `GET /health`, `/v1/companies?q=AAPL`, `/v1/filings?q=AAPL`, `/v1/holdings?q=AAPL`. Watch and job routes take `Authorization: Bearer <key>` (default local key `local-dev`, or `SEC_API_KEY`).

Tools: `sec_coverage_get`, `sec_company_resolve`, `sec_filings_search`, `sec_filing_read`, `sec_filing_compare`, `sec_concepts_search`, `sec_financials_get`, `sec_companies_compare`, `sec_dataset_describe`, `sec_dataset_query`, `sec_dataset_export`, `sec_chart_create`, `sec_research_run`, `sec_holdings_get`, `sec_rulemaking_get`, `sec_watch_create`, `sec_watch_list`, `sec_watch_events`.

Agents: copy [skills/](skills/) into the client skills path. `sec-research` is the single-worker MCP workflow. `sec-research-orchestrate` splits resolve / numbers / filings / charts / critic across agents.

## Live EDGAR

Live requests send a User-Agent. Set your own if you have one; otherwise the runtime generates `sec-research-mcp/<id> (research; qa@localhost.invalid)`:

```bash
export SEC_USER_AGENT="YourName your@email.example"
```

`SEC_DEMO=1` stays on fixtures. All outbound SEC traffic goes through one allowlisted broker (`data.sec.gov`, `www.sec.gov`, `efts.sec.gov`). Arbitrary URLs are rejected.

## Rules the tools follow

- Every value has a unit, period, and source when it exists
- Missing, not applicable, parse failure, and incomplete coverage stay visible
- None of those states become `0`
- Derived values (for example gross margin) are marked `derived`

## Not in this release

Public IdP OAuth, production multi-tenant SaaS, object-storage vendors, investment advice, prices, and EDGAR filing submission. 13F holdings and rulemaking return sourced rows when the payload has them, otherwise explicit incomplete coverage.

## Develop

```bash
npm test          # typecheck, lint, tests, harness validate
npm run lint:fix
```

Husky runs `npm test` on commit and push. See [docs/product/PROJECT.md](docs/product/PROJECT.md) for product scope and [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) for package boundaries.

## License

Apache-2.0. [LICENSE](LICENSE), [NOTICE](NOTICE).
