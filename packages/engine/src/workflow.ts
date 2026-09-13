import { readFile } from "node:fs/promises";
import path from "node:path";
import { COVERAGE_STATUS, LOCATOR_KIND } from "@sec-research/domain";
import { SecBroker } from "./broker.js";
import { renderLineChart } from "./charts.js";
import { htmlToText } from "./documents.js";
import { envelope } from "./envelope.js";
import { coverageFor, extractSeries, parseCompanyFactsJson } from "./financials.js";
import { evidencePacket } from "./research.js";
import { loadTickerMap, padCik, resolveCompany } from "./resolve.js";
import { ObjectStore } from "./store.js";

export interface Runtime {
  fixtureDir: string;
  cacheDir: string;
  userAgent: string | null;
  mode: "demo" | "live";
}

export async function runResolve(runtime: Runtime, query: string) {
  const rows = loadTickerMap(JSON.parse(await readFile(path.join(runtime.fixtureDir, "tickers.json"), "utf8")));
  try {
    const entity = resolveCompany(query, rows);
    return envelope({ requestId: "resolve", data: entity, coverage: { ...emptyCoverage("resolve"), status: COVERAGE_STATUS.COMPLETE_WITHIN_SCOPE } });
  } catch (error) {
    const candidates = (error as { candidates?: unknown }).candidates;
    return envelope({
      requestId: "resolve",
      data: { error: (error as Error).message, candidates: candidates ?? [] },
      coverage: { ...emptyCoverage("resolve"), status: COVERAGE_STATUS.INCOMPLETE },
    });
  }
}

export async function runFinancials(runtime: Runtime, query: string, metricId: string) {
  const resolved = await runResolve(runtime, query);
  const entity = (resolved.data as { cik?: string }).cik ? (resolved.data as ReturnType<typeof resolveCompany> extends infer T ? T : never) : null;
  if (!entity || typeof entity !== "object" || !("cik" in entity)) return resolved;
  const raw = await readFile(path.join(runtime.fixtureDir, "companyfacts-aapl.json"), "utf8");
  const points = extractSeries(parseCompanyFactsJson(raw), entity.cik ?? padCik(0), metricId);
  return envelope({
    requestId: "financials",
    data: { entity, metricId, points, row_count: points.length, row_count_kind: "exact" },
    sources: points
      .filter((point) => point.sourceAccession)
      .map((point) => ({
        sourceId: point.sourceAccession ?? "fixture",
        locatorKind: LOCATOR_KIND.XBRL_CONTEXT,
        locator: `${metricId}:${point.periodEnd}`,
        accession: point.sourceAccession,
        documentId: null,
        contentHash: "fixture",
        parserVersion: "0.0.0",
      })),
    coverage: coverageFor(points, `${entity.cik}:${metricId}`),
  });
}

export async function runChart(runtime: Runtime, query: string, metricId: string) {
  const financials = await runFinancials(runtime, query, metricId);
  const points = (financials.data as { points?: Parameters<typeof renderLineChart>[1] }).points ?? [];
  const chart = renderLineChart(`${query} ${metricId}`, points);
  return envelope({
    requestId: "chart",
    data: { formats: ["svg", "png", "csv", "vega_lite"], description: chart.description, svg: chart.svg, csv: chart.csv, vegaLite: chart.vegaLite, pngBase64: chart.png.toString("base64") },
    coverage: financials.coverage,
    sources: financials.sources,
  });
}

export async function runFilingRead(runtime: Runtime) {
  const html = await readFile(path.join(runtime.fixtureDir, "filing.html"), "utf8");
  const text = htmlToText(html);
  return envelope({
    requestId: "filing",
    data: { text, sample: true, heading: "Item 1A. Risk Factors" },
    coverage: { ...emptyCoverage("filing"), status: COVERAGE_STATUS.COMPLETE_WITHIN_SCOPE },
  });
}

export async function runResearch(runtime: Runtime, query: string, metricId: string) {
  const financials = await runFinancials(runtime, query, metricId);
  const data = financials.data as { entity?: Parameters<typeof evidencePacket>[0]["entity"]; points?: Parameters<typeof evidencePacket>[0]["points"] };
  if (!data.entity || !data.points) return financials;
  const packet = evidencePacket({ question: `How did ${query} ${metricId} change?`, entity: data.entity, metricId, points: data.points });
  return envelope({ requestId: "research", data: packet, coverage: packet.coverage, sources: financials.sources });
}

export function emptyCoverage(scope: string) {
  return {
    status: COVERAGE_STATUS.UNKNOWN,
    scope,
    sourceBounds: null,
    scannedCount: null,
    indexedCount: null,
    exclusions: [] as string[],
    failures: [] as string[],
    watermark: null,
    lastCheckedAt: null,
    latestSourceAvailableAt: null,
  };
}

export async function liveFetch(runtime: Runtime, url: string) {
  if (!runtime.userAgent) throw new Error("SEC_USER_AGENT required for live mode");
  const broker = new SecBroker({ userAgent: runtime.userAgent });
  const store = new ObjectStore(runtime.cacheDir);
  const { body } = await broker.getText(url);
  return store.put(Buffer.from(body), "application/json");
}
