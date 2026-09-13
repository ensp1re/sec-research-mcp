# SEC Research MCP

Working name. Package, repository, domain, and trademark availability must be checked before a release.

## Outcome

A user asks a research question and receives a useful result whose numbers, dates, assumptions, and citations can be inspected and reproduced. Agents, analysts, journalists, educators, and teams can complete that workflow locally without a paid data vendor, hosted account, or server-side language model.

## Scope

### In scope for the first research release

- Company resolution, historical filing discovery, text/section retrieval
- Reviewed financial concept catalog, period-aware series, peer comparisons
- Bounded dataset queries, chart rendering, exports, evidence packets
- Explicit coverage and local installation
- TypeScript core with MCP, CLI, and a small HTTP API sharing one application layer

### Hosted release additions

Authenticated workspaces, durable research, background jobs, quotas, isolation, backup recovery, monitored operation.

### Out of scope for the initial product

Live filing submission, EDGAR filer account management, brokerage transactions, investment recommendations, price feeds, automatic security-ID licensing, unrestricted agent code runtime.

## Non-negotiable outcomes

1. Every reported number identifies source, unit, period, and availability date. Every derived number identifies its calculation and inputs.
2. Comparisons distinguish fiscal periods, calendar alignment, amendments, accounting definitions, and currencies.
3. Charts and reports are first-class outputs with downloadable data and reproducible specifications.
4. Missing data, incomplete searches, stale results, and unsupported parsing remain visible downstream.
5. A local user can complete the core workflow without paid vendors or hosted accounts.
6. A hosted team can use the same core with authentication, storage, quotas, isolation, monitoring, and recovery.
7. Shared public-data caching keeps outbound SEC traffic inside one coordinated access budget.
8. Product claims are backed by published acceptance tests. Accuracy and performance figures in the plan are targets until measured.

## Users and acceptance workflows

| User | Complete output |
| --- | --- |
| Individual researcher | Financial charts, filing excerpts, material events, definitions, source list |
| Analyst | Period-aware dataset, growth/margin charts, comparability warnings, CSV/Parquet |
| Journalist | Section comparison with dates, citations, and reviewable labels |
| Developer | Typed contracts, clear errors, small discovery surface, stable packaging |

Reference workflows that must remain usable with missing metrics, different fiscal calendars, or amended filings:

1. Company comparison (NVDA, AMD, INTC over twelve periods) to dataset, charts, and evidence packet.
2. Disclosure comparison of two filings with aligned excerpts.
3. Persistent watchlist that does not emit duplicate logical events after restart.

## Constraints

- Runtime: TypeScript on Node.js 24 baseline.
- License: Apache-2.0 for core, adapters, schemas, and basic chart/report tools.
- Local: SQLite metadata, local files, isolated DuckDB execution.
- Hosted: PostgreSQL metadata and jobs, object storage, isolated workers.
- Primary data: public SEC sources, starting with EDGAR.
- Language models are optional and cannot decide numeric truth.
- A pinned public EDGAR reference may be used locally. It is not a drop-in product and is not named in this repository.

## Verification contract

Local verification is `npm test`. CI is [.github/workflows/ci.yml](../../.github/workflows/ci.yml). Product readiness is not established by harness plumbing or a compiling type package. See [PLAN.md](../../PLAN.md) for release gates.
