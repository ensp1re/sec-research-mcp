# Alpha review (F015)

Date: 2026-09-14

## What works locally

- Doctor, coverage, resolve, filings search/read/compare, concepts, financials, company compare, datasets, export, charts, evidence packets.
- MCP stdio and loopback HTTP (`/v1/companies`, `/v1/filings`, `/v1/charts`, `/v1/research-runs`) share the engine.
- Live EDGAR uses `SEC_USER_AGENT` and the allowlisted broker; CI uses mock fetch.
- Missing metrics stay null with an explicit missingness code.

## Limits

- DuckDB process isolation is not in this slice (bounded SELECT only).
- Hosted workspaces, watches, ownership/13F, and regulatory packs are still later phases.

## Re-estimate

The remaining hosted and ownership work is still a later phase. Do not claim full-market coverage from this fixture-backed alpha.
