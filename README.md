# SEC Research MCP

Working name. This repository is in harness bootstrap: documentation, a native verification runner, and domain types exist. The research product is not implemented.

## What this is

An open SEC research core that agents can use to collect evidence, run reproducible analysis, create charts and reports, and keep research over time. Public EDGAR data first. Local execution without a paid vendor.

## Current status

- Harness and TypeScript domain types: present
- MCP server, SEC fetch broker, parsers, charts: not present
- Hosted service: not present

## Commands

```text
npm install
npm test
npm run lint
npm run lint:fix
npm run demo
node apps/cli/dist/main.js doctor
node scripts/harness/runner.mjs --root . context
```

`npm run demo` prints a fixture-backed evidence packet (AAPL revenue). Live SEC requests need `SEC_USER_AGENT` and still go through the allowlisted broker only.

MCP stdio: `node apps/mcp/dist/server.js`

`npm test` is the full gate: typecheck, ESLint, harness tests, domain tests, and harness validate. Husky runs that gate on every commit and every push.

Node.js 24 or newer is required.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
