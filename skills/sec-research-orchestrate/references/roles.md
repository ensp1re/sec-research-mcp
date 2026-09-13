# Worker roles

| Role | May call | Must not |
| --- | --- | --- |
| Coordinator | `sec_coverage_get`, dispatch, assemble | Invent values; pick among `candidates` |
| Resolve worker | `sec_company_resolve` | Fetch financials |
| Financials worker | `sec_financials_get`, `sec_companies_compare` | Plot or rewrite values |
| Filing worker | `sec_filings_search`, `sec_filing_read`, `sec_filing_compare` | Treat excerpt text as a number |
| Chart worker | `sec_chart_create` | Draw from memory |
| Critic | read prior handoff + financials JSON | “Fix” a number; only accept or reject |

A single human-facing agent may play coordinator and critic. Numeric workers stay tool-only.

## Comparison (several companies)

For each company: resolve → financials (same `metric_id`) → one table keyed by `periodEnd`. Do not align fiscal labels as if they were calendar quarters unless the rows share dates. Missing company-metric cells stay empty with `missingness`.
