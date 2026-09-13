import { DERIVATION, PERIOD_KIND } from "@sec-research/domain";
import { Decimal } from "decimal.js";
import type { FactPoint } from "./financials.js";
import { METRICS } from "./metrics.js";
import { parseMetricId } from "./metrics.js";

export function preferDiscreteQuarters(points: FactPoint[]): FactPoint[] {
  const quarters = points.filter((point) => point.periodKind === PERIOD_KIND.DISCRETE_QUARTER);
  if (quarters.length >= 4) return quarters;
  return points;
}

export function deriveQ4IfEligible(points: FactPoint[], metricId: string): FactPoint[] {
  const spec = METRICS[parseMetricId(metricId)];
  if (!spec.additive || spec.period !== "duration") return points;
  const annual = points.filter((point) => point.periodKind === PERIOD_KIND.ANNUAL && point.value);
  const ytd = points.filter((point) => point.periodKind === PERIOD_KIND.YEAR_TO_DATE && point.value);
  const extra: FactPoint[] = [];
  for (const year of annual) {
    const nine = ytd.find((point) => point.periodEnd && year.periodEnd && point.periodEnd.slice(0, 4) === year.periodEnd.slice(0, 4));
    if (!nine?.value || !year.value) continue;
    extra.push({
      ...year,
      periodKind: PERIOD_KIND.DISCRETE_QUARTER,
      derivation: DERIVATION.DERIVED,
      value: new Decimal(year.value).minus(nine.value).toString(),
      missingness: null,
    });
  }
  return extra.length ? [...points, ...extra] : points;
}
