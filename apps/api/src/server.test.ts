import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MemoryMetadataStore } from "@sec-research/engine";
import { createApiServer } from "./server.js";

async function listen(server: ReturnType<typeof createApiServer>): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.equal(typeof address, "object");
  return (address as { port: number }).port;
}

describe("http api", () => {
  it("serves health and company resolve on the same engine as MCP", async () => {
    const server = createApiServer({ demo: true });
    const port = await listen(server);
    const health = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal((await health.json() as { ok: boolean }).ok, true);
    const companies = await fetch(`http://127.0.0.1:${port}/v1/companies?q=AAPL`);
    const body = await companies.json() as { data: { cik?: string } };
    assert.equal(body.data.cik, "0000320193");
    const holdings = await fetch(`http://127.0.0.1:${port}/v1/holdings?q=AAPL`);
    const held = await holdings.json() as { data: { holdings: { shares: string | null }[] } };
    assert.equal(held.data.holdings[0]?.shares, "1000");
    assert.equal(held.data.holdings[1]?.shares, null);
    server.close();
  });

  it("authenticates scoped API keys and isolates watches by workspace", async () => {
    const metadata = new MemoryMetadataStore();
    const ownerScopes = ["data:read", "analysis:run", "artifacts:write", "research:write", "watches:write"] as const;
    metadata.seed({
      id: "owner",
      workspaceId: "ws_a",
      role: "owner",
      scopes: [...ownerScopes],
      apiKey: "key_owner",
    });
    metadata.seed({
      id: "viewer",
      workspaceId: "ws_a",
      role: "viewer",
      scopes: ["data:read"],
      apiKey: "key_viewer",
    });
    metadata.seed({
      id: "other",
      workspaceId: "ws_b",
      role: "owner",
      scopes: [...ownerScopes],
      apiKey: "key_b",
    });
    await metadata.setQuota("ws_a", 10);
    const server = createApiServer({ demo: true, metadata });
    const port = await listen(server);
    const denied = await fetch(`http://127.0.0.1:${port}/v1/watches`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer key_viewer" },
      body: JSON.stringify({ query: "AAPL" }),
    });
    assert.equal(denied.status, 403);
    const created = await fetch(`http://127.0.0.1:${port}/v1/watches`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer key_owner" },
      body: JSON.stringify({ query: "AAPL" }),
    });
    assert.equal(created.status, 200);
    const watch = await created.json() as { data: { id: string; workspaceId: string } };
    assert.equal(watch.data.workspaceId, "ws_a");
    const otherList = await fetch(`http://127.0.0.1:${port}/v1/watches`, {
      headers: { authorization: "Bearer key_b" },
    });
    const otherBody = await otherList.json() as { data: { watches: unknown[] } };
    assert.equal(otherBody.data.watches.length, 0);
    const who = await fetch(`http://127.0.0.1:${port}/v1/whoami`, { headers: { authorization: "Bearer key_owner" } });
    assert.equal((await who.json() as { workspaceId: string }).workspaceId, "ws_a");
    const jobs = await fetch(`http://127.0.0.1:${port}/v1/jobs`, { headers: { authorization: "Bearer key_owner" } });
    const jobBody = await jobs.json() as { jobs: { kind: string }[] };
    assert.equal(jobBody.jobs.some((job) => job.kind === "watch_create"), true);
    const anon = await fetch(`http://127.0.0.1:${port}/v1/whoami`);
    assert.equal(anon.status, 401);
    server.close();
  });
});
