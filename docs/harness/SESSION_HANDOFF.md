# Session handoff

This is a readable view of `docs/harness/handoff.json`. Update decisions, rejected approaches, blockers, and nextAction in that JSON source. The handoff command preserves them while refreshing objective facts.

## Current checkpoint

- Updated at: 2026-09-13T21:42:30.787Z
- Task: none
- Plan: PLAN.md
- Git: feat/phase-0-core @ f9cc9c053db5555221a7e9878c9ef1e23abf564d (dirty)
- Evidence refs:
- None recorded

## Next action

Start F002 interviews, or F003 reuse inventory using local-only notes.

## Decisions

- Native Node harness runner in scripts/harness/runner.mjs.
- Domain types and constants live in packages/domain under src/types and src/constants.
- F001 reference notes stay in .local/ and are not published.
- Working name is SEC Research MCP until naming is checked.

## Rejected approaches

- Publishing third-party product names or commit pins on GitHub.
- Implementing a sample MCP server only to make bootstrap checks green.
- Using ticker strings as primary keys.

## Blockers

- F002 requires human interviews.
