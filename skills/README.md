# Agent skills

Portable Agent Skills for this MCP. Each folder is one skill: `SKILL.md` plus optional `references/`. Compatible with Claude Code, Cursor, Codex, Copilot, Gemini CLI, and any client that loads the Agent Skills spec.

Install by copying or linking a skill directory into the client's skills path, or point the client at this repo.

| Skill | When to load |
| --- | --- |
| [sec-research](sec-research/SKILL.md) | Use the SEC Research MCP tools for one company, one filing, or one chart |
| [sec-research-orchestrate](sec-research-orchestrate/SKILL.md) | Split research across several agents (resolve, numbers, filings, charts, critic) |

Do not invent SEC numbers. Tools return decimal strings and explicit missingness. Read `references/` only when the SKILL.md says to.
