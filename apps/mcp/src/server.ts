import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { runChart, runFilingRead, runFinancials, runResearch, runResolve } from "@sec-research/engine";

const root = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const runtime = {
  fixtureDir: path.join(root, "fixtures/demo"),
  cacheDir: path.join(root, ".cache/objects"),
  userAgent: process.env.SEC_USER_AGENT ?? null,
  mode: "demo" as const,
};

const server = new McpServer({ name: "sec-research-mcp", version: "0.0.0" });

server.registerTool(
  "sec_company_resolve",
  { description: "Resolve a ticker, CIK, or name to an entity. Demo fixtures unless SEC_USER_AGENT is set for live mode later.", inputSchema: { query: z.string() } },
  async ({ query }) => ({ content: [{ type: "text", text: JSON.stringify(await runResolve(runtime, query)) }] }),
);
server.registerTool(
  "sec_financials_get",
  { description: "Return a versioned financial series for a reviewed metric. Values are decimal strings; missing is not zero.", inputSchema: { query: z.string(), metric: z.string().default("revenue") } },
  async ({ query, metric }) => ({ content: [{ type: "text", text: JSON.stringify(await runFinancials(runtime, query, metric ?? "revenue")) }] }),
);
server.registerTool(
  "sec_chart_create",
  { description: "Render a line chart from an existing financial series. Returns SVG, PNG, CSV, and a Vega-Lite spec.", inputSchema: { query: z.string(), metric: z.string().default("revenue") } },
  async ({ query, metric }) => ({ content: [{ type: "text", text: JSON.stringify(await runChart(runtime, query, metric ?? "revenue")) }] }),
);
server.registerTool(
  "sec_filing_read",
  { description: "Read extracted filing text from the demo fixture with source-visible sample labeling.", inputSchema: {} },
  async () => ({ content: [{ type: "text", text: JSON.stringify(await runFilingRead(runtime)) }] }),
);
server.registerTool(
  "sec_research_run",
  { description: "Run the company overview evidence packet: series, chart, methods, coverage.", inputSchema: { query: z.string(), metric: z.string().default("revenue") } },
  async ({ query, metric }) => ({ content: [{ type: "text", text: JSON.stringify(await runResearch(runtime, query, metric ?? "revenue")) }] }),
);
server.registerTool(
  "sec_coverage_get",
  { description: "Describe demo versus live coverage. Live SEC fetches require SEC_USER_AGENT.", inputSchema: {} },
  async () => ({
    content: [{
      type: "text",
      text: JSON.stringify({
        schema_version: "1.0",
        demo: true,
        live: Boolean(runtime.userAgent),
        entities: ["AAPL", "MSFT"],
        metrics: ["revenue", "net_income", "cash", "gross_margin", "operating_cash_flow"],
      }),
    }],
  }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
