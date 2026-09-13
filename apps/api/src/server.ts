import { createServer } from "node:http";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  runChart,
  runCompare,
  runConceptsSearch,
  runCoverage,
  runDoctor,
  runFilingRead,
  runFilingsSearch,
  runResearch,
  runResolve,
  type Runtime,
} from "@sec-research/engine";

const root = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));

function runtime(): Runtime {
  return {
    fixtureDir: path.join(root, "fixtures/demo"),
    cacheDir: path.join(root, ".cache/objects"),
    userAgent: process.env.SEC_USER_AGENT ?? null,
  };
}

async function readJson(req: import("node:http").IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

export function createApiServer() {
  return createServer(async (req, res) => {
    try {
      await mkdir(runtime().cacheDir, { recursive: true });
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const method = req.method ?? "GET";
      let body: unknown;
      if (method === "GET" && url.pathname === "/health") body = { ok: true };
      else if (method === "GET" && url.pathname === "/v1/coverage") body = await runCoverage(runtime());
      else if (method === "GET" && url.pathname === "/v1/companies") body = await runResolve(runtime(), url.searchParams.get("q") ?? "");
      else if (method === "GET" && url.pathname === "/v1/filings") {
        body = await runFilingsSearch(runtime(), url.searchParams.get("q") ?? "", url.searchParams.get("form") ? [url.searchParams.get("form")!] : undefined);
      } else if (method === "POST" && url.pathname === "/v1/charts") {
        const json = await readJson(req);
        body = await runChart(runtime(), String(json.query ?? "AAPL"), String(json.metric ?? "revenue"));
      } else if (method === "POST" && url.pathname === "/v1/research-runs") {
        const json = await readJson(req);
        body = await runResearch(runtime(), String(json.query ?? "AAPL"), String(json.metric ?? "revenue"));
      } else if (method === "POST" && url.pathname === "/v1/queries") {
        const json = await readJson(req);
        body = await runCompare(runtime(), (json.queries as string[]) ?? ["AAPL"], String(json.metric ?? "revenue"));
      } else if (method === "GET" && url.pathname === "/v1/concepts") {
        body = await runConceptsSearch(url.searchParams.get("q") ?? "");
      } else if (method === "GET" && url.pathname.startsWith("/v1/filings/") && url.pathname.endsWith("/text")) {
        body = await runFilingRead(runtime(), url.searchParams.get("q") ?? "AAPL", url.searchParams.get("accession") ?? undefined, url.searchParams.get("section") ?? undefined);
      } else if (method === "GET" && url.pathname === "/v1/doctor") body = await runDoctor(runtime());
      else {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "not_found" }));
        return;
      }
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(body));
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: (error as Error).message }));
    }
  });
}

if (process.argv[1] && process.argv[1].endsWith("server.js")) {
  const port = Number(process.env.PORT ?? 8787);
  createApiServer().listen(port, "127.0.0.1", () => {
    process.stderr.write(`api listening on 127.0.0.1:${port}\n`);
  });
}
