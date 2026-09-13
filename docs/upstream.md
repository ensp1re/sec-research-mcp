# Upstream reuse

Do not publish third-party product names, repository URLs, or commit pins in this git tree or on GitHub. Keep those notes in `.local/` (gitignored).

## Rules

- Record attribution locally before copying implementation or fixtures.
- Inventory licenses and notices first. Preserve applicable Apache notices and document modifications.
- Keep SEC domain types independent of the MCP SDK and of third-party server frameworks.
- Offer compatibility only for named, tested tools. Do not claim drop-in parity without running a contract suite.
- Prefer contributing generally useful parser fixes upstream. Contribution is a separate external action.

F001 records a pinned public-data reference in `.local/` only. F003 decides what, if anything, to reuse.
