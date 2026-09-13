import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  runChart,
  runCompare,
  runConceptsSearch,
  runCoverage,
  runDoctor,
  runFilingCompare,
  runFilingRead,
  runFilingsSearch,
  runFinancials,
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

function print(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

async function main(argv: string[]): Promise<void> {
  const command = argv[0] ?? "help";
  await mkdir(runtime().cacheDir, { recursive: true });
  if (command === "doctor") print(await runDoctor(runtime()));
  else if (command === "coverage") print(await runCoverage(runtime()));
  else if (command === "demo" || command === "research") {
    const result = await runResearch(runtime(), argv[1] ?? "AAPL", argv[2] ?? "revenue");
    console.log((result.data as { markdown?: string }).markdown ?? JSON.stringify(result, null, 2));
  } else if (command === "resolve") print(await runResolve(runtime(), argv[1] ?? "AAPL"));
  else if (command === "financials") print(await runFinancials(runtime(), argv[1] ?? "AAPL", argv[2] ?? "revenue"));
  else if (command === "chart") {
    const chart = await runChart(runtime(), argv[1] ?? "AAPL", argv[2] ?? "revenue");
    print({ ...chart, data: { ...(chart.data as object), pngBase64: "[omitted]" } });
  } else if (command === "filings") print(await runFilingsSearch(runtime(), argv[1] ?? "AAPL", argv[2] ? [argv[2]] : undefined));
  else if (command === "filing") print(await runFilingRead(runtime(), argv[1] ?? "AAPL", argv[2], argv[3]));
  else if (command === "compare") print(await runCompare(runtime(), (argv[1] ?? "AAPL,MSFT").split(","), argv[2] ?? "revenue"));
  else if (command === "concepts") print(await runConceptsSearch(argv[1] ?? "revenue"));
  else if (command === "filing-compare") print(await runFilingCompare(runtime(), argv[1] ?? "AAPL", argv[2] ?? "", argv[3] ?? "", argv[4]));
  else {
    console.log("usage: sec-research <doctor|coverage|demo|resolve|financials|chart|filings|filing|compare|concepts|filing-compare|research> [...]");
  }
}

await main(process.argv.slice(2));
