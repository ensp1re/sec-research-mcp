import type {
  AVAILABILITY_BASIS,
  AVAILABILITY_PRECISION,
  COMPARISON_ALIGNMENT,
  PERIOD_KIND,
  REVISION_POLICY,
} from "../constants/period.js";

export type PeriodKind = (typeof PERIOD_KIND)[keyof typeof PERIOD_KIND];
export type RevisionPolicy = (typeof REVISION_POLICY)[keyof typeof REVISION_POLICY];
export type AvailabilityBasis = (typeof AVAILABILITY_BASIS)[keyof typeof AVAILABILITY_BASIS];
export type ComparisonAlignment = (typeof COMPARISON_ALIGNMENT)[keyof typeof COMPARISON_ALIGNMENT];
export type AvailabilityPrecision = (typeof AVAILABILITY_PRECISION)[keyof typeof AVAILABILITY_PRECISION];

export interface ReportingPeriod {
  readonly periodStart: string | null;
  readonly periodEnd: string | null;
  readonly instant: string | null;
  readonly kind: PeriodKind;
  readonly fiscalYear: number | null;
  readonly fiscalQuarter: 1 | 2 | 3 | 4 | null;
  readonly durationDays: number | null;
}

export interface TemporalProvenance {
  readonly filedAt: string | null;
  readonly acceptedAt: string | null;
  readonly sourceAvailableAt: string | null;
  readonly sourceAvailablePrecision: AvailabilityPrecision;
  readonly firstObservedAt: string;
  readonly recordedAt: string;
  readonly supersededAt: string | null;
}

export interface RevisionSelection {
  readonly policy: RevisionPolicy;
  readonly availabilityBasis: AvailabilityBasis;
  readonly asOf: string | null;
}
