import type { METRIC_ID } from "../constants/metric.js";

export type MetricId = (typeof METRIC_ID)[keyof typeof METRIC_ID];
