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
  runHoldings,
  runResearch,
  runResolve,
  runRulemaking,
  runWatchCreate,
  runWatchEvaluate,
  runWatchList,
  type Runtime,
  type MetadataStore,
  authorize,
  assertStoreOwned,
  assertStoreQuota,
  defaultMemoryStore,
  WorkspaceError,
  listWatches,
} from "@sec-research/engine";

const root = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));

function defaultRuntime(): Runtime {
  return {
    fixtureDir: path.join(root, "fixtures/demo"),
    cacheDir: path.join(root, ".cache/objects"),
    userAgent: process.env.SEC_USER_AGENT ?? null,
    demo: process.env.SEC_DEMO === "1",
  };
}

async function readJson(req: import("node:http").IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

function apiKeyFrom(req: import("node:http").IncomingMessage): string | null {
  const header = req.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) return header.slice(7);
  const key = req.headers["x-api-key"];
  return typeof key === "string" ? key : null;
}

export interface ApiServerOptions extends Partial<Runtime> {
  metadata?: MetadataStore | undefined;
}

export function createApiServer(overrides: ApiServerOptions = {}) {
  const { metadata: seeded, ...runtimeOverrides } = overrides;
  const metadata = seeded ?? defaultMemoryStore();
  const runtime = (): Runtime => ({ ...defaultRuntime(), ...runtimeOverrides });
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
      } else if (method === "GET" && url.pathname === "/v1/holdings") body = await runHoldings(runtime(), url.searchParams.get("q") ?? "AAPL");
      else if (method === "GET" && url.pathname === "/v1/rulemaking") body = await runRulemaking(runtime());
      else if (method === "GET" && url.pathname === "/v1/whoami") {
        const principal = requirePrincipal(req, metadata);
        body = { id: principal.id, workspaceId: principal.workspaceId, role: principal.role, scopes: principal.scopes };
      } else if (method === "GET" && url.pathname === "/v1/jobs") {
        const principal = requirePrincipal(req, metadata);
        authorize(principal, "data:read", principal.workspaceId);
        body = { jobs: await metadata.listJobs(principal.workspaceId) };
      } else if (method === "POST" && url.pathname === "/v1/watches") {
        const principal = requirePrincipal(req, metadata);
        authorize(principal, "watches:write", principal.workspaceId);
        const existing = await listWatches(runtime().cacheDir, principal.workspaceId);
        await assertStoreQuota(metadata, principal.workspaceId, existing.length);
        const json = await readJson(req);
        const created = await runWatchCreate(runtime(), {
          workspaceId: principal.workspaceId,
          query: String(json.query ?? "AAPL"),
        });
        const watch = created.data as { id: string };
        await metadata.setWatchOwner(watch.id, principal.workspaceId);
        await metadata.upsertJob({
          id: `job_${watch.id}`,
          workspaceId: principal.workspaceId,
          state: "succeeded",
          kind: "watch_create",
        });
        body = created;
      } else if (method === "GET" && url.pathname === "/v1/watches") {
        const principal = requirePrincipal(req, metadata);
        authorize(principal, "data:read", principal.workspaceId);
        body = await runWatchList(runtime(), principal.workspaceId);
      } else if (method === "POST" && url.pathname.endsWith("/evaluate")) {
        const principal = requirePrincipal(req, metadata);
        authorize(principal, "watches:write", principal.workspaceId);
        const json = await readJson(req);
        const watchId = url.pathname.split("/")[3] ?? "";
        await assertStoreOwned((id) => metadata.watchOwner(id), watchId, principal.workspaceId);
        body = await runWatchEvaluate(runtime(), watchId, String(json.query ?? "AAPL"), principal.workspaceId);
        await metadata.upsertJob({
          id: `job_eval_${watchId}`,
          workspaceId: principal.workspaceId,
          state: "succeeded",
          kind: "watch_evaluate",
        });
      } else if (method === "GET" && url.pathname === "/v1/doctor") body = await runDoctor(runtime());
      else {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "not_found" }));
        return;
      }
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(body));
    } catch (error) {
      const code = error instanceof WorkspaceError ? error.code : (error as Error).message.startsWith("permission_denied")
        ? "permission_denied"
        : "error";
      res.statusCode = code === "permission_denied" ? ((error as Error).message.includes("bad key") ? 401 : 403) : code === "budget_exceeded" ? 403 : 500;
      res.end(JSON.stringify({ error: (error as Error).message, code }));
    }
  });
}

function requirePrincipal(req: import("node:http").IncomingMessage, metadata: MetadataStore) {
  const key = apiKeyFrom(req);
  if (!key) throw new WorkspaceError("permission_denied: bad key", "permission_denied");
  return metadata.authenticate(key);
}

if (process.argv[1] && process.argv[1].endsWith("server.js")) {
  const port = Number(process.env.PORT ?? 8787);
  createApiServer().listen(port, "127.0.0.1", () => {
    process.stderr.write(`api listening on 127.0.0.1:${port}\n`);
  });
}
