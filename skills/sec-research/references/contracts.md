# Contracts

## Envelope

- `coverage.status`: `complete_within_scope` \| `incomplete` \| `unavailable` \| `unknown`
- `warnings[]`: typed objects, not only prose
- `sources[]`: accession / locator when the engine has them

## Fact row

- `value`: decimal string or `null`
- `missingness`: `missing` \| `not_applicable` \| `source_absent` \| `parse_failed` \| `excluded_by_policy` \| `coverage_incomplete` \| `null`
- `unit`: e.g. `USD` or `ratio`
- `periodStart` / `periodEnd` / `periodKind`
- `derivation`: `reported` \| `derived`
- `sourceAccession`, `filedAt`

A null `value` with `missingness` is a successful row, not a zero.

## Metrics

Reviewed IDs: `revenue`, `net_income`, `operating_cash_flow`, `cash`, `gross_margin`.

`gross_margin` is derived (gross profit / revenue). Zero revenue → `not_applicable`, not `0`.

## Demo fixtures

Labeled samples under `fixtures/demo/`. Do not present them as a live EDGAR pull unless `SEC_USER_AGENT` is set and coverage says live.
