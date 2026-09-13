import {
  COVERAGE_STATUS,
  DERIVATION,
  METRIC_ID,
  MISSINGNESS,
  PERIOD_KIND,
  type Missingness,
  type PeriodKind,
} from "@sec-research/domain";
import { Decimal } from "decimal.js";
import { parse as parseLossless } from "lossless-json";
import { METRICS, parseMetricId, type MetricSpec } from "./metrics.js";

export interface FactPoint {
  entityCik: string;
  metricId: string;
  value: string | null;
  missingness: Missingness | null;
  unit: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  periodKind: PeriodKind;
  derivation: "reported" | "derived";
  sourceAccession: string | null;
  filedAt: string | null;
}

interface RawUnitPoint {
  val: unknown;
  start?: unknown;
  end?: unknown;
  fy?: unknown;
  fp?: unknown;
  form?: unknown;
  filed?: unknown;
  accn?: unknown;
  frame?: unknown;
}

export function parseCompanyFactsJson(text: string): unknown {
  return parseLossless(text, null, (value) => {
    if (value && typeof value === "object" && "isLosslessNumber" in value) {
      return String(value);
    }
    return value;
  });
}

export function extractSeries(
  factsPayload: unknown,
  cik: string,
  metricId: string,
): FactPoint[] {
  const metric = METRICS[parseMetricId(metricId)];
  if (metric.id === METRIC_ID.GROSS_MARGIN) {
    return deriveGrossMargin(factsPayload, cik);
  }
  const points = collectTagPoints(factsPayload, cik, metric);
  if (points.length === 0) {
    return [
      {
        entityCik: cik,
        metricId: metric.id,
        value: null,
        missingness: MISSINGNESS.MISSING,
        unit: metric.unit,
        periodStart: null,
        periodEnd: null,
        periodKind: metric.period === "instant" ? PERIOD_KIND.INSTANT : PERIOD_KIND.ANNUAL,
        derivation: DERIVATION.REPORTED,
        sourceAccession: null,
        filedAt: null,
      },
    ];
  }
  return points;
}

function collectTagPoints(factsPayload: unknown, cik: string, metric: MetricSpec): FactPoint[] {
  const usGaap = getUsGaap(factsPayload);
  if (!usGaap) return [];
  const seen = new Set<string>();
  const out: FactPoint[] = [];
  for (const tag of metric.tags) {
    const concept = usGaap[tag];
    const units = concept && typeof concept === "object" ? (concept as { units?: Record<string, RawUnitPoint[]> }).units : undefined;
    const series = units?.[metric.unit] ?? units?.USD ?? [];
    for (const point of series) {
      const end = stringify(point.end);
      const start = stringify(point.start);
      const key = `${start ?? ""}:${end ?? ""}:${stringify(point.form)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const lexeme = numericLexeme(point.val);
      out.push({
        entityCik: cik,
        metricId: metric.id,
        value: lexeme,
        missingness: lexeme === null ? MISSINGNESS.MISSING : null,
        unit: metric.unit,
        periodStart: start,
        periodEnd: end,
        periodKind: classifyPeriod(start, end, stringify(point.fp), metric),
        derivation: DERIVATION.REPORTED,
        sourceAccession: stringify(point.accn),
        filedAt: stringify(point.filed),
      });
    }
    if (out.some((row) => row.value !== null)) break;
  }
  return out.sort((a, b) => (a.periodEnd ?? "").localeCompare(b.periodEnd ?? ""));
}

function deriveGrossMargin(factsPayload: unknown, cik: string): FactPoint[] {
  const revenue = collectTagPoints(factsPayload, cik, METRICS[METRIC_ID.REVENUE]);
  const usGaap = getUsGaap(factsPayload);
  const gpSpec: MetricSpec = {
    id: METRIC_ID.REVENUE,
    tags: ["GrossProfit"],
    additive: true,
    period: "duration",
    unit: "USD",
  };
  const gross = usGaap ? collectTagPoints(factsPayload, cik, gpSpec).map((row) => ({ ...row, metricId: "gross_profit" })) : [];
  const byEnd = new Map(gross.map((row) => [row.periodEnd, row]));
  return revenue.map((row) => {
    const match = byEnd.get(row.periodEnd);
    if (!row.value || !match?.value) {
      return {
        ...row,
        metricId: METRIC_ID.GROSS_MARGIN,
        value: null,
        missingness: MISSINGNESS.MISSING,
        unit: "ratio",
        derivation: DERIVATION.DERIVED,
      };
    }
    const rev = new Decimal(row.value);
    if (rev.isZero()) {
      return {
        ...row,
        metricId: METRIC_ID.GROSS_MARGIN,
        value: null,
        missingness: MISSINGNESS.NOT_APPLICABLE,
        unit: "ratio",
        derivation: DERIVATION.DERIVED,
      };
    }
    return {
      ...row,
      metricId: METRIC_ID.GROSS_MARGIN,
      value: new Decimal(match.value).div(rev).toFixed(6),
      missingness: null,
      unit: "ratio",
      derivation: DERIVATION.DERIVED,
    };
  });
}

export function coverageFor(points: readonly FactPoint[], scope: string) {
  const missing = points.filter((point) => point.value === null);
  return {
    status: missing.length === 0 ? COVERAGE_STATUS.COMPLETE_WITHIN_SCOPE : COVERAGE_STATUS.INCOMPLETE,
    scope,
    sourceBounds: null,
    scannedCount: points.length,
    indexedCount: points.length - missing.length,
    exclusions: [],
    failures: missing.map((point) => `${point.metricId}:${point.periodEnd ?? "none"}`),
    watermark: points.at(-1)?.periodEnd ?? null,
    lastCheckedAt: null,
    latestSourceAvailableAt: points.at(-1)?.filedAt ?? null,
  };
}

function getUsGaap(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  const facts = (payload as { facts?: { "us-gaap"?: Record<string, unknown> } }).facts;
  return facts?.["us-gaap"] ?? null;
}

function numericLexeme(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return String(value);
  }
  return String(value);
}

function stringify(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function classifyPeriod(start: string | null, end: string | null, fp: string | null, metric: MetricSpec): PeriodKind {
  if (metric.period === "instant") return PERIOD_KIND.INSTANT;
  if (fp === "FY" || fp === "CY") return PERIOD_KIND.ANNUAL;
  if (fp === "Q1" || fp === "Q2" || fp === "Q3" || fp === "Q4") return PERIOD_KIND.DISCRETE_QUARTER;
  if (start && end) {
    const days = (Date.parse(end) - Date.parse(start)) / 86400000;
    if (days > 300) return PERIOD_KIND.ANNUAL;
    if (days > 70 && days < 100) return PERIOD_KIND.DISCRETE_QUARTER;
  }
  return PERIOD_KIND.ANNUAL;
}
