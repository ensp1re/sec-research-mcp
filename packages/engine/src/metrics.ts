import { METRIC_ID } from "@sec-research/domain";
import type { MetricId } from "@sec-research/domain";

export interface MetricSpec {
  id: MetricId;
  tags: readonly string[];
  additive: boolean;
  period: "duration" | "instant";
  unit: string;
}

export const METRICS: Record<MetricId, MetricSpec> = {
  [METRIC_ID.REVENUE]: {
    id: METRIC_ID.REVENUE,
    tags: [
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "Revenues",
      "SalesRevenueNet",
    ],
    additive: true,
    period: "duration",
    unit: "USD",
  },
  [METRIC_ID.NET_INCOME]: {
    id: METRIC_ID.NET_INCOME,
    tags: ["NetIncomeLoss"],
    additive: true,
    period: "duration",
    unit: "USD",
  },
  [METRIC_ID.OPERATING_CASH_FLOW]: {
    id: METRIC_ID.OPERATING_CASH_FLOW,
    tags: ["NetCashProvidedByUsedInOperatingActivities"],
    additive: true,
    period: "duration",
    unit: "USD",
  },
  [METRIC_ID.CASH]: {
    id: METRIC_ID.CASH,
    tags: ["CashAndCashEquivalentsAtCarryingValue"],
    additive: false,
    period: "instant",
    unit: "USD",
  },
  [METRIC_ID.GROSS_MARGIN]: {
    id: METRIC_ID.GROSS_MARGIN,
    tags: [],
    additive: false,
    period: "duration",
    unit: "ratio",
  },
};

export function parseMetricId(value: string): MetricId {
  const found = Object.values(METRIC_ID).find((id) => id === value);
  if (!found) throw new Error(`metric_unavailable: ${value}`);
  return found;
}
