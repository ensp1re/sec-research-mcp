import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  runChart,
  runCompare,
  runConceptsSearch,
  runCoverage,
  runDatasetDescribe,
  runDatasetExport,
  runDatasetQuery,
  runFilingCompare,
  runFilingRead,
  runFilingsSearch,
  runFinancials,
  runResearch,
  runResolve,
  type Runtime,
} from "@sec-research/engine";

const root = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const runtime: Runtime = {
  fixtureDir: path.join(root, "fixtures/demo"),
  cacheDir: path.join(root, ".cache/objects"),
  userAgent: process.env.SEC_USER_AGENT ?? null,
};

const server = new McpServer({ name: "sec-research-mcp", version: "0.0.0" });
const text = async (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });

server.registerTool("sec_coverage_get", { description: "Coverage, live vs demo, and reviewed metrics." }, async () => text(await runCoverage(runtime)));
server.registerTool("sec_company_resolve", { description: "Resolve ticker, CIK, or name. Returns candidates when ambiguous.", inputSchema: { query: z.string() } }, async ({ query }) => text(await runResolve(runtime, query)));
server.registerTool("sec_filings_search", { description: "Search a company's filings by form and date.", inputSchema: { query: z.string(), form: z.string().optional(), from: z.string().optional(), to: z.string().optional() } }, async ({ query, form, from, to }) => text(await runFilingsSearch(runtime, query, form ? [form] : undefined, from, to)));
server.registerTool("sec_filing_read", { description: "Read filing text by accession and optional section heading.", inputSchema: { query: z.string().optional(), accession: z.string().optional(), section: z.string().optional() } }, async ({ query, accession, section }) => text(await runFilingRead(runtime, query, accession, section)));
server.registerTool("sec_filing_compare", { description: "Compare two filings' extracted text; moved vs added/removed.", inputSchema: { query: z.string(), accessionA: z.string(), accessionB: z.string(), section: z.string().optional() } }, async ({ query, accessionA, accessionB, section }) => text(await runFilingCompare(runtime, query, accessionA, accessionB, section)));
server.registerTool("sec_concepts_search", { description: "Search reviewed metric definitions and source tags.", inputSchema: { term: z.string() } }, async ({ term }) => text(await runConceptsSearch(term)));
server.registerTool("sec_financials_get", { description: "Period-aware financial series as decimal strings. Missing is not zero.", inputSchema: { query: z.string(), metric: z.string().default("revenue") } }, async ({ query, metric }) => text(await runFinancials(runtime, query, metric ?? "revenue")));
server.registerTool("sec_companies_compare", { description: "Compare entities on one metric. Gaps stay missing.", inputSchema: { queries: z.array(z.string()), metric: z.string().default("revenue") } }, async ({ queries, metric }) => text(await runCompare(runtime, queries, metric ?? "revenue")));
server.registerTool("sec_dataset_describe", { description: "Describe a dataset version created by financials or compare.", inputSchema: { dataset_id: z.string() } }, async ({ dataset_id }) => text(await runDatasetDescribe(runtime, dataset_id)));
server.registerTool("sec_dataset_query", { description: "Bounded filter or single SELECT on a dataset. No side effects.", inputSchema: { dataset_id: z.string(), metric: z.string().optional(), limit: z.number().optional(), sql: z.string().optional() } }, async ({ dataset_id, metric, limit, sql }) => text(await runDatasetQuery(runtime, dataset_id, { metricId: metric, limit, sql })));
server.registerTool("sec_dataset_export", { description: "Export dataset CSV with exact decimal strings.", inputSchema: { dataset_id: z.string() } }, async ({ dataset_id }) => text(await runDatasetExport(runtime, dataset_id)));
server.registerTool("sec_chart_create", { description: "Chart from a company metric series (SVG/PNG/CSV/Vega-Lite).", inputSchema: { query: z.string(), metric: z.string().default("revenue") } }, async ({ query, metric }) => text(await runChart(runtime, query, metric ?? "revenue")));
server.registerTool("sec_research_run", { description: "Evidence packet: series, methods, coverage, sources, chart.", inputSchema: { query: z.string(), metric: z.string().default("revenue") } }, async ({ query, metric }) => text(await runResearch(runtime, query, metric ?? "revenue")));

const transport = new StdioServerTransport();
await server.connect(transport);
