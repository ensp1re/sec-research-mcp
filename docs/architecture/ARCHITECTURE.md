# Architecture

## System boundary

This repository owns SEC research application logic: domain types, contracts, source adapters, parsers, financial semantics, datasets, artifacts, monitoring, and thin MCP/HTTP adapters.

It does not own live EDGAR filing submission, brokerage execution, or a generic code runtime. Hosted gateways are replaceable. Durable state lives in stores, not in an MCP connection.

## Structural choice

Modular TypeScript monolith with explicit application ports and independently runnable workers. One codebase; separate execution where isolation or scaling requires it.

```text
Clients → MCP/HTTP adapters → application services
                               ├─ metadata / jobs / permissions
                               ├─ immutable source objects and datasets
                               └─ job scheduler
                                    ├─ ingest workers → fetch broker → SEC
                                    ├─ isolated query workers (DuckDB)
                                    ├─ isolated chart/report workers
                                    └─ watch evaluation / delivery
```

The broker is the only component allowed to make SEC requests. Query and rendering processes have no general outbound network.

## Package ownership

| Package | Owns | Must not own |
| --- | --- | --- |
| `packages/domain` | Entity, filing, fact, period, metric, dataset, artifact, event types and constants | HTTP, SDK calls, database clients |
| `contracts` | Input/output schemas, errors, versioned DTOs | Data retrieval or financial policy |
| `application` | Use cases, authorization, budgets, orchestration | Transport-specific request handling |
| `sec-sources` | Source discovery, request construction, upstream schemas | Arbitrary URLs from agent input |
| `filing-parsers` | Text, XML, tables, sections, extraction evidence | Agent-generated claims |
| `financials` | Metric mappings, periods, revision policy, calculations | Rendering or authentication |
| `datasets` | Snapshots, query manifests, lineage, retention | Global unfiltered database access |
| `research` | Evidence packets, comparison methods, report validation | Unbounded autonomous browsing |
| `artifacts` | Chart specifications, render jobs, exports | Direct SEC requests |
| `monitoring` | Watch definitions, checkpoints, event generation | Hidden delivery destinations |
| `infrastructure` | Stores, queue, broker, isolation, telemetry | Financial semantics |
| `mcp-adapter` / `http-adapter` | Protocol mapping | Parallel copies of application logic |

Start a package when its boundary is used. `packages/domain` exists because declaration ownership starts there.

## TypeScript declaration ownership

Named interfaces, aliases, and enums live under `src/types/` in the owning package, grouped by domain. Finite runtime values live under `src/constants/` as `as const` objects. Type modules may import constants with `import type`. Implementations consume both. Do not add a shared `utils` package or a second type tree.

## Deployment profiles

| Profile | Components |
| --- | --- |
| Local | CLI/stdio, SQLite, content-addressed files, child query/render processes |
| Self-hosted team | Gateway, worker, fetch broker, PostgreSQL, object storage |
| Managed service | Multiple gateways and worker pools, managed database, object storage |

Local processes sharing a cache directory must share one broker and rate scheduler.

## Initial architecture decisions

| ADR | Decision |
| --- | --- |
| 001 | Modular TypeScript core; thin protocol adapters |
| 002 | PostgreSQL hosted metadata; SQLite local adapter |
| 003 | Immutable objects and Parquet snapshots |
| 004 | DuckDB in isolated processes |
| 005 | Single coordinated SEC request budget |
| 006 | Decimal strings in public financial contracts |
| 007 | Declarative charts and restricted rendering |
| 008 | PostgreSQL jobs and transactional outbox initially |
| 009 | Optional language-model interpretation |
| 010 | Explicit dataset/report/job handles |
| 011 | OAuth for hosted MCP; scoped keys for developer integrations |
| 012 | Coverage and lineage are domain objects |

Record a new ADR only when a meaningful tradeoff is made.

## Change guide

Before crossing a boundary, update this document and the active plan. Enforce dependency direction in CI once package imports exist. Public contracts evolve additively within a major version.
