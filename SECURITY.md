# Security

## Scope and trust boundaries

| Boundary | Required controls |
| --- | --- |
| Agent to tools | Typed inputs, scoped permissions, budgets, honest annotations |
| Fetch broker to SEC | Allowlisted hosts/paths, validated redirects, no arbitrary fetch URLs |
| Source bytes to parsers | XXE disabled, archive/path/expansion limits, bounded HTML/PDF |
| Dataset to SQL worker | Authorized manifest, separate process, no secrets/network |
| Data to renderer | Approved specs, bundled assets, no external URLs/scripts |
| Public source to AI text | Source as data, evidence IDs, claim validation, no source-driven privileges |
| Client to workspace | Authenticated identity, role/scope checks, non-enumerating errors |
| Storage to artifacts | Private object access, expiring links, manifest authorization |
| Watch to destination | Verified endpoints, signatures, egress restrictions |

## Secrets and sensitive data

- Allowed secret sources: environment variables and OS key stores. Never URLs.
- Redact tokens, cookies, and credentials from logs, evidence, plans, and pull requests.
- Public SEC documents can contain personal information. Do not index unrelated personal data.
- Do not copy production credentials or private research into fixtures.

## Authorization and destructive actions

Hosted roles are owner/editor/viewer with scopes `data:read`, `analysis:run`, `artifacts:write`, `research:write`, and `watches:write`. Dataset IDs are names, not permissions. Push, PR, deploy, and data deletion require explicit authorization in the current task.

## Isolation

A Git worktree isolates source changes only. It does not isolate network, credentials, or ignored files. Hosted query/render workers need OS/container restrictions. Local advanced SQL must document its platform boundary or be disabled.

## Release blockers

Cross-tenant access, uncontrolled outbound requests, arbitrary code execution through SQL or rendering, silent numeric corruption, unbounded resource execution, and source content changing agent permissions block public hosting.

See [docs/operations/RELIABILITY.md](docs/operations/RELIABILITY.md) for recovery behavior.
