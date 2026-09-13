import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { FactPoint } from "./financials.js";
import { assertSafeSql } from "./query.js";

const workerPath = fileURLToPath(new URL("./query-worker.js", import.meta.url));

export async function runIsolatedQuery(datasetPath: string, sql: string): Promise<FactPoint[]> {
  assertSafeSql(sql);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [workerPath, datasetPath, sql], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { PATH: process.env.PATH ?? "" },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `query worker exit ${code}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as { points: FactPoint[] };
        resolve(parsed.points);
      } catch (error) {
        reject(error);
      }
    });
  });
}
