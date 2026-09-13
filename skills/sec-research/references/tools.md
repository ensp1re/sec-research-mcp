# Tool catalog

All tools return a JSON envelope: `schemaVersion`, `requestId`, `data`, `sources`, `coverage`, `warnings`.

| Tool | Input | Use |
| --- | --- | --- |
| `sec_coverage_get` | none | Demo vs live, metric list |
| `sec_company_resolve` | `query` | Ticker, CIK, or name. Ambiguous → `candidates` |
| `sec_filings_search` | `query`, optional `form`, `from`, `to` | Filing metadata page |
| `sec_filing_read` | optional `query`, `accession`, `section` | Extracted text + anchors |
| `sec_filing_compare` | `query`, `accessionA`, `accessionB`, optional `section` | added/removed/moved paragraphs |
| `sec_concepts_search` | `term` | Reviewed metrics and tags |
| `sec_financials_get` | `query`, `metric` | Series + `dataset_id` |
| `sec_companies_compare` | `queries[]`, `metric` | Period table; gaps stay missing |
| `sec_dataset_describe` | `dataset_id` | Schema, row count, lineage |
| `sec_dataset_query` | `dataset_id`, optional `metric`, `limit`, `sql` | Bounded filter or one SELECT |
| `sec_dataset_export` | `dataset_id` | CSV with decimal strings |
| `sec_chart_create` | `query`, `metric` | SVG, PNG, CSV, Vega-Lite |
| `sec_research_run` | `query`, `metric` | Markdown packet + chart + coverage |

Live EDGAR: set `SEC_USER_AGENT`. Demo fixtures otherwise.
