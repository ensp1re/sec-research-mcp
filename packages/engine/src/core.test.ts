import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { companyFactsUrl, filingDocumentUrl, submissionsUrl, tickerMapUrl } from "./edgar.js";
import { parseSubmissions, searchFilings } from "./filings.js";
import { compareParagraphs } from "./filing-compare.js";
import { compareSeries } from "./compare.js";
import { ENTITY_KIND } from "@sec-research/domain";
import { extractSeries, parseCompanyFactsJson } from "./financials.js";
import { runCompare, runFilingsSearch, runFinancials, runResolve, type Runtime } from "./workflow.js";

const fixtureDir = fileURLToPath(new URL("../../../fixtures/demo", import.meta.url));

function entity(cik: string, ticker: string) {
  return {
    id: `entity_${cik}`,
    cik,
    kind: ENTITY_KIND.REGISTRANT,
    names: [{ value: ticker, kind: "legal" as const, validFrom: null, validTo: null }],
    identifiers: [],
    seriesId: null,
    classId: null,
    parentEntityId: null,
  };
}

describe("core research paths", () => {
  it("builds allowlisted EDGAR URLs", () => {
    assert.equal(tickerMapUrl(), "https://www.sec.gov/files/company_tickers.json");
    assert.equal(companyFactsUrl("320193"), "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json");
    assert.equal(submissionsUrl("0000320193"), "https://data.sec.gov/submissions/CIK0000320193.json");
    assert.equal(
      filingDocumentUrl("0000320193", "0000320193-24-000123", "aapl-20240928.htm"),
      "https://www.sec.gov/Archives/edgar/data/320193/000032019324000123/aapl-20240928.htm",
    );
  });

  it("searches submissions by form and date", async () => {
    const payload = JSON.parse(await readFile(path.join(fixtureDir, "submissions-0000320193.json"), "utf8"));
    const rows = parseSubmissions(payload, "0000320193");
    const tens = searchFilings(rows, { forms: ["10-K"] });
    assert.equal(tens.length, 1);
    assert.equal(tens[0]?.accession, "0000320193-24-000123");
  });

  it("marks added and removed paragraphs", () => {
    const changes = compareParagraphs("Risk one.\n\nKeep me.", "Keep me.\n\nRisk two.");
    assert.equal(changes.some((row) => row.kind === "removed" && row.text.includes("Risk one")), true);
    assert.equal(changes.some((row) => row.kind === "added" && row.text.includes("Risk two")), true);
  });

  it("compares companies without filling gaps with zero", () => {
    const appleFacts = parseCompanyFactsJson(
      JSON.stringify({ facts: { "us-gaap": { Revenues: { units: { USD: [{ val: "1", end: "2024-09-28", fp: "FY" }] } } } } }),
    );
    const msftFacts = parseCompanyFactsJson(
      JSON.stringify({ facts: { "us-gaap": { Revenues: { units: { USD: [{ val: "2", end: "2024-06-30", fp: "FY" }] } } } } }),
    );
    const table = compareSeries(
      [entity("0000320193", "AAPL"), entity("0000789019", "MSFT")],
      [extractSeries(appleFacts, "0000320193", "revenue"), extractSeries(msftFacts, "0000789019", "revenue")],
    );
    const missing = table.cells.filter((cell) => cell.value === null);
    assert.equal(missing.length >= 2, true);
    assert.equal(missing.every((cell) => cell.value !== "0"), true);
  });

  it("wires live URLs through a mock fetch, not the fixture-only path", async () => {
    const tickers = await readFile(path.join(fixtureDir, "tickers.json"), "utf8");
    const facts = await readFile(path.join(fixtureDir, "companyfacts-aapl.json"), "utf8");
    const subs = await readFile(path.join(fixtureDir, "submissions-0000320193.json"), "utf8");
    const seen: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      seen.push(url);
      if (url.includes("company_tickers")) return new Response(tickers);
      if (url.includes("companyfacts")) return new Response(facts);
      if (url.includes("submissions")) return new Response(subs);
      return new Response("missing", { status: 404 });
    };
    const runtime: Runtime = {
      fixtureDir,
      cacheDir: await mkdtemp(path.join(os.tmpdir(), "sec-cache-")),
      userAgent: "sec-research-tests tests@example.com",
      fetchImpl,
    };
    const resolved = await runResolve(runtime, "AAPL");
    assert.equal((resolved.data as { cik?: string }).cik, "0000320193");
    const financials = await runFinancials(runtime, "AAPL", "revenue");
    const points = (financials.data as { points: { value: string }[] }).points;
    assert.equal(points.some((row) => row.value === "394328000000"), true);
    const filings = await runFilingsSearch(runtime, "AAPL", ["10-K"]);
    assert.equal((filings.data as { filings: unknown[] }).filings.length, 1);
    const compare = await runCompare(runtime, ["AAPL"], "revenue");
    assert.equal((compare.data as { dataset_id?: string }).dataset_id?.startsWith("ds_"), true);
    assert.equal(seen.some((url) => url.startsWith("https://www.sec.gov/") || url.startsWith("https://data.sec.gov/")), true);
  });
});
