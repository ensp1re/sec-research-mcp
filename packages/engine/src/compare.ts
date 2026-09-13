import type { Entity } from "@sec-research/domain";
import type { FactPoint } from "./financials.js";

export interface CompareCell {
  entityCik: string;
  periodEnd: string;
  value: string | null;
  missingness: string | null;
  derivation: string;
}

export function compareSeries(entities: Entity[], series: FactPoint[][]): {
  periods: string[];
  cells: CompareCell[];
  warnings: string[];
} {
  const periodSet = new Set<string>();
  for (const points of series) {
    for (const point of points) {
      if (point.periodEnd) periodSet.add(point.periodEnd);
    }
  }
  const periods = [...periodSet].sort();
  const warnings: string[] = [];
  const fiscal = series.flat().map((point) => point.periodKind);
  if (new Set(fiscal).size > 1) warnings.push("period kinds differ across rows; fiscal labels are not calendar-aligned");
  const cells: CompareCell[] = [];
  entities.forEach((entity, index) => {
    const byEnd = new Map((series[index] ?? []).map((point) => [point.periodEnd, point]));
    for (const period of periods) {
      const point = byEnd.get(period);
      cells.push({
        entityCik: entity.cik ?? entity.id,
        periodEnd: period,
        value: point?.value ?? null,
        missingness: point?.missingness ?? (point ? null : "missing"),
        derivation: point?.derivation ?? "reported",
      });
    }
  });
  return { periods, cells, warnings };
}
