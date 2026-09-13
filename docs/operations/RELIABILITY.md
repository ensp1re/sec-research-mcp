# Reliability and recovery

## Reliability target

Harness state, source objects, datasets, and job records must survive command failure and process restart. External SEC requests and webhook deliveries are at-least-once and must be idempotent at the publication boundary.

## Failure and recovery table

| Failure | Observable signal | Recovery action | Evidence required |
| --- | --- | --- | --- |
| Command or test failure | Non-zero exit | Return slice to `active`, record output, fix, rerun | Command, status, relevant output |
| Interrupted session | Missing or stale handoff | Resume from last recorded checkpoint | Run identity and next action |
| Unfinished verify attempt | Attempt status `running` | Runner marks it `interrupted`; never treat as passed | Attempt JSON |
| Stale verified evidence | `validate` exit 1, `fresh: false` | Reactivate and verify again | Fingerprint mismatch |
| SEC unavailable or blocking | 403/429 or block page | Serve dated cache; queue refresh; fail closed for uncoordinated fetches | Coverage/freshness fields |
| Query worker crash | Job failed | Retry idempotently within budget | Job attempt history |
| Chart worker unavailable | Render job incomplete | Return dataset/spec and job status; do not claim an image | Artifact manifest |
| Broker lock lost | Two leaders would spend the SEC budget | Fence, cooldown, fail closed | Broker metrics |
| Dirty GitHub delivery | Missing remote, auth, or CI | Leave task `verified`; report blocker | `deliver --dry-run` payload |

## State boundaries

- Harness writes use a PID lock, atomic replace, and attempt records written before checks.
- Ingestion: persist raw bytes, then parse. Publish through staged object keys and a single metadata transaction.
- Jobs: `queued → running → succeeded \| failed \| canceled`, with `retry_wait` and `cancel_requested`.
- Saved research: refresh creates a new version; it never rewrites an old conclusion.

## Verification and observability

Required local check: `npm test`. CI: [.github/workflows/ci.yml](../../.github/workflows/ci.yml). Harness evidence lives under `docs/harness/runs/` and is gitignored. Structured logs should carry request, source, job, dataset, and delivery IDs. Do not log filing text, tokens, or private reports by default.

## Retention and restart

Scratch datasets expire on a visible TTL. Pinned reports retain required dataset and source versions. Local users control local backups. Hosted GA targets (metadata RPO 15 minutes, RTO four hours) are proposed until restore drills exist.
