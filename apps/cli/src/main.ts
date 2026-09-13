import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runChart, runFilingRead, runFinancials, runResearch, runResolve } from "@sec-research/engine";

const root = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));

function runtime() {
  return {
    fixtureDir: path.join(root, "fixtures/demo"),
    cacheDir: path.join(root, ".cache/objects"),
    userAgent: process.env.SEC_USER_AGENT ?? null,
    mode: "demo" as const,
  };
}

async function main(argv: string[]): Promise<void> {
  const command = argv[0] ?? "help";
  await mkdir(runtime().cacheDir, { recursive: true });
  if (command === "doctor") {
    console.log(JSON.stringify({ ok: true, node: process.version, fixtureDir: runtime().fixtureDir, live: Boolean(runtime().userAgent) }, null, 2));
    return;
  }
  if (command === "demo" || command === "research") {
    const result = await runResearch(runtime(), argv[1] ?? "AAPL", argv[2] ?? "revenue");
    console.log((result.data as { markdown?: string }).markdown ?? JSON.stringify(result, null, 2));
    return;
  }
  if (command === "resolve") {
    console.log(JSON.stringify(await runResolve(runtime(), argv[1] ?? "AAPL"), null, 2));
    return;
  }
  if (command === "financials") {
    console.log(JSON.stringify(await runFinancials(runtime(), argv[1] ?? "AAPL", argv[2] ?? "revenue"), null, 2));
    return;
  }
  if (command === "chart") {
    const chart = await runChart(runtime(), argv[1] ?? "AAPL", argv[2] ?? "revenue");
    console.log(JSON.stringify({ ...chart, data: { ...(chart.data as object), pngBase64: "[omitted]" } }, null, 2));
    return;
  }
  if (command === "filing") {
    console.log(JSON.stringify(await runFilingRead(runtime()), null, 2));
    return;
  }
  console.log("usage: sec-research <doctor|demo|resolve|financials|chart|filing|research> [entity] [metric]");
}

await main(process.argv.slice(2));
