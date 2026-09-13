import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { MISSINGNESS } from "@sec-research/domain";
import { SecBroker } from "./broker.js";
import { renderLineChart } from "./charts.js";
import { htmlToText } from "./documents.js";
import { coverageFor, extractSeries, parseCompanyFactsJson } from "./financials.js";
import { assertSafeSql, queryFacts } from "./query.js";
import { loadTickerMap, resolveCompany } from "./resolve.js";
import { ObjectStore } from "./store.js";

const facts = {
  cik: "0000320193",
  facts: {
    "us-gaap": {
      Revenues: {
        units: {
          USD: [
            { val: "394328000000", start: "2023-10-01", end: "2024-09-28", fp: "FY", accn: "0000320193-24-000123", filed: "2024-11-01" },
            { val: "383285000000", start: "2022-10-02", end: "2023-09-30", fp: "FY", accn: "0000320193-23-000106", filed: "2023-11-03" },
          ],
        },
      },
      GrossProfit: {
        units: {
          USD: [
            { val: "180683000000", start: "2023-10-01", end: "2024-09-28", fp: "FY", accn: "0000320193-24-000123", filed: "2024-11-01" },
          ],
        },
      },
    },
  },
};

describe("engine", () => {
  it("resolves tickers and reports ambiguity", () => {
    const rows = loadTickerMap({
      "0": { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." },
      "1": { cik_str: 789019, ticker: "MSFT", title: "MICROSOFT CORP" },
      "2": { cik_str: 1018724, ticker: "AMZN", title: "AMAZON COM INC" },
    });
    const apple = resolveCompany("AAPL", rows);
    assert.equal("cik" in apple, true);
    if ("cik" in apple) assert.equal(apple.cik, "0000320193");
    assert.throws(() => resolveCompany("INC", rows), /entity_ambiguous/);
    assert.throws(() => resolveCompany("NOPE", rows), /not found/);
  });

  it("keeps decimal lexemes and never turns missing into zero", () => {
    const parsed = parseCompanyFactsJson(JSON.stringify(facts));
    const revenue = extractSeries(parsed, "0000320193", "revenue");
    assert.equal(revenue[1]?.value, "394328000000");
    const cash = extractSeries(parsed, "0000320193", "cash");
    assert.equal(cash[0]?.value, null);
    assert.equal(cash[0]?.missingness, MISSINGNESS.MISSING);
    assert.equal(cash[0]?.value === "0", false);
    const margin = extractSeries(parsed, "0000320193", "gross_margin");
    assert.equal(margin.at(-1)?.derivation, "derived");
    assert.equal(margin.at(-1)?.value?.startsWith("0.4582"), true);
    const coverage = coverageFor(cash, "cash");
    assert.equal(coverage.status, "incomplete");
  });

  it("refuses off-allowlist fetches and stores hashes", async () => {
    const broker = new SecBroker({
      userAgent: "sec-research-mcp test@example.com",
      minIntervalMs: 0,
      fetchImpl: async () => new Response("nope", { status: 200 }),
    });
    await assert.rejects(() => broker.getText("https://example.com/x"), /allowlisted/);
    const dir = await mkdtemp(path.join(os.tmpdir(), "obj-"));
    const store = new ObjectStore(dir);
    const saved = await store.put(Buffer.from("abc"), "text/plain");
    assert.equal(saved.byteSize, 3);
    assert.equal((await store.get(saved.hash)).toString(), "abc");
  });

  it("extracts text, renders charts, and rejects unsafe SQL", () => {
    const text = htmlToText("<html><body><h1>Item 1A</h1><p>Risk one.</p></body></html>");
    assert.match(text, /Risk one/);
    const points = extractSeries(parseCompanyFactsJson(JSON.stringify(facts)), "0000320193", "revenue");
    const chart = renderLineChart("Revenue", points);
    assert.match(chart.svg, /polyline/);
    assert.equal(chart.png[0], 0x89);
    assert.equal(queryFacts(points, { limit: 1 }).length, 1);
    assert.throws(() => assertSafeSql("DROP TABLE x"), /unsafe_query|invalid_sql/);
    assert.throws(() => assertSafeSql("select 1; select 2"), /unsafe_query|invalid_sql/);
  });

  it("parses JSON numbers without inventing zeros", () => {
    const raw = '{"facts":{"us-gaap":{"NetIncomeLoss":{"units":{"USD":[{"val":93736000000,"end":"2024-09-28","fp":"FY"}]}}}}}';
    const parsed = parseCompanyFactsJson(raw);
    const series = extractSeries(parsed, "0000320193", "net_income");
    assert.equal(series[0]?.value, "93736000000");
  });
});
