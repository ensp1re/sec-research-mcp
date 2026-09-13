export const PERIOD_KIND = {
  ANNUAL: "annual",
  DISCRETE_QUARTER: "discrete_quarter",
  YEAR_TO_DATE: "year_to_date",
  TRAILING: "trailing",
  INSTANT: "instant",
  TRANSITION: "transition",
} as const;

export const REVISION_POLICY = {
  AS_REPORTED: "as_reported",
  LATEST_AVAILABLE: "latest_available",
  AS_OF: "as_of",
} as const;

export const AVAILABILITY_BASIS = {
  PUBLIC_EVIDENCE: "public_evidence",
  SYSTEM_OBSERVED: "system_observed",
} as const;

export const COMPARISON_ALIGNMENT = {
  FISCAL: "fiscal",
  CALENDAR: "calendar",
} as const;

export const AVAILABILITY_PRECISION = {
  DATETIME: "datetime",
  DATE: "date",
  UNKNOWN: "unknown",
} as const;
