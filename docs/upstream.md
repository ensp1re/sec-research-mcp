# Upstream reuse

Do not publish third-party product names, repository URLs, or commit pins in this git tree or on GitHub. Keep those notes in `.local/` (gitignored).

## Rules

- Record attribution locally before copying implementation or fixtures.
- Inventory licenses and notices first. Preserve applicable Apache notices and document modifications.
- Keep SEC domain types independent of the MCP SDK and of third-party server frameworks.
- Offer compatibility only for named, tested tools. Do not claim drop-in parity without running a contract suite.
- Prefer contributing generally useful parser fixes upstream. Contribution is a separate external action.

## Approved public dependencies (F003)

These are independent libraries, not a third-party SEC product:

| Package | Role |
| --- | --- |
| `@modelcontextprotocol/sdk` | MCP stdio adapter |
| `zod` | Input/output contracts |
| `decimal.js` | Exact decimal arithmetic |
| `lossless-json` | Preserve numeric lexemes |
| `htmlparser2` | HTML text extraction |
| `pngjs` | Static PNG from chart data |

Product runtime is Node.js 24. Do not copy another server’s source into this repository. Local inventory: `.local/reuse-inventory.md`.
