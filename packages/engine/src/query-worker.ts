import { readFile } from "node:fs/promises";
import { queryDataset, type DatasetRecord } from "./datasets.js";
import { assertSafeSql } from "./query.js";

const datasetPath = process.argv[2];
const sql = process.argv[3];
if (!datasetPath || !sql) {
  process.stderr.write("usage: query-worker <dataset.json> <sql>\n");
  process.exit(2);
}

try {
  assertSafeSql(sql);
  const record = JSON.parse(await readFile(datasetPath, "utf8")) as DatasetRecord;
  const points = queryDataset(record, { sql });
  process.stdout.write(`${JSON.stringify({ ok: true, points })}\n`);
} catch (error) {
  process.stderr.write(`${(error as Error).message}\n`);
  process.exit(1);
}
