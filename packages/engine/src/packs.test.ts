import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { AUTH_SCOPE, WORKSPACE_ROLE } from "@sec-research/domain";
import { saveDataset } from "./datasets.js";
import { parse13F, thirteenFAccessions } from "./holdings.js";
import { runIsolatedQuery } from "./isolated-query.js";
import { parseRulemaking } from "./rulemaking.js";
import { resolveUserAgent } from "./user-agent.js";
import { createWatch, evaluateWatch, listWatchEvents, loadWatchStore } from "./watches.js";
import {
  assertOwned,
  assertQuota,
  authenticate,
  authorize,
  emptyWorkspaceState,
  MemoryMetadataStore,
  PostgresMetadataStore,
  SqliteMetadataStore,
  postgresUpsertJob,
} from "./workspace.js";
import { runHoldings, runResolve, runRulemaking, type Runtime } from "./workflow.js";

const fixtureDir = fileURLToPath(new URL("../../../fixtures/demo", import.meta.url));

describe("remaining plan packs", () => {
  it("runs SELECT in a child worker and denies mutating SQL", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ds-"));
    const record = await saveDataset(dir, "revenue", [
      {
        entityCik: "0000320193",
        metricId: "revenue",
        value: "1",
        missingness: null,
        unit: "USD",
        periodStart: null,
        periodEnd: "2024-09-28",
        periodKind: "annual",
        derivation: "reported",
        sourceAccession: "a",
        filedAt: null,
      },
    ]);
    const file = path.join(dir, "datasets", `${record.datasetId}.json`);
    const rows = await runIsolatedQuery(file, "SELECT * FROM dataset WHERE metric_id = 'revenue' LIMIT 10");
    assert.equal(rows[0]?.value, "1");
    await assert.rejects(() => runIsolatedQuery(file, "INSERT INTO dataset VALUES (1)"), /unsafe_query|invalid_sql/);
    await assert.rejects(() => runIsolatedQuery(file, "DELETE FROM dataset"), /unsafe_query|invalid_sql/);
    await assert.rejects(() => runIsolatedQuery(file, "ATTACH 'x'"), /unsafe_query|invalid_sql/);
    await assert.rejects(() => runIsolatedQuery(file, "PRAGMA table_info(dataset)"), /unsafe_query|invalid_sql/);
  });

  it("does not emit a second watch event after store reload", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "watch-"));
    const watch = await createWatch(dir, { workspaceId: "ws_a", query: "AAPL", forms: ["10-K"] });
    const filings = [{ accession: "0000320193-24-000123", form: "10-K" }];
    const first = await evaluateWatch(dir, watch.id, filings, "ws_a");
    const disk = await loadWatchStore(dir);
    assert.equal(disk.events.length, 1);
    const second = await evaluateWatch(dir, watch.id, filings, "ws_a");
    const all = await listWatchEvents(dir, watch.id);
    assert.equal(first.length, 1);
    assert.equal(second.length, 0);
    assert.equal(all.length, 1);
    assert.equal(all[0]?.deduplicationKey, `${watch.id}:0000320193-24-000123`);
    await assert.rejects(() => evaluateWatch(dir, watch.id, filings, "ws_b"), /permission_denied|cross-workspace/);
  });

  it("parses 13F and rulemaking with sourced rows and null missingness, never zero", () => {
    const holdings = parse13F(
      { holdings: [{ issuer: "X", cusip: "1", shares: "10", value: "20" }, { issuer: "Y", shares: null, value: null }] },
      "https://data.sec.gov/submissions/CIK0000320193.json",
    );
    assert.equal(holdings[0]?.shares, "10");
    assert.equal(holdings[1]?.shares, null);
    assert.equal(holdings[1]?.value, null);
    assert.equal(holdings[1]?.missingness, "missing");
    assert.equal(holdings[1]?.shares === "0", false);
    assert.equal(holdings[1]?.value === "0", false);
    const rules = parseRulemaking(
      { documents: [{ title: "Proposal", identifier: "S7-1", status: "proposed" }] },
      "https://www.sec.gov/rules-regulations",
    );
    assert.equal(rules[0]?.title, "Proposal");
    assert.equal(rules[0]?.sourceUrl.includes("sec.gov"), true);
    const accessions = thirteenFAccessions({
      filings: { recent: { form: ["13F-HR", "10-K"], accessionNumber: ["0001", "0002"] } },
    });
    assert.deepEqual(accessions, ["0001"]);
  });

  it("runs 13F and rulemaking through mock allowlisted SEC URLs", async () => {
    const tickers = await readFile(path.join(fixtureDir, "tickers.json"), "utf8");
    const holdings = await readFile(path.join(fixtureDir, "13f-0000320193.json"), "utf8");
    const rules = await readFile(path.join(fixtureDir, "rulemaking.json"), "utf8");
    const seen: { url: string; ua: string }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      seen.push({ url, ua: headers.get("user-agent") ?? "" });
      if (url.includes("company_tickers")) return new Response(tickers);
      if (url.includes("submissions")) return new Response(holdings);
      if (url.includes("rules-regulations")) return new Response(rules);
      return new Response("missing", { status: 404 });
    };
    const runtime: Runtime = {
      fixtureDir,
      cacheDir: await mkdtemp(path.join(os.tmpdir(), "pack-live-")),
      userAgent: null,
      fetchImpl,
    };
    const got = await runHoldings(runtime, "AAPL");
    const rows = (got.data as { holdings: { shares: string | null; missingness: string | null }[] }).holdings;
    assert.equal(rows[0]?.shares, "1000");
    assert.equal(rows[1]?.shares, null);
    assert.equal(rows[1]?.missingness, "missing");
    assert.equal(got.coverage.status, "complete_within_scope");
    assert.equal(got.sources.length > 0, true);
    const rule = await runRulemaking(runtime);
    assert.equal((rule.data as { documents: { title: string }[] }).documents[0]?.title, "Sample proposal");
    assert.equal(seen.some((item) => item.url.startsWith("https://data.sec.gov/submissions/")), true);
    assert.equal(seen.some((item) => item.url === "https://www.sec.gov/rules-regulations"), true);
    assert.equal(seen.every((item) => item.ua.startsWith("sec-research-mcp/")), true);
  });

  it("enforces workspace roles, isolation, quotas, sqlite jobs, and postgres upsert SQL", async () => {
    const state = emptyWorkspaceState();
    state.principals.push({
      id: "u1",
      workspaceId: "ws_a",
      role: WORKSPACE_ROLE.VIEWER,
      scopes: [AUTH_SCOPE.DATA_READ],
      apiKey: "key_a",
    });
    state.datasetOwners.ds1 = "ws_a";
    state.quotas.ws_a = 1;
    const viewer = authenticate(state, "key_a");
    assert.throws(() => authorize(viewer, AUTH_SCOPE.WATCHES_WRITE, "ws_a"), /permission_denied/);
    assert.throws(() => assertOwned(state.datasetOwners, "ds1", "ws_b"), /cross-workspace/);
    assert.throws(() => assertQuota(state, "ws_a", 1), /budget_exceeded/);

    const sql = postgresUpsertJob({ id: "job1", workspaceId: "ws_a", state: "queued", kind: "query" });
    assert.match(sql, /INSERT INTO jobs/);
    assert.match(sql, /ON CONFLICT/);
    assert.match(sql, /\$1/);

    const calls: { sql: string; params: unknown[] }[] = [];
    const jobs = new Map<string, Record<string, unknown>>();
    const postgres = new PostgresMetadataStore(async (statement, params) => {
      calls.push({ sql: statement, params });
      if (statement.startsWith("INSERT INTO jobs")) {
        jobs.set(String(params[0]), {
          id: params[0],
          workspace_id: params[1],
          state: params[2],
          kind: params[3],
        });
        return { rows: [] };
      }
      if (statement.includes("FROM jobs WHERE id")) {
        const row = jobs.get(String(params[0]));
        return { rows: row ? [row] : [] };
      }
      return { rows: [] };
    });
    await postgres.upsertJob({ id: "job1", workspaceId: "ws_a", state: "queued", kind: "query" });
    const stored = await postgres.getJob("job1");
    assert.equal(stored?.workspaceId, "ws_a");
    assert.match(calls[0]?.sql ?? "", /\$1/);

    const dir = await mkdtemp(path.join(os.tmpdir(), "meta-"));
    const sqlite = new SqliteMetadataStore(path.join(dir, "meta.sqlite"));
    sqlite.seed({
      id: "u2",
      workspaceId: "ws_a",
      role: WORKSPACE_ROLE.OWNER,
      scopes: [AUTH_SCOPE.DATA_READ, AUTH_SCOPE.WATCHES_WRITE],
      apiKey: "key_sql",
    });
    await sqlite.upsertJob({ id: "job_sql", workspaceId: "ws_a", state: "queued", kind: "query" });
    await sqlite.setDatasetOwner("ds1", "ws_a");
    await sqlite.setQuota("ws_a", 1);
    sqlite.close();
    const reopened = new SqliteMetadataStore(path.join(dir, "meta.sqlite"));
    assert.equal((await reopened.getJob("job_sql"))?.kind, "query");
    assert.equal(await reopened.datasetOwner("ds1"), "ws_a");
    assert.equal(await reopened.getQuota("ws_a"), 1);
    assert.equal(reopened.authenticate("key_sql").workspaceId, "ws_a");
    reopened.close();

    const memory = new MemoryMetadataStore();
    memory.seed({
      id: "u3",
      workspaceId: "ws_b",
      role: WORKSPACE_ROLE.EDITOR,
      scopes: [AUTH_SCOPE.DATA_READ],
      apiKey: "key_b",
    });
    await memory.setWatchOwner("watch_1", "ws_a");
    assert.equal(await memory.watchOwner("watch_1"), "ws_a");
    assert.notEqual(await memory.watchOwner("watch_1"), "ws_b");
  });

  it("generates a User-Agent and still uses live SEC URLs when userAgent is null", async () => {
    const tickers = await readFile(path.join(fixtureDir, "tickers.json"), "utf8");
    const seen: { url: string; ua: string }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const headers = new Headers(init?.headers);
      seen.push({ url: String(input), ua: headers.get("user-agent") ?? "" });
      return new Response(tickers);
    };
    const runtime: Runtime = {
      fixtureDir,
      cacheDir: await mkdtemp(path.join(os.tmpdir(), "ua-")),
      userAgent: null,
      fetchImpl,
    };
    const resolved = await runResolve(runtime, "AAPL");
    assert.equal((resolved.data as { cik?: string }).cik, "0000320193");
    assert.equal(seen.some((item) => item.url.startsWith("https://www.sec.gov") || item.url.startsWith("https://data.sec.gov")), true);
    assert.equal(seen.every((item) => item.ua.startsWith("sec-research-mcp/")), true);
    assert.equal(resolveUserAgent(null).startsWith("sec-research-mcp/"), true);
  });
});
