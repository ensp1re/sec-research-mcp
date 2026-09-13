# SEC Research MCP

Local SEC research tools for people and agents. You ask a question and get numbers, periods, sources, and a chart you can check. No paid data vendor and no hosted account for the core path.

Working name. Package and trademark checks are still open.

## What it does

- Resolve a company from a ticker, CIK, or name
- Return financial series as **decimal strings** (missing is not zero)
- Extract filing text
- Render a line chart (SVG, PNG, CSV, Vega-Lite spec)
- Build a short evidence packet with coverage and accessions

Default mode uses **labeled fixtures** (Apple / Microsoft samples). It does not download EDGAR until you set `SEC_USER_AGENT`.

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
node apps/cli/dist/main.js financials AAPL revenue
node apps/cli/dist/main.js chart AAPL revenue
node apps/cli/dist/main.js filing
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

Tools: `sec_company_resolve`, `sec_financials_get`, `sec_chart_create`, `sec_filing_read`, `sec_research_run`, `sec_coverage_get`.

## Live EDGAR

Live requests need a descriptive User-Agent with contact, as the SEC asks:

```bash
export SEC_USER_AGENT="YourName your@email.example"
```

All outbound SEC traffic goes through one allowlisted broker (`data.sec.gov`, `www.sec.gov`, `efts.sec.gov`). Arbitrary URLs are rejected. Demo mode still works without this variable.

## Rules the tools follow

- Every value has a unit, period, and source when it exists
- Missing, not applicable, parse failure, and incomplete coverage stay visible
- None of those states become `0`
- Derived values (for example gross margin) are marked `derived`

## Not in this release

Hosted accounts, watches, ownership/13F packs, investment advice, prices, and EDGAR filing submission.

## Develop

```bash
npm test          # typecheck, lint, tests, harness validate
npm run lint:fix
```

Husky runs `npm test` on commit and push. See [docs/product/PROJECT.md](docs/product/PROJECT.md) for product scope and [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) for package boundaries.

## License

Apache-2.0. [LICENSE](LICENSE), [NOTICE](NOTICE).
