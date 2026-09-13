# Tool catalog

All tools return a JSON envelope: `schemaVersion`, `requestId`, `data`, `sources`, `coverage`, `warnings`.

| Tool | Input | Use |
| --- | --- | --- |
| `sec_coverage_get` | none | Demo vs live, entity and metric lists |
| `sec_company_resolve` | `query` string | Ticker, CIK, or name. Ambiguous → `candidates` |
| `sec_financials_get` | `query`, `metric` (default `revenue`) | Series of decimal strings + periods + accessions |
| `sec_chart_create` | `query`, `metric` | SVG, PNG (base64), CSV, Vega-Lite, description |
| `sec_filing_read` | none in demo | Extracted HTML text from the sample filing |
| `sec_research_run` | `query`, `metric` | Markdown packet + chart + coverage |

CLI equivalents (same engine):

```text
node apps/cli/dist/main.js doctor
node apps/cli/dist/main.js resolve AAPL
node apps/cli/dist/main.js financials AAPL revenue
node apps/cli/dist/main.js chart AAPL revenue
node apps/cli/dist/main.js filing
node apps/cli/dist/main.js demo
```
