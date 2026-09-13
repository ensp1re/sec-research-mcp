# Contributing

1. Read [AGENTS.md](AGENTS.md) and run `node scripts/harness/runner.mjs --root . context`.
2. Work the single active task. Do not start a second live slice.
3. Keep domain types in `packages/domain` and follow the types/constants rule in AGENTS.md.
4. Add fixtures with source hashes for any numeric or parser change.
5. Run `npm test` (same as `npm run verify`: typecheck, lint, harness tests, domain tests, harness validate). Record evidence with `verify ID` before claiming the slice is verified.
6. Husky blocks `git commit` and `git push` unless that full gate passes. Do not pass `--no-verify`.
7. Do not push or open a PR unless the current task authorizes delivery. Use `npm run lint:fix` for mechanical ESLint fixes only.
8. After merge, delete the feature branch on GitHub and locally. Do not keep merged branches, extra remotes, or leftover worktrees. `git fetch --prune`.
9. Do not commit competitor names, their repos, or their commit pins. Put those notes in `.local/`.

New metric mappings need source fixtures and review. New form parsers need versioned examples, coverage bounds, and malformed-input tests.
