# Session handoff

This is a readable view of `docs/harness/handoff.json`. Update decisions, rejected approaches, blockers, and nextAction in that JSON source. The handoff command preserves them while refreshing objective facts.

## Current checkpoint

- Updated at: 2026-09-13T21:46:42.114Z
- Task: none
- Plan: PLAN.md
- Git: feat/remove-f002 @ c59dc78594ac602971d00d72c100d4921c38022f (dirty)
- Evidence refs:
- None recorded

## Next action

No live tasks remain. Queue is empty after F002 removal.

## Decisions

- Native Node harness runner in scripts/harness/runner.mjs.
- Domain types and constants live in packages/domain under src/types and src/constants.
- F001 reference notes stay in .local/ and are not published.
- F002 was removed from the queue; live interview work is out of scope.

## Rejected approaches

- Publishing third-party product names or commit pins on GitHub.
- Keeping a blocked interview task in the implementation queue.

## Blockers

- None recorded
