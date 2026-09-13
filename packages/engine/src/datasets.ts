import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FactPoint } from "./financials.js";
import { assertSafeSql, queryFacts } from "./query.js";

export interface DatasetRecord {
  datasetId: string;
  version: number;
  createdAt: string;
  metricId: string;
  points: FactPoint[];
}

export async function saveDataset(cacheDir: string, metricId: string, points: FactPoint[]): Promise<DatasetRecord> {
  const dir = path.join(cacheDir, "datasets");
  await mkdir(dir, { recursive: true });
  const record: DatasetRecord = {
    datasetId: `ds_${randomUUID().slice(0, 8)}`,
    version: 1,
    createdAt: new Date().toISOString(),
    metricId,
    points,
  };
  await writeFile(path.join(dir, `${record.datasetId}.json`), JSON.stringify(record));
  return record;
}

export async function loadDataset(cacheDir: string, datasetId: string): Promise<DatasetRecord> {
  const file = path.join(cacheDir, "datasets", `${datasetId}.json`);
  return JSON.parse(await readFile(file, "utf8")) as DatasetRecord;
}

export function queryDataset(record: DatasetRecord, opts: { metricId?: string | undefined; limit?: number | undefined; sql?: string | undefined }): FactPoint[] {
  if (opts.sql) {
    assertSafeSql(opts.sql);
    const metric = /metric_id\s*=\s*'([^']+)'/i.exec(opts.sql)?.[1];
    const limit = Number(/limit\s+(\d+)/i.exec(opts.sql)?.[1] ?? "50");
    return queryFacts(record.points, { metricId: metric, limit });
  }
  return queryFacts(record.points, { metricId: opts.metricId, limit: opts.limit });
}

export function exportCsv(points: readonly FactPoint[]): string {
  const header = "entityCik,metricId,value,unit,periodStart,periodEnd,periodKind,derivation,missingness,sourceAccession,filedAt";
  const rows = points.map((point) =>
    [
      point.entityCik,
      point.metricId,
      point.value ?? "",
      point.unit ?? "",
      point.periodStart ?? "",
      point.periodEnd ?? "",
      point.periodKind,
      point.derivation,
      point.missingness ?? "",
      point.sourceAccession ?? "",
      point.filedAt ?? "",
    ].join(","),
  );
  return [header, ...rows].join("\n");
}
