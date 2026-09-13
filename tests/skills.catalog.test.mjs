import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

function parseFrontmatter(text) {
  assert.equal(text.startsWith("---\n"), true);
  const end = text.indexOf("\n---\n", 4);
  assert.equal(end > 0, true);
  const block = text.slice(4, end);
  const name = block.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = /description:\s*>\s*\n([\s\S]+)/.exec(block)?.[1]
    ?? block.match(/^description:\s*(.+)$/m)?.[1];
  return { name, description: description?.trim() };
}

describe("skills catalog", () => {
  it("ships SKILL.md packs whose names match folders", async () => {
    const skillsDir = path.join(root, "skills");
    const names = (await readdir(skillsDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    assert.deepEqual(names, ["sec-research", "sec-research-orchestrate"]);
    for (const name of names) {
      const text = await readFile(path.join(skillsDir, name, "SKILL.md"), "utf8");
      const meta = parseFrontmatter(text);
      assert.equal(meta.name, name);
      assert.equal(Boolean(meta.description && meta.description.length > 20), true);
    }
  });

  it("documents every MCP tool registered in the shipped server", async () => {
    const server = await readFile(path.join(root, "apps/mcp/src/server.ts"), "utf8");
    const tools = [...server.matchAll(/registerTool\(\s*"([^"]+)"/g)].map((match) => match[1]);
    assert.equal(tools.length > 0, true);
    const catalog = await readFile(path.join(root, "skills/sec-research/references/tools.md"), "utf8");
    const skill = await readFile(path.join(root, "skills/sec-research/SKILL.md"), "utf8");
    for (const tool of tools) {
      assert.equal(catalog.includes(tool), true, `tools.md missing ${tool}`);
      assert.equal(skill.includes(tool), true, `SKILL.md missing ${tool}`);
    }
  });

  it("keeps orchestrate roles aligned with MCP tools", async () => {
    const roles = await readFile(path.join(root, "skills/sec-research-orchestrate/references/roles.md"), "utf8");
    for (const tool of ["sec_company_resolve", "sec_financials_get", "sec_filing_read", "sec_chart_create"]) {
      assert.equal(roles.includes(tool), true, `roles.md missing ${tool}`);
    }
  });
});
