# Delivery plan

## Objective

Stand up a repository a fresh session can verify and resume, then execute Phase 0 of SEC Research MCP through independent fixtures and locked contracts. Product implementation is queued, not claimed complete.

See [docs/product/PROJECT.md](docs/product/PROJECT.md).

## State

- Status: F001/F016 passing. F002 blocked on live interviews. F003–F015 implemented in this slice.
- Current task ID: none active
- Base branch: `main`
- Tracking record: [docs/harness/tasks.json](docs/harness/tasks.json)
- Current handoff: [docs/harness/SESSION_HANDOFF.md](docs/harness/SESSION_HANDOFF.md)

## Slices

IDs match `docs/harness/tasks.json`. SEC-* labels are the product backlog IDs from the authorized plan.

| ID | Slice | Dependencies | Verification | Status |
| --- | --- | --- | --- | --- |
| F001 | Record a pinned public EDGAR reference baseline locally (SEC-001) | | harness, typecheck, lint, domain | passing |
| F002 | Interview six users across three groups (SEC-002) | | documented interview notes | blocked |
| F003 | Inventory reuse, licenses, and dependency choices (SEC-003) | F001 | attribution plan in docs/upstream.md | implemented |
| F004 | Complete entity/fact/period/source/coverage contracts (SEC-004) | F001 | reviewed schemas and missingness rules | implemented |
| F005 | Independent golden source fixtures (SEC-005) | F004 | expected numeric and cutoff values | implemented |
| F006 | Finish contract generation beyond this bootstrap (SEC-006 remainder) | F003, F004 | generated public schemas | implemented |
| F007 | Spike official MCP adapters and static chart output (SEC-007) | F006 | fixture workflow in stdio and HTTP | implemented |
| F008 | SEC fetch broker with coordinated pacing (SEC-008) | F004, F006 | concurrency, retries, block-page tests | implemented |
| F009 | Immutable source store and manifests (SEC-009) | F004, F006 | hash verification, atomic publication | implemented |
| F010 | Entity and historical filing discovery (SEC-010) | F008, F009 | ambiguity and coverage fixtures | implemented |
| F011 | Document extraction and stable anchors (SEC-011) | F005, F009 | section/text evidence | implemented |
| F012 | Raw fact ingestion with exact decimals (SEC-012) | F005, F008, F009 | lossless values through storage | implemented |
| F013 | Local dataset versions and query isolation spike (SEC-013) | F004, F009 | restart recovery, unauthorized-input denial | implemented |
| F014 | One source-to-chart vertical slice (SEC-014) | F007, F010–F013 | install, retrieve, chart, export, restart | implemented |
| F015 | Alpha review and re-estimate (SEC-015) | F014 | measured gaps and next-phase acceptance | implemented |
| F016 | Harness plumbing self-check (not product) | | harness, typecheck, lint, domain | passing |

Keep exactly one task `active`. Domain types in `packages/domain` are a starting declaration layout, not completion of F004.

## Checkpoints

- Bootstrap: native runner, CI, docs, domain types/constants, queued F001–F015.
- Phase 0 exit: developer can reproduce the baseline, run the fixture harness, and explain the chosen contracts.
- P1 exit: fresh local install retrieves one supported company filing and a sourced metric chart.

## Closeout

A slice is complete only after local verification, a draft GitHub PR, required CI, and harness `deliver`. Remote is `ensp1re/sec-research-mcp`; default branch is `main`.
