import { access, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { COVERAGE_STATUS, LOCATOR_KIND, type Entity } from "@sec-research/domain";
import { renderLineChart } from "./charts.js";
import { compareSeries } from "./compare.js";
import { exportCsv, loadDataset, queryDataset, saveDataset } from "./datasets.js";
import { htmlToText, extractSection } from "./documents.js";
import { cachedGet, companyFactsUrl, filingDocumentUrl, makeBroker, submissionsUrl, tickerMapUrl } from "./edgar.js";
import { envelope } from "./envelope.js";
import { coverageFor, extractSeries, parseCompanyFactsJson, type FactPoint } from "./financials.js";
import { compareParagraphs } from "./filing-compare.js";
import { parseSubmissions, searchFilings } from "./filings.js";
import { listMetrics, parseMetricId } from "./metrics.js";
import { deriveQ4IfEligible, preferDiscreteQuarters } from "./periods.js";
import { evidencePacket } from "./research.js";
import { loadTickerMap, resolveCompany } from "./resolve.js";

export interface Runtime {
  fixtureDir: string;
  cacheDir: string;
  userAgent: string | null;
  fetchImpl?: typeof fetch | undefined;
}

export function isLive(runtime: Runtime): boolean {
  return Boolean(runtime.userAgent);
}

async function loadTickers(runtime: Runtime) {
  if (isLive(runtime)) {
    const broker = makeBroker(runtime.userAgent!, runtime.fetchImpl);
    const got = await cachedGet(runtime.cacheDir, broker, tickerMapUrl());
    return loadTickerMap(JSON.parse(got.body));
  }
  return loadTickerMap(JSON.parse(await readFile(path.join(runtime.fixtureDir, "tickers.json"), "utf8")));
}

async function loadFactsText(runtime: Runtime, cik: string): Promise<string> {
  if (isLive(runtime)) {
    const broker = makeBroker(runtime.userAgent!, runtime.fetchImpl);
    return (await cachedGet(runtime.cacheDir, broker, companyFactsUrl(cik))).body;
  }
  const local = path.join(runtime.fixtureDir, `companyfacts-${cik}.json`);
  try {
    return await readFile(local, "utf8");
  } catch {
    if (cik === "0000320193") return readFile(path.join(runtime.fixtureDir, "companyfacts-aapl.json"), "utf8");
    throw Object.assign(new Error(`coverage_incomplete: no facts fixture for ${cik}`), { code: "coverage_incomplete" });
  }
}

async function loadSubmissions(runtime: Runtime, cik: string): Promise<unknown> {
  if (isLive(runtime)) {
    const broker = makeBroker(runtime.userAgent!, runtime.fetchImpl);
    return JSON.parse((await cachedGet(runtime.cacheDir, broker, submissionsUrl(cik))).body);
  }
  const local = path.join(runtime.fixtureDir, `submissions-${cik}.json`);
  return JSON.parse(await readFile(local, "utf8"));
}

export async function runResolve(runtime: Runtime, query: string) {
  const rows = await loadTickers(runtime);
  try {
    const entity = resolveCompany(query, rows);
    return envelope({
      requestId: "resolve",
      data: entity,
      coverage: { ...emptyCoverage("resolve"), status: COVERAGE_STATUS.COMPLETE_WITHIN_SCOPE },
    });
  } catch (error) {
    const candidates = (error as { candidates?: unknown }).candidates;
    return envelope({
      requestId: "resolve",
      data: { error: (error as Error).message, candidates: candidates ?? [] },
      coverage: { ...emptyCoverage("resolve"), status: COVERAGE_STATUS.INCOMPLETE },
    });
  }
}

async function requireEntity(runtime: Runtime, query: string): Promise<Entity | { errorEnvelope: ReturnType<typeof envelope> }> {
  const resolved = await runResolve(runtime, query);
  const data = resolved.data as Entity;
  if (!data || typeof data !== "object" || !("cik" in data) || !data.cik) return { errorEnvelope: resolved };
  return data;
}

function seriesFor(facts: unknown, cik: string, metricId: string): FactPoint[] {
  const raw = extractSeries(facts, cik, metricId);
  return preferDiscreteQuarters(deriveQ4IfEligible(raw, metricId));
}

export async function runFinancials(runtime: Runtime, query: string, metricId: string) {
  parseMetricId(metricId);
  const entityOrErr = await requireEntity(runtime, query);
  if ("errorEnvelope" in entityOrErr) return entityOrErr.errorEnvelope;
  const entity = entityOrErr;
  const text = await loadFactsText(runtime, entity.cik!);
  const points = seriesFor(parseCompanyFactsJson(text), entity.cik!, metricId);
  const dataset = await saveDataset(runtime.cacheDir, metricId, points);
  return envelope({
    requestId: "financials",
    data: { entity, metricId, points, dataset_id: dataset.datasetId, dataset_version: dataset.version, row_count: points.length, row_count_kind: "exact" },
    sources: sourceRows(points, metricId),
    coverage: coverageFor(points, `${entity.cik}:${metricId}`),
  });
}

export async function runChart(runtime: Runtime, query: string, metricId: string) {
  const financials = await runFinancials(runtime, query, metricId);
  const points = (financials.data as { points?: FactPoint[] }).points ?? [];
  const chart = renderLineChart(`${query} ${metricId}`, points);
  return envelope({
    requestId: "chart",
    data: {
      formats: ["svg", "png", "csv", "vega_lite"],
      description: chart.description,
      svg: chart.svg,
      csv: chart.csv,
      vegaLite: chart.vegaLite,
      pngBase64: chart.png.toString("base64"),
      dataset_id: (financials.data as { dataset_id?: string }).dataset_id,
    },
    coverage: financials.coverage,
    sources: financials.sources,
  });
}

export async function runFilingsSearch(runtime: Runtime, query: string, forms?: string[], from?: string, to?: string) {
  const entityOrErr = await requireEntity(runtime, query);
  if ("errorEnvelope" in entityOrErr) return entityOrErr.errorEnvelope;
  const entity = entityOrErr;
  const payload = await loadSubmissions(runtime, entity.cik!);
  const filings = searchFilings(parseSubmissions(payload, entity.cik!), {
    ...(forms ? { forms } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    limit: 50,
  });
  return envelope({
    requestId: "filings",
    data: { entity, filings, row_count: filings.length, row_count_kind: "exact" },
    coverage: { ...emptyCoverage("filings"), status: COVERAGE_STATUS.COMPLETE_WITHIN_SCOPE, scannedCount: filings.length, indexedCount: filings.length },
  });
}

export async function runFilingRead(runtime: Runtime, query?: string, accession?: string, section?: string) {
  if (!accession && !isLive(runtime)) {
    const html = await readFile(path.join(runtime.fixtureDir, "filing.html"), "utf8");
    const text = htmlToText(html);
    const extracted = section ? extractSection(text, section) : { text, start: 0, confidence: "exact" as const };
    return envelope({
      requestId: "filing",
      data: { text: extracted.text, sample: true, heading: section ?? "full", confidence: extracted.confidence, accession: null },
      coverage: { ...emptyCoverage("filing"), status: COVERAGE_STATUS.COMPLETE_WITHIN_SCOPE },
    });
  }
  const entityOrErr = await requireEntity(runtime, query ?? "");
  if ("errorEnvelope" in entityOrErr) return entityOrErr.errorEnvelope;
  const entity = entityOrErr;
  const payload = await loadSubmissions(runtime, entity.cik!);
  const filings = parseSubmissions(payload, entity.cik!);
  const filing = accession ? filings.find((row) => row.accession === accession) : filings[0];
  if (!filing) {
    return envelope({
      requestId: "filing",
      data: { error: "parse_unsupported: filing not in submissions" },
      coverage: { ...emptyCoverage("filing"), status: COVERAGE_STATUS.UNAVAILABLE },
    });
  }
  let html: string;
  if (isLive(runtime)) {
    const broker = makeBroker(runtime.userAgent!, runtime.fetchImpl);
    html = (await cachedGet(runtime.cacheDir, broker, filingDocumentUrl(entity.cik!, filing.accession, filing.primaryDocument))).body;
  } else {
    html = await readFile(path.join(runtime.fixtureDir, "filing.html"), "utf8");
  }
  const text = htmlToText(html);
  const extracted = section ? extractSection(text, section) : { text, start: 0, confidence: "exact" as const };
  return envelope({
    requestId: "filing",
    data: { text: extracted.text, sample: !isLive(runtime), heading: section ?? filing.form, confidence: extracted.confidence, accession: filing.accession, form: filing.form, filedAt: filing.filedAt },
    sources: [{
      sourceId: filing.accession,
      locatorKind: LOCATOR_KIND.TEXT_OFFSET,
      locator: String(extracted.start),
      accession: filing.accession,
      documentId: filing.primaryDocument,
      contentHash: "document",
      parserVersion: "0.0.0",
    }],
    coverage: { ...emptyCoverage("filing"), status: COVERAGE_STATUS.COMPLETE_WITHIN_SCOPE },
  });
}

export async function runFilingCompare(runtime: Runtime, query: string, accessionA: string, accessionB: string, section?: string) {
  const a = await runFilingRead(runtime, query, accessionA, section);
  const b = await runFilingRead(runtime, query, accessionB, section);
  const left = (a.data as { text?: string }).text ?? "";
  const right = (b.data as { text?: string }).text ?? "";
  const changes = compareParagraphs(left, right);
  return envelope({
    requestId: "filing_compare",
    data: { changes, accessionA, accessionB, section: section ?? null },
    coverage: { ...emptyCoverage("filing_compare"), status: COVERAGE_STATUS.COMPLETE_WITHIN_SCOPE },
  });
}

export async function runCompare(runtime: Runtime, queries: string[], metricId: string) {
  parseMetricId(metricId);
  const entities: Entity[] = [];
  const series: FactPoint[][] = [];
  const failures: string[] = [];
  for (const query of queries) {
    const resolved = await requireEntity(runtime, query);
    if ("errorEnvelope" in resolved) {
      failures.push(query);
      continue;
    }
    entities.push(resolved);
    const text = await loadFactsText(runtime, resolved.cik!);
    series.push(seriesFor(parseCompanyFactsJson(text), resolved.cik!, metricId));
  }
  const table = compareSeries(entities, series);
  const dataset = await saveDataset(runtime.cacheDir, metricId, series.flat());
  return envelope({
    requestId: "compare",
    data: { entities, metricId, ...table, dataset_id: dataset.datasetId, failures },
    coverage: {
      ...emptyCoverage("compare"),
      status: failures.length ? COVERAGE_STATUS.INCOMPLETE : COVERAGE_STATUS.COMPLETE_WITHIN_SCOPE,
      failures,
    },
  });
}

export async function runConceptsSearch(term: string) {
  const q = term.toLowerCase();
  const hits = listMetrics().filter((metric) => metric.id.includes(q) || metric.definition.toLowerCase().includes(q) || metric.tags.some((tag) => tag.toLowerCase().includes(q)));
  return envelope({
    requestId: "concepts",
    data: { metrics: hits },
    coverage: { ...emptyCoverage("concepts"), status: COVERAGE_STATUS.COMPLETE_WITHIN_SCOPE },
  });
}

export async function runDatasetDescribe(runtime: Runtime, datasetId: string) {
  const record = await loadDataset(runtime.cacheDir, datasetId);
  return envelope({
    requestId: "dataset_describe",
    data: { dataset_id: record.datasetId, version: record.version, metricId: record.metricId, row_count: record.points.length, createdAt: record.createdAt },
    coverage: coverageFor(record.points, record.datasetId),
  });
}

export async function runDatasetQuery(runtime: Runtime, datasetId: string, opts: { metricId?: string | undefined; limit?: number | undefined; sql?: string | undefined }) {
  const record = await loadDataset(runtime.cacheDir, datasetId);
  const points = queryDataset(record, opts);
  return envelope({
    requestId: "dataset_query",
    data: { dataset_id: record.datasetId, points, row_count: points.length, row_count_kind: "exact" },
    coverage: coverageFor(points, record.datasetId),
  });
}

export async function runDatasetExport(runtime: Runtime, datasetId: string) {
  const record = await loadDataset(runtime.cacheDir, datasetId);
  return envelope({
    requestId: "dataset_export",
    data: { dataset_id: record.datasetId, format: "csv", csv: exportCsv(record.points) },
    coverage: coverageFor(record.points, record.datasetId),
  });
}

export async function runResearch(runtime: Runtime, query: string, metricId: string) {
  const financials = await runFinancials(runtime, query, metricId);
  const data = financials.data as { entity?: Entity; points?: FactPoint[] };
  if (!data.entity || !data.points) return financials;
  const packet = evidencePacket({ question: `How did ${query} ${metricId} change?`, entity: data.entity, metricId, points: data.points });
  return envelope({ requestId: "research", data: { ...packet, dataset_id: (financials.data as { dataset_id?: string }).dataset_id }, coverage: packet.coverage, sources: financials.sources });
}

export async function runCoverage(runtime: Runtime) {
  return envelope({
    requestId: "coverage",
    data: {
      live: isLive(runtime),
      demo: !isLive(runtime),
      metrics: listMetrics().map((metric) => metric.id),
      sources: ["entity_maps", "submissions", "company_facts", "filing_archives"],
      note: isLive(runtime) ? "live SEC via allowlisted broker and local cache" : "fixture demo; set SEC_USER_AGENT for live",
    },
    coverage: { ...emptyCoverage("service"), status: isLive(runtime) ? COVERAGE_STATUS.COMPLETE_WITHIN_SCOPE : COVERAGE_STATUS.INCOMPLETE },
  });
}

export async function runDoctor(runtime: Runtime) {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  const checks: Record<string, unknown> = {
    node: process.version,
    node_ok: nodeMajor >= 24,
    fixtureDir: runtime.fixtureDir,
    cacheDir: runtime.cacheDir,
    live: isLive(runtime),
  };
  try {
    await access(runtime.fixtureDir);
    checks.fixtures_ok = true;
  } catch {
    checks.fixtures_ok = false;
  }
  await mkdir(runtime.cacheDir, { recursive: true });
  checks.cache_ok = true;
  const ok = checks.node_ok === true && checks.fixtures_ok === true && checks.cache_ok === true;
  return envelope({ requestId: "doctor", data: { ok, checks } });
}

function sourceRows(points: FactPoint[], metricId: string) {
  return points
    .filter((point) => point.sourceAccession)
    .map((point) => ({
      sourceId: point.sourceAccession ?? "source",
      locatorKind: LOCATOR_KIND.XBRL_CONTEXT,
      locator: `${metricId}:${point.periodEnd}`,
      accession: point.sourceAccession,
      documentId: null,
      contentHash: isHash(point) ? "cached" : "fixture",
      parserVersion: "0.0.0",
    }));
}

function isHash(_point: FactPoint): boolean {
  return false;
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
