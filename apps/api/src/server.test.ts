import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createApiServer } from "./server.js";

describe("http api", () => {
  it("serves health and company resolve on the same engine as MCP", async () => {
    const server = createApiServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.equal(typeof address, "object");
    const port = (address as { port: number }).port;
    const health = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal((await health.json() as { ok: boolean }).ok, true);
    const companies = await fetch(`http://127.0.0.1:${port}/v1/companies?q=AAPL`);
    const body = await companies.json() as { data: { cik?: string } };
    assert.equal(body.data.cik, "0000320193");
    server.close();
  });
});
