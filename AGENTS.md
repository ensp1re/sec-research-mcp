# SEC Research MCP working contract

Open, local-first SEC research product for agents. Working name only; package, repository, domain, and trademark availability are unchecked.

This file is the project router. Read only the linked document needed for the current task.

## Start here

1. Run `node scripts/harness/runner.mjs --root . context` from the repository root. Use its output for the active task, ready task IDs, blockers, evidence freshness, and next action.
2. Confirm the reported git branch, revision, and dirty state. Do not invent them.
3. Read the active task, plan, and handoff paths reported by `context`.
4. Read [docs/product/PROJECT.md](docs/product/PROJECT.md) and [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) before changing specced behavior or package boundaries.
5. Run `npm install` when `node_modules` is missing. Record material failures in [docs/harness/handoff.json](docs/harness/handoff.json).

## Working rules

- Work one feature slice at a time.
- Keep SEC domain types independent of the MCP SDK and of third-party server frameworks.
- Do not put competitor names, their repository URLs, or their commit pins in git, GitHub, CI, or public docs. Keep those notes in `.local/` (gitignored).
- Put named interfaces, type aliases, and enums in the owning package's `src/types/` tree. Put finite runtime domain values in `src/constants/` as `as const` objects. Type modules derive unions from those objects with type-only imports. Implementation files use `import type` for erased declarations and ordinary imports for constants. Do not declare named interfaces in implementation files.
- Start a package only when its boundary is used. Do not add empty scaffolding.
- The fetch broker is the only component allowed to make SEC requests. Query and render workers have no general outbound network.
- Financial values are decimal strings in public contracts. Missingness is never zero.
- Use a branch named `feat/<task-id>-<slug>` based on `main`.
- After a PR merges, delete the feature branch on origin and locally in the same session. Do not keep merged branches, extra remotes, abandoned worktrees, or stash leftovers. Run `git fetch --prune`. GitHub auto-deletes merged head branches; do not turn that off.
- Keep secrets out of source, logs, plans, handoffs, and pull requests.
- Husky runs `npm run verify` on commit and on push. Do not use `--no-verify`. A commit or push that fails typecheck, lint, harness tests, domain tests, or harness validate is rejected.

## Lifecycle and evidence

Use `not_started → active → verified → passing`; use `blocked` when a concrete external condition prevents progress. A failed check returns the task to `active`. A stale `verified` task cannot pass delivery until it is reactivated and verified again.

Before `verified`, run `node scripts/harness/runner.mjs --root . verify ID`. Running `npm test` directly does not record harness evidence.

## Local to GitHub delivery

Push and PR actions require authorization in the current task. Remote is `ensp1re/sec-research-mcp`. Default branch is `main`.

1. Implement one slice on an isolated branch and keep the plan and handoff current.
2. Run `npm test` locally and fix failures.
3. Commit, then push the branch.
4. Open a **draft GitHub pull request** against `main`. CI is [.github/workflows/ci.yml](.github/workflows/ci.yml).
5. Watch required CI checks. Keep the PR draft until they are green.
6. Record the PR URL and implementation commit in [docs/harness/tasks.json](docs/harness/tasks.json) through `node scripts/harness/runner.mjs --root . deliver ID`.
7. After merge, delete the head branch on origin and locally. Do not leave it around.

## Harness commands

```text
node scripts/harness/runner.mjs --root . context
node scripts/harness/runner.mjs --root . tasks
node scripts/harness/runner.mjs --root . validate
node scripts/harness/runner.mjs --root . transition ID active
node scripts/harness/runner.mjs --root . verify ID
node scripts/harness/runner.mjs --root . handoff
node scripts/harness/runner.mjs --root . archive ID --dry-run
node scripts/harness/runner.mjs --root . deliver ID --dry-run
```

## Stop and hand off

Update decisions, rejected approaches, blockers, and nextAction in [docs/harness/handoff.json](docs/harness/handoff.json), then run `handoff`. Durable history belongs in [PLAN.md](PLAN.md), the change record, or git.

## Document map

| Topic | Path |
| --- | --- |
| Product requirements | [docs/product/PROJECT.md](docs/product/PROJECT.md) |
| Architecture | [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) |
| Plan | [PLAN.md](PLAN.md) |
| Queue | [docs/harness/tasks.json](docs/harness/tasks.json) |
| Handoff | [docs/harness/SESSION_HANDOFF.md](docs/harness/SESSION_HANDOFF.md) |
| Reliability | [docs/operations/RELIABILITY.md](docs/operations/RELIABILITY.md) |
| Security | [SECURITY.md](SECURITY.md) |
| Upstream reuse | [docs/upstream.md](docs/upstream.md) |
