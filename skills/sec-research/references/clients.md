# Client configs

Replace `<repo-root>` with an absolute path. Build first: `npm run build`.

## Generic MCP

```json
{
  "mcpServers": {
    "sec-research": {
      "command": "node",
      "args": ["apps/mcp/dist/server.js"],
      "cwd": "<repo-root>"
    }
  }
}
```

Optional live env:

```json
"env": { "SEC_USER_AGENT": "YourName your@email.example" }
```

## Notes

- Stdio: keep logs on stderr. Do not print JSON logs to stdout.
- The server does not take an arbitrary fetch URL. Entity queries go through tools.
- Several MCP clients in one process still share one broker if they share `cwd` cache; do not multiply SEC rate limits by spawning extra live servers without a shared broker.
