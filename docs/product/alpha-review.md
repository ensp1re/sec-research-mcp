# Alpha review (F015)

Date: 2026-09-14

## What works locally

- `sec-research doctor` checks Node and fixture paths.
- `sec-research demo` prints an evidence packet for AAPL revenue from fixtures.
- MCP stdio tools: resolve, financials, chart, filing read, research, coverage.
- Missing metrics stay null with an explicit missingness code.
- Charts include SVG, PNG, CSV, and a Vega-Lite spec.

## Limits

- Demo mode uses labeled fixtures, not a live EDGAR crawl.
- Live fetches require `SEC_USER_AGENT` and go only through the allowlisted broker.
- Interview study (F002) is still blocked: six live sessions have not been run.
- Advanced SQL is rejected except a single SELECT gate; DuckDB isolation is not in this alpha.
- Hosted workspaces, watches, and ownership packs are out of this slice.

## Re-estimate

The remaining hosted and ownership work is still a later phase. Do not claim full-market coverage from this fixture-backed alpha.
